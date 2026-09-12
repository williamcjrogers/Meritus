import { researchApi, requestJson } from "@/lib/research/api";
import { outcomeMetrics, recordOutcome } from "@/lib/db/research-workflow";
export const GET = (r: Request) =>
  researchApi(() => {
    const q = new URL(r.url).searchParams;
    return outcomeMetrics(
      q.get("from") ?? new Date(Date.now() - 90 * 86400000).toISOString(),
      q.get("to") ?? new Date().toISOString(),
    );
  });
export const POST = (r: Request) =>
  researchApi(
    async () => ({ id: await recordOutcome(await requestJson(r)) }),
    201,
  );
