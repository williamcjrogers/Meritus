import { dispatchDueWatchlists } from "@/lib/research/watchlist-dispatch";
import { refreshResearchIntelligence } from "@/lib/research/intelligence-dispatch";
import { validResearchCronAuth } from "@/lib/research/cron-auth";
import { NextRequest, NextResponse } from "next/server";
import { createResearchRepository, getResearchOperationalStatus } from "@/lib/db/research";
import { requireDb } from "@/lib/db";
import { dispatchDueResearch } from "@/lib/research/dispatch";
import { runResearchChunk } from "@/lib/research/runner";
import { stageResearchPage, cleanResearchStaging, processResearchInvalidation } from "@/lib/research/evidence";
import { getConnector } from "@/lib/research/sources/registry";
import { prepareSourceJob } from "@/lib/research/sources/prepare";
import { invalidateResearchDependants } from "@/lib/research/invalidation";
import { extractEnvelope } from "@/lib/research/extract/pipeline";
export const runtime = "nodejs";
export const maxDuration = 120;
const privateHeaders = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
export async function GET(request: NextRequest) {
    const startedAt = Date.now();
    const secret = process.env.CRON_SECRET;
    if (!secret)
        return NextResponse.json({ error: "scheduler_unconfigured" }, { status: 503, headers: privateHeaders });
    if (!validResearchCronAuth(request.headers.get("authorization"), secret))
        return NextResponse.json({ error: "unauthorised" }, { status: 401, headers: privateHeaders });
    try {
        const dispatched = await dispatchDueResearch();
        await refreshResearchIntelligence();
        await dispatchDueWatchlists();
        const repository = createResearchRepository(requireDb());
        const pending = await repository.listResearchInvalidations();
        if (pending[0])
            await processResearchInvalidation(pending[0].id, invalidateResearchDependants);
        const abandoned = await repository.listUnclaimedResearchObjects();
        if (abandoned[0])
            await cleanResearchStaging([abandoned[0].objectKey]);
        const remainingMs = 110000 - (Date.now() - startedAt);
        const chunk = remainingMs < 15000 ? { status: "deferred" } : await runResearchChunk({
            lease: () => repository.leaseResearchJob(`hosted:${crypto.randomUUID()}`), source: repository.getResearchSource,
            prepare: prepareSourceJob, connector: getConnector, extract: extractEnvelope, stage: stageResearchPage, cleanup: keys => cleanResearchStaging(keys.slice(0, 1)),
            commit: repository.commitResearchPage, fail: repository.failResearchJob, cancelled: repository.researchJobCancelled, renew: repository.renewResearchLease,
        }, request.signal, Math.min(90000, remainingMs - 10000));
        return NextResponse.json({ ...dispatched, chunk: chunk.status, health: await getResearchOperationalStatus() }, { headers: privateHeaders });
    }
    catch {
        return NextResponse.json({ error: "research_worker_failed" }, { status: 503, headers: privateHeaders });
    }
}
