import { researchApi, type IdContext } from "@/lib/research/api";
import { getResearchReport } from "@/lib/db/research-workflow";
export const GET = (_r: Request, c: IdContext) =>
  researchApi(async () => getResearchReport((await c.params).id));
