import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { requireDb } from "./index";
import { requireResearchDirector } from "@/lib/research/roles";
import { deskActionPredicates, deskActionVisibilityPredicate } from "./desk-action-filter";
export { deskActionPredicates, deskActionVisibilityPredicate } from "./desk-action-filter";
import { actionStateSchema, workLinkSchema } from "@/lib/actions/model";
import type { ActionEvent, ActionQuery, ActionSaveResult, ActionView, DeskAction, SaveActionInput, WorkLink } from "@/lib/actions/types";
import { directorName, listDirectors } from "@/lib/portal/directors";
import { linkKey, resolveActionLinks } from "./desk-action-links";
type Row = Record<string, unknown>;
const parents = { pursuit: "pursuit_id", prospect: "prospect_id", programme: "programme_id", investigation: "investigation_id", calendar: "calendar_id" } as const;
const timestamp = (value: unknown): string => value instanceof Date ? value.toISOString() : String(value);
const nullable = (value: unknown): string | null => value == null ? null : timestamp(value);
export function mapDeskAction(row: Row): DeskAction {
    let link: WorkLink = { kind: "general" };
    for (const [kind, column] of Object.entries(parents))
        if (row[column])
            link = { kind: kind as Exclude<WorkLink["kind"], "general">, id: String(row[column]) };
    return { id: String(row.id), title: String(row.title), description: nullable(row.description), ownerId: nullable(row.owner_id), suggestedOwnerId: nullable(row.suggested_owner_id), dueDate: nullable(row.due_date), originalDueDate: nullable(row.original_due_date), state: actionStateSchema.parse(row.state), stateReason: nullable(row.state_reason), completedAt: nullable(row.completed_at), completedBy: nullable(row.completed_by), createdBy: String(row.created_by), createdAt: timestamp(row.created_at), updatedAt: timestamp(row.updated_at), version: Number(row.version), legacyKey: nullable(row.legacy_key), retainedContext: nullable(row.retained_context), link };
}
async function views(actions: DeskAction[]): Promise<ActionView[]> {
    if (!actions.length)
        return [];
    const [links, directors, primary] = await Promise.all([resolveActionLinks(actions.map(a => a.link)), listDirectors(), requireDb().execute(sql `select action_id from desk_action_priorities where action_id in(select value::uuid from jsonb_array_elements_text(${JSON.stringify(actions.map(a => a.id))}::jsonb))`)]);
    const nominated = new Set(primary.rows.map(r => String(r.action_id)));
    return actions.flatMap(a => { const related = links.get(linkKey(a.link)); return related ? [{ ...a, ...related, ownerName: directorName(directors, a.ownerId), isPrimary: nominated.has(a.id) }] : []; });
}
export async function readAction(id: string): Promise<DeskAction | null> {
    await requireResearchDirector();
    const rows = await requireDb().execute(sql `select a.* from desk_actions a where a.id=${id}::uuid and ${deskActionVisibilityPredicate()}`);
    return rows.rows[0] ? mapDeskAction(rows.rows[0]) : null;
}
/** Direct editor lookup retains the same authorisation and relation masking as the register. */
export async function readActionView(id: string): Promise<ActionView | null> {
    const action = await readAction(id);
    return action ? (await views([action]))[0] ?? null : null;
}
export async function readActionViews(query: ActionQuery, _actorId: string, now: Date): Promise<{
    rows: ActionView[];
    total: number;
}> {
    const actor = await requireResearchDirector();
    const predicate = deskActionPredicates(query, actor, now);
    const limit = Math.min(50, Math.max(1, Math.floor(query.pageSize) || 50)), offset = (Math.max(1, Math.min(100000, Math.floor(query.page) || 1)) - 1) * limit;
    const [rows, count] = await Promise.all([requireDb().execute(sql `select a.* from desk_actions a where ${predicate} order by a.due_date asc nulls last,a.created_at,a.id limit ${limit} offset ${offset}`), requireDb().execute(sql `select count(*)::int as total from desk_actions a where ${predicate}`)]);
    return { rows: await views(rows.rows.map(mapDeskAction)), total: Number(count.rows[0]?.total ?? 0) };
}
export async function readRelatedActions(link: WorkLink): Promise<ActionView[]> {
    await requireResearchDirector();
    const predicate = deskActionPredicates({ scope: 'team', filter: 'all', link, page: 1, pageSize: 50 }, '', new Date());
    const result = await requireDb().execute(sql `select a.* from desk_actions a where ${predicate} order by a.due_date asc nulls last,a.created_at,a.id`);
    return views(result.rows.map(mapDeskAction));
}
export async function readActionHistory(id: string): Promise<ActionEvent[]> {
    await requireResearchDirector();
    if (!await readAction(id))
        return [];
    const [result, directors] = await Promise.all([requireDb().execute(sql `select e.id,e.action_id,e.actor_id,e.kind,e.before,e.after,e.reason,e.created_at from desk_action_events e join desk_actions a on a.id=e.action_id where a.id=${id}::uuid and ${deskActionVisibilityPredicate()} order by e.created_at,e.id`), listDirectors()]);
    // Detached history can still contain restricted research content: check every snapshot.
    const snapshots = result.rows.flatMap(r => [r.before, r.after].filter(Boolean).map(r => mapDeskAction(r as Row)));
    const permitted = await resolveActionLinks(snapshots.map(s => s.link));
    if (snapshots.some(s => !permitted.has(linkKey(s.link))))
        return [];
    return result.rows.map(r => ({ id: String(r.id), actionId: String(r.action_id), actorId: String(r.actor_id), actorName: directorName(directors, String(r.actor_id)), kind: r.kind as ActionEvent['kind'], before: r.before ? mapDeskAction(r.before as Row) : null, after: mapDeskAction(r.after as Row), reason: nullable(r.reason), createdAt: timestamp(r.created_at) }));
}
async function mutationResult(raw: unknown): Promise<ActionSaveResult> {
    const result = raw as {
        ok: boolean;
        action?: Row;
        current?: Row;
        code: string;
        error: string;
    };
    if (result.ok || result.code === 'conflict') {
        const row = result.ok ? result.action : result.current;
        if (!row)
            return { ok: false, code: 'unavailable', error: 'Could not load the saved action' };
        const [action] = await views([mapDeskAction(row)]);
        if (!action)
            return { ok: false, code: 'not_found', error: 'This action is unavailable' };
        return result.ok ? { ok: true, action } : { ok: false, code: 'conflict', error: result.error, current: action };
    }
    return { ok: false, code: result.code === 'validation' || result.code === 'not_found' ? result.code : 'unavailable', error: result.error || 'Could not save the action' };
}
function saveCommand(input: SaveActionInput) {
    const d = input.draft;
    return { id: input.id, link: input.link, title: d.title.trim(), description: d.description.trim() || null, ownerId: d.ownerId, dueDate: d.dueDate, state: d.state, stateReason: d.stateReason.trim() || null, changeReason: d.changeReason.trim() || null, saveUnassigned: d.saveUnassigned };
}
function fingerprint(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function saveHash(input: SaveActionInput, actor: string): string {
    return fingerprint({ operation: 'save', actor, expectedVersion: input.expectedVersion, command: saveCommand(input) });
}
function completionHash(id: string, expectedVersion: number, actor: string): string {
    return fingerprint({ operation: 'complete', actor, id, expectedVersion });
}
/** Exact replay is read-only. Both the current relation and the recorded snapshot must remain visible. */
async function replayRequest(requestId: string, hash: string, actor: string): Promise<ActionSaveResult | null> {
    const result = await requireDb().execute(sql `select action_id,actor_id,request_hash,after from desk_action_events where request_id=${requestId}::uuid`);
    const event = result.rows[0];
    if (!event)
        return null;
    if (event.actor_id !== actor || event.request_hash !== hash)
        return { ok: false, code: 'validation', error: 'Request was reused with different changes' };
    if (!await readAction(String(event.action_id)))
        return { ok: false, code: 'not_found', error: 'This action is unavailable' };
    return mutationResult({ ok: true, action: event.after });
}
export async function replayDeskAction(input: SaveActionInput): Promise<ActionSaveResult | null> {
    const actor = await requireResearchDirector();
    return replayRequest(input.requestId, saveHash(input, actor), actor);
}
export async function replayActionCompletion(id: string, expectedVersion: number, requestId: string): Promise<ActionSaveResult | null> {
    const actor = await requireResearchDirector();
    return replayRequest(requestId, completionHash(id, expectedVersion, actor), actor);
}
export async function readActionConflict(id: string): Promise<ActionSaveResult> {
    const current = await readAction(id);
    if (!current)
        return { ok: false, code: 'not_found', error: 'This action is unavailable' };
    const [view] = await views([current]);
    return view ? { ok: false, code: 'conflict', error: 'Another director changed this action. Review the current record.', current: view }
        : { ok: false, code: 'not_found', error: 'This action is unavailable' };
}
/** Completion has a stable public-command identity; SQL still atomically checks version and replay. */
export async function persistDeskAction(input: SaveActionInput, operation: 'save' | 'complete' = 'save'): Promise<ActionSaveResult> {
    const actor = await requireResearchDirector();
    const payload = JSON.stringify(saveCommand(input));
    const hash = operation === 'complete' ? completionHash(input.id, input.expectedVersion, actor) : saveHash(input, actor);
    const result = await requireDb().execute(sql `select desk_save_action(${actor},${input.requestId}::uuid,${hash},${input.expectedVersion},${payload}::jsonb) as result`);
    return mutationResult(result.rows[0]?.result);
}
export async function persistActionOperation(operation: 'detach' | 'primary', id: string, expectedVersion: number, requestId: string, retainedContext: string | null = null): Promise<ActionSaveResult> {
    const actor = await requireResearchDirector();
    const hash = createHash('sha256').update(JSON.stringify({ operation, actor, id, expectedVersion, retainedContext })).digest('hex');
    const result = await requireDb().execute(operation === 'detach' ? sql `select desk_detach_action(${actor},${requestId}::uuid,${hash},${id}::uuid,${expectedVersion},${retainedContext}) as result` : sql `select desk_select_primary(${actor},${requestId}::uuid,${hash},${id}::uuid,${expectedVersion}) as result`);
    return mutationResult(result.rows[0]?.result);
}
/** Batched next-action source for a board of live leads. */
export async function readPursuitActions(pursuitIds: string[]): Promise<ActionView[]> {
    await requireResearchDirector();
    if (!pursuitIds.length)
        return [];
    const ids = [...new Set(pursuitIds.map(id => workLinkSchema.parse({ kind: 'pursuit', id })).map(link => link.kind === 'general' ? '' : link.id))];
    const result = await requireDb().execute(sql `select a.* from desk_actions a where a.pursuit_id in(select value from jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)) and ${deskActionVisibilityPredicate()} order by a.due_date asc nulls last,a.created_at,a.id`);
    return views(result.rows.map(mapDeskAction));
}
