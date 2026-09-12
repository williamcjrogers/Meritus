import { researchApi, requestJson, type IdContext } from "@/lib/research/api";
import { askResearchQuestion } from "@/lib/research/assistant";
export const maxDuration = 120;
export async function POST(request: Request, context: IdContext) {
  return researchApi(async () =>
    askResearchQuestion(
      (await context.params).id,
      await requestJson(request),
      request.signal,
    ),
  );
}
