import { researchApi } from "@/lib/research/api";
import { listResearchDocuments } from "@/lib/db/research-workflow";
export async function GET() {
  return researchApi(listResearchDocuments);
}
