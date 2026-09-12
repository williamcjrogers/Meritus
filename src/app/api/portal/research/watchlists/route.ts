import { researchApi, requestJson } from "@/lib/research/api";
import { listWatchlists, saveWatchlist } from "@/lib/db/research-workflow";
export const GET = () => researchApi(() => listWatchlists());
export const POST = (r: Request) =>
  researchApi(
    async () => ({ id: await saveWatchlist(await requestJson(r)) }),
    201,
  );
