import { researchApi } from "@/lib/research/api";
import { searchReviewedEntities } from "@/lib/db/research-entities";
export async function GET(request: Request) {
  return researchApi(async () => {
    const params = new URL(request.url).searchParams;
    return searchReviewedEntities({
      query: params.get("query") ?? undefined,
      scheme: params.get("scheme") ?? undefined,
      value: params.get("value") ?? undefined,
    });
  });
}
