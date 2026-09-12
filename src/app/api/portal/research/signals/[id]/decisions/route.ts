import { researchApi, requestJson, type IdContext } from "@/lib/research/api";
import {
  decideResearchSignal,
  researchDecisions,
} from "@/lib/db/research-intelligence";
export const GET = (_request: Request, context: IdContext) =>
  researchApi(async () => researchDecisions((await context.params).id));
export const POST = (request: Request, context: IdContext) =>
  researchApi(
    async () =>
      decideResearchSignal(
        (await context.params).id,
        await requestJson(request),
      ),
    201,
  );
