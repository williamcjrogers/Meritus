import { withResearchRun } from "@/lib/db/research";
import type { ConnectorPage, ExtractedEvidence, Lease, SourceConnector, SourceEnvelope, SourceRecord, StagedRecord } from "./contracts";
export type RunnerDeps = {
    lease(): Promise<Lease | null>;
    source(id: string): Promise<SourceRecord>;
    prepare(input: {
        source: SourceRecord;
        jobId: string;
        leaseToken: number;
        payload: Record<string, unknown>;
        signal: AbortSignal;
    }): Promise<Record<string, unknown>>;
    connector(provider: string, payload: unknown): SourceConnector | null;
    extract(e: SourceEnvelope): Promise<ExtractedEvidence>;
    stage(page: ConnectorPage, extract: (e: SourceEnvelope) => Promise<ExtractedEvidence>, signal?: AbortSignal): Promise<StagedRecord[]>;
    commit(input: {
        jobId: string;
        leaseToken: number;
        page: ConnectorPage;
        records: StagedRecord[];
        expectedRevision: number;
    }): Promise<boolean>;
    fail(job: Lease, error: unknown): Promise<void>;
    cancelled(id: string): Promise<boolean>;
    cleanup?(keys: string[]): Promise<unknown>;
    renew?(id: string, token: number): Promise<boolean>;
};
export async function runResearchChunk(deps: RunnerDeps, parent: AbortSignal, budgetMs = 90000): Promise<{
    status: "idle" | "committed" | "lease_lost" | "failed";
}> {
    if (!Number.isSafeInteger(budgetMs) || budgetMs < 1 || budgetMs > 900000)
        throw new Error("invalid_worker_budget");
    parent.throwIfAborted();
    const job = await deps.lease();
    if (!job)
        return { status: "idle" };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DOMException("Worker deadline", "TimeoutError")), budgetMs);
    const signal = AbortSignal.any([parent, controller.signal]);
    let checking = false;
    const watcher = setInterval(() => {
        if (checking)
            return;
        checking = true;
        void deps.cancelled(job.id).then(cancelled => { if (cancelled)
            controller.abort(new Error("cancelled")); }).catch(() => controller.abort(new Error("status_unavailable"))).finally(() => { checking = false; });
    }, 1000);
    let renewing = false;
    const renewal = deps.renew ? setInterval(() => {
        if (renewing)
            return;
        renewing = true;
        void deps.renew!(job.id, job.leaseToken).then(held => { if (!held)
            controller.abort(new Error("lease_lost")); }).catch(() => controller.abort(new Error("lease_lost"))).finally(() => { renewing = false; });
    }, 30000) : undefined;
    try {
        return await withResearchRun(job.runId, async () => {
            signal.throwIfAborted();
            if (await deps.cancelled(job.id))
                throw new Error("cancelled");
            const source = await deps.source(job.sourceId);
            if (source.status !== "ready")
                throw new Error("source_unavailable");
            const window = job.payload.window as {
                from?: unknown;
                to?: unknown;
            } | undefined;
            if (!window || typeof window.from !== "string" || typeof window.to !== "string" || !Number.isFinite(Date.parse(window.from)) || !Number.isFinite(Date.parse(window.to)) || Date.parse(window.from) > Date.parse(window.to))
                throw new Error("invalid_window");
            const frozenWindow = { from: window.from, to: window.to };
            const payload = await deps.prepare({ source, jobId: job.id, leaseToken: job.leaseToken, payload: job.payload, signal });
            signal.throwIfAborted();
            const connector = deps.connector(source.provider, payload);
            if (!connector)
                throw new Error("connector_unavailable");
            const page = await connector.fetchPage({ source, cursor: job.cursor, window: frozenWindow, signal });
            signal.throwIfAborted();
            const records = await deps.stage(page, deps.extract, signal);
            signal.throwIfAborted();
            if (await deps.cancelled(job.id))
                throw new Error("cancelled");
            const committed = await deps.commit({ jobId: job.id, leaseToken: job.leaseToken, page, records, expectedRevision: job.revision });
            if (committed && deps.cleanup)
                await deps.cleanup(records.map(record => record.objectKey)).catch(() => undefined);
            return { status: committed ? "committed" : "lease_lost" };
        });
    }
    catch (error) {
        await deps.fail(job, error);
        return { status: "failed" };
    }
    finally {
        clearTimeout(timer);
        clearInterval(watcher);
        if (renewal)
            clearInterval(renewal);
    }
}
