import { dispatchDueWatchlists } from "../src/lib/research/watchlist-dispatch";
import { refreshResearchIntelligence } from "../src/lib/research/intelligence-dispatch";
import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { createResearchRepository } from "../src/lib/db/research";
import { requireDb } from "../src/lib/db";
import { dispatchDueResearch } from "../src/lib/research/dispatch";
import { runResearchChunk } from "../src/lib/research/runner";
import { stageResearchPage, cleanResearchStaging, processResearchInvalidation } from "../src/lib/research/evidence";
import { getConnector } from "../src/lib/research/sources/registry";
import { prepareSourceJob } from "../src/lib/research/sources/prepare";
import { invalidateResearchDependants } from "../src/lib/research/invalidation";
import { extractEnvelope } from "../src/lib/research/extract/pipeline";
const shutdown = new AbortController();
process.once("SIGTERM", () => shutdown.abort());
process.once("SIGINT", () => shutdown.abort());
const owner = `${hostname()}:${process.pid}:${randomUUID()}`;
async function main() {
    const db = createResearchRepository(requireDb());
    const budgetMs = Number(process.env.RESEARCH_WORKER_BUDGET_MS ?? 900000);
    if (!Number.isSafeInteger(budgetMs) || budgetMs < 1000 || budgetMs > 900000)
        throw new Error("invalid_worker_budget");
    while (!shutdown.signal.aborted) {
        try {
            await dispatchDueResearch();
            await refreshResearchIntelligence();
        await dispatchDueWatchlists();
            const pending = await db.listResearchInvalidations();
            if (pending[0])
                await processResearchInvalidation(pending[0].id, invalidateResearchDependants);
            await cleanResearchStaging();
            const result = await runResearchChunk({ lease: () => db.leaseResearchJob(owner), source: db.getResearchSource,
                prepare: prepareSourceJob, connector: getConnector, extract: extractEnvelope, stage: stageResearchPage, cleanup: cleanResearchStaging,
                commit: db.commitResearchPage, fail: db.failResearchJob, cancelled: db.researchJobCancelled, renew: db.renewResearchLease,
            }, shutdown.signal, budgetMs);
            process.stdout.write(JSON.stringify({ event: "research_chunk", status: result.status, at: new Date().toISOString() }) + "\n");
            if (result.status === "idle")
                await delay(10000, undefined, { signal: shutdown.signal });
        }
        catch {
            if (shutdown.signal.aborted)
                break;
            process.stderr.write(JSON.stringify({ event: "research_worker_error", code: "worker_failed" }) + "\n");
            await delay(10000, undefined, { signal: shutdown.signal }).catch(() => undefined);
        }
    }
}
void main().catch(() => { process.stderr.write("research_worker_configuration_failed\n"); process.exitCode = 1; });
