import { researchApi } from "@/lib/research/api";
import { searchCaseLaw } from "@/lib/research/case-law/service";
import { QCS_WORKSPACE_ID } from "@/lib/research/contracts";
export async function GET(request: Request) {
  return researchApi(async () => {
    const p = new URL(request.url).searchParams;
    return searchCaseLaw(QCS_WORKSPACE_ID, {
      query: p.get("query") ?? undefined,
      courts: p.getAll("court"),
      party: p.get("party") ?? undefined,
      judge: p.get("judge") ?? undefined,
      citation: p.get("citation") ?? undefined,
      from: p.get("from") || undefined,
      to: p.get("to") || undefined,
    });
  });
}
