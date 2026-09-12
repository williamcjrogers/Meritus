import { z } from "zod";
import { researchApi, requestJson, type IdContext } from "@/lib/research/api";
import { saveWatchlist } from "@/lib/db/research-workflow";
export const PATCH = (r: Request, c: IdContext) =>
  researchApi(async () => {
    const raw = z
      .object({ revision: z.number().int().nonnegative(), value: z.unknown() })
      .parse(await requestJson(r));
    return {
      id: await saveWatchlist(raw.value, (await c.params).id, raw.revision),
    };
  });

import { deleteResearchWatchlist } from '@/lib/db/research-workflow';
export const DELETE=(_request:Request,c:IdContext)=>researchApi(async()=>deleteResearchWatchlist((await c.params).id));
