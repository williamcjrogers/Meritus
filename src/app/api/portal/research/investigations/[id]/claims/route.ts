import { researchApi, requestJson, type IdContext } from "@/lib/research/api";
import { proposeClaim } from "@/lib/db/research-workflow";
export const POST = (r: Request, c: IdContext) =>
  researchApi(
    async () => ({
      id: await proposeClaim((await c.params).id, await requestJson(r)),
    }),
    201,
  );
