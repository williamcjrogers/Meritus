import { NextRequest } from "next/server";
import { enqueueQuickQuestion, listResearchDesk } from "@/lib/db/research-quick";
import { researchApi, requestJson } from "@/lib/research/api";
import { quickQuestionSchema } from "@/lib/research/quick-request";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  return researchApi(actor => listResearchDesk(actor, request.nextUrl.searchParams.get("view") === "saved" ? "saved" : "new"));
}
export async function POST(request: NextRequest) {
  return researchApi(async actor => enqueueQuickQuestion(actor, quickQuestionSchema.parse(await requestJson(request))), 202);
}
