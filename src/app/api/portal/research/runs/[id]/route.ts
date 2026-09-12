import { z } from "zod";
import { researchApi, type IdContext } from "@/lib/research/api";
import { cancelResearchRun } from "@/lib/db/research";
export const DELETE = (_r: Request, c: IdContext) =>
  researchApi(async () => {
    await cancelResearchRun(z.uuid().parse((await c.params).id));
    return { ok: true };
  });
