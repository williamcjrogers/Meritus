import { researchApi, requestJson, type IdContext } from "@/lib/research/api";
import { reviewResearchReport } from "@/lib/db/research-workflow";
export const POST = (r: Request, c: IdContext) =>
  researchApi(async () => {
    await reviewResearchReport((await c.params).id, await requestJson(r));
    return { ok: true };
  });
