import { z } from "zod";
import { setQuickMonitoring } from "@/lib/db/research-quick";
import { researchApi, requestJson, type IdContext } from "@/lib/research/api";
import { quickMonitoringSchema } from "@/lib/research/quick-request";
export async function PATCH(request: Request, context: IdContext) {
  return researchApi(async actor => {
    const id = z.uuid().parse((await context.params).id);
    await setQuickMonitoring(actor, id, quickMonitoringSchema.parse(await requestJson(request)).monitoring);
    return { saved: true };
  });
}
