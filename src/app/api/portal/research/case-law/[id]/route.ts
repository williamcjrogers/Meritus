import { researchApi, type IdContext } from "@/lib/research/api";
import { readCaseLaw } from "@/lib/research/case-law/service";
import { QCS_WORKSPACE_ID } from "@/lib/research/contracts";
import { z } from "zod";
export async function GET(_request: Request, context: IdContext) {
  return researchApi(async () =>
    readCaseLaw(QCS_WORKSPACE_ID, z.uuid().parse((await context.params).id)),
  );
}
