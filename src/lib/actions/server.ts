"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireActionUser } from "@/lib/portal/auth";
import { readResearchActor } from "@/lib/research/roles";
import { persistActionOperation, persistDeskAction, readAction, readActionHistory, replayDeskAction, replayActionCompletion, readActionConflict } from "@/lib/db/desk-actions";
import { ActionLinkError, linkKey, resolveActionLinks, validateActionLink } from "@/lib/db/desk-action-links";
import { actionIssue, saveActionInputSchema } from "./model";
import type { ActionDraft, ActionEvent, ActionSaveResult, DeskAction, SaveActionInput } from "./types";
const unavailable = (): ActionSaveResult => ({ ok: false, code: 'unavailable', error: 'Could not save the action. Your changes have been kept. Please try again.' });
const missing = (): ActionSaveResult => ({ ok: false, code: 'not_found', error: 'This action no longer exists or is unavailable' });
const envelope = z.object({ id: z.uuid(), expectedVersion: z.number().int().positive(), requestId: z.uuid() }).strict();
function draftFor(action: DeskAction): ActionDraft { return { title: action.title, description: action.description ?? '', ownerId: action.ownerId, dueDate: action.dueDate, state: action.state, stateReason: action.stateReason ?? '', changeReason: '', saveUnassigned: action.ownerId === null }; }
function refreshed(result: ActionSaveResult): ActionSaveResult {
    if (result.ok)
        revalidatePath('/portal', 'layout');
    return result;
}
async function save(input: SaveActionInput, current: DeskAction | null, operation: 'save' | 'complete' = 'save'): Promise<ActionSaveResult> {
    const issue = actionIssue(input.draft, current);
    if (issue)
        return { ok: false, code: 'validation', error: issue };
    if (current && linkKey(current.link) !== linkKey(input.link))
        return { ok: false, code: 'validation', error: 'Use Detach to retain this action as general work' };
    if (input.draft.ownerId && input.draft.ownerId !== current?.ownerId) {
        const selected = await readResearchActor(input.draft.ownerId);
        if (selected.role !== 'director')
            return { ok: false, code: 'validation', error: 'Choose a director' };
    }
    await validateActionLink(input.link);
    return refreshed(await (operation === 'complete' ? persistDeskAction(input, 'complete') : persistDeskAction(input)));
}
function failure(error: unknown): ActionSaveResult { return error instanceof ActionLinkError ? { ok: false, code: 'not_found', error: error.message } : unavailable(); }
export async function saveDeskAction(input: SaveActionInput): Promise<ActionSaveResult> {
    try {
        const actor = await requireActionUser();
        if (!actor.ok)
            return { ok: false, code: 'forbidden', error: actor.error };
        const parsed = saveActionInputSchema.safeParse(input);
        if (!parsed.success)
            return { ok: false, code: 'validation', error: 'Check the action details and try again' };
        const replay = await replayDeskAction(parsed.data);
        if (replay)
            return refreshed(replay);
        const current = await readAction(parsed.data.id);
        if (current && current.version !== parsed.data.expectedVersion)
            return refreshed((await replayDeskAction(parsed.data)) ?? await readActionConflict(parsed.data.id));
        if (parsed.data.expectedVersion !== 0 && !current)
            return missing();
        return await save(parsed.data, current);
    }
    catch (error) {
        return failure(error);
    }
}
export async function completeDeskAction(id: string, expectedVersion: number, requestId: string): Promise<ActionSaveResult> {
    try {
        const actor = await requireActionUser();
        if (!actor.ok)
            return { ok: false, code: 'forbidden', error: actor.error };
        if (!envelope.safeParse({ id, expectedVersion, requestId }).success)
            return { ok: false, code: 'validation', error: 'Invalid action request' };
        const replay = await replayActionCompletion(id, expectedVersion, requestId);
        if (replay)
            return refreshed(replay);
        const current = await readAction(id);
        if (!current)
            return missing();
        if (current.version !== expectedVersion)
            return refreshed((await replayActionCompletion(id, expectedVersion, requestId)) ?? await readActionConflict(id));
        return await save({ id, expectedVersion, requestId, link: current.link, draft: { ...draftFor(current), state: 'completed' } }, current, 'complete');
    }
    catch (error) {
        return failure(error);
    }
}
async function operation(kind: 'detach' | 'primary', id: string, expectedVersion: number, requestId: string): Promise<ActionSaveResult> {
    try {
        const actor = await requireActionUser();
        if (!actor.ok)
            return { ok: false, code: 'forbidden', error: actor.error };
        if (!envelope.safeParse({ id, expectedVersion, requestId }).success)
            return { ok: false, code: 'validation', error: 'Invalid action request' };
        const current = await readAction(id);
        if (!current)
            return missing();
        await validateActionLink(current.link);
        const context = kind === 'detach' ? (current.retainedContext ?? (await resolveActionLinks([current.link])).get(linkKey(current.link))?.relatedLabel ?? null) : null;
        return refreshed(await persistActionOperation(kind, id, expectedVersion, requestId, context));
    }
    catch (error) {
        return failure(error);
    }
}
export async function detachDeskAction(id: string, expectedVersion: number, requestId: string): Promise<ActionSaveResult> { return operation('detach', id, expectedVersion, requestId); }
export async function selectPrimaryAction(id: string, expectedVersion: number, requestId: string): Promise<ActionSaveResult> { return operation('primary', id, expectedVersion, requestId); }
/** Reader boundary for the client-side history disclosure. */
export async function loadDeskActionHistory(id: string): Promise<ActionEvent[]> {
    const actor = await requireActionUser();
    if (!actor.ok)
        throw new Error(actor.error);
    if (!z.uuid().safeParse(id).success)
        throw new Error("Invalid action request");
    return readActionHistory(id);
}
