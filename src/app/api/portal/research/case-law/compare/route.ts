import { researchApi, requestJson } from "@/lib/research/api";
import { compareAuthorities } from "@/lib/research/case-law/service";
import { QCS_WORKSPACE_ID } from "@/lib/research/contracts";
import { z } from "zod";
export async function POST(request: Request) {
  return researchApi(async () => {
    const v = z
      .object({
        documentIds: z.array(z.uuid()).min(2).max(5),
        issue: z.string().trim().min(1).max(1000),
      })
      .strict()
      .parse(await requestJson(request));
    return compareAuthorities(QCS_WORKSPACE_ID, v.documentIds, v.issue);
  });
}
