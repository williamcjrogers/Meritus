import { researchApi, requestJson, type IdContext } from "@/lib/research/api";
import { reviewSignal } from "@/lib/db/research-workflow";
export const POST = (r: Request, c: IdContext) =>
  researchApi(async () => ({
    reviewId: await reviewSignal((await c.params).id, await requestJson(r)),
  }));
