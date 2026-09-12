import { z } from "zod";
import { researchApi, requestJson, type IdContext } from "@/lib/research/api";
import { convertResearchLead } from "@/lib/db/research-workflow";
export const POST = (r: Request, c: IdContext) =>
  researchApi(async (actor) => {
    const v = z
      .object({
        ownerId: z.string().min(1),
        reviewId: z.uuid(),
        singleEventReason: z.string().min(20).max(1000).nullable(),
      })
      .strict()
      .parse(await requestJson(r));
    return convertResearchLead({ ...v, signalId: (await c.params).id }, actor);
  }, 201);
