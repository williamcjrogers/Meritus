import { researchApi, requestJson, type IdContext } from "@/lib/research/api";
import { updateResearchSource } from "@/lib/db/research-workflow";
export const PATCH = (r: Request, c: IdContext) =>
  researchApi(async () => ({
    id: await updateResearchSource((await c.params).id, await requestJson(r)),
  }));
