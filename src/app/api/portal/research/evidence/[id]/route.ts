import { researchApi, type IdContext } from "@/lib/research/api";
import { readResearchPassage } from "@/lib/db/research-workflow";
export const GET = (_r: Request, c: IdContext) =>
  researchApi(async () => readResearchPassage((await c.params).id));
