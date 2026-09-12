import { z } from "zod";
import { reviewOpportunity } from "@/lib/db/research-quick";
import { researchApi, requestJson, type IdContext } from "@/lib/research/api";
import { opportunityReviewSchema } from "@/lib/research/quick-request";
export async function PATCH(request: Request, context: IdContext) {
  return researchApi(async actor => {
    const id = z.uuid().parse((await context.params).id);
    await reviewOpportunity(actor, id, opportunityReviewSchema.parse(await requestJson(request)).action);
    return { saved: true };
  });
}
