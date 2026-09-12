import { dispatchValidatedResearch, listDueResearchSources, markResearchSourceUnavailable, type DueResearchSource } from "@/lib/db/research";
import { validateSourceSelection } from "./sources/selection";
export type DispatchDeps = {
    due(now: Date): Promise<DueResearchSource[]>;
    validate(provider: string, selection: unknown): {
        valid: boolean;
        reason?: string;
    };
    credential(ref: string): boolean;
    unavailable(id: string, reason: string, updatedAt: string): Promise<void>;
    dispatch(now: Date, validated: {
        id: string;
        updatedAt: string;
    }[]): Promise<{
        source_id: string;
        job_id: string;
        enqueued: boolean;
    }[]>;
};
export const defaultDispatchDeps: DispatchDeps = {
    due: listDueResearchSources, validate: validateSourceSelection,
    credential: ref => Boolean(process.env[ref]), unavailable: markResearchSourceUnavailable, dispatch: dispatchValidatedResearch,
};
export async function dispatchDueResearch(now = new Date(), deps: DispatchDeps = defaultDispatchDeps) {
    if (!Number.isFinite(now.getTime()))
        throw new Error("invalid_dispatch_date");
    const sources = await deps.due(now);
    const valid: {
        id: string;
        updatedAt: string;
    }[] = [];
    let unavailable = 0;
    for (const source of sources) {
        const selection = deps.validate(source.provider, source.selection);
        const reason = source.credentialRef && !deps.credential(source.credentialRef) ? "credential_missing" : !selection.valid ? "selection_invalid" : !Number.isFinite(Date.parse(source.backfillStart)) || Date.parse(source.backfillStart) > now.getTime() ? "backfill_start_invalid" : null;
        if (reason) {
            await deps.unavailable(source.id, reason, source.updatedAt);
            unavailable++;
        }
        else
            valid.push({ id: source.id, updatedAt: source.updatedAt });
    }
    const dispatched = await deps.dispatch(now, valid);
    return { enqueued: dispatched.filter(item => item.enqueued).length, active: dispatched.filter(item => !item.enqueued).length, unavailable };
}
