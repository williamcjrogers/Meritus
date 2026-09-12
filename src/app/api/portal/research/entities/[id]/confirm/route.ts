import { researchApi, requestJson, type IdContext } from "@/lib/research/api";
import { confirmWorkflowEntity } from "@/lib/db/research-workflow";
export const POST = (r: Request, c: IdContext) =>
  researchApi(async () => {
    await confirmWorkflowEntity((await c.params).id, await requestJson(r));
    return { ok: true };
  });
