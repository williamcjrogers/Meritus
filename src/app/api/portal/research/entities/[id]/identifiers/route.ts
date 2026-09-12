import { researchApi, requestJson, type IdContext } from "@/lib/research/api";
import { confirmEntityIdentifier } from "@/lib/db/research-entities";
export async function POST(request: Request, context: IdContext) {
  return researchApi(
    async () =>
      confirmEntityIdentifier(
        (await context.params).id,
        await requestJson(request),
      ),
    201,
  );
}
