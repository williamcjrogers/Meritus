import { researchApi, requestJson, type IdContext } from "@/lib/research/api";
import { requestResearchReinstatement } from "@/lib/db/research-workflow";
export async function POST(request: Request, context: IdContext) {
  return researchApi(async () =>
    requestResearchReinstatement(
      (await context.params).id,
      await requestJson(request),
    ),
  );
}
