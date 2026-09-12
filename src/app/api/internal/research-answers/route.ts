import { NextRequest, NextResponse } from "next/server";
import { validResearchCronAuth } from "@/lib/research/cron-auth";
import { runQuickResearchQuestion } from "@/lib/research/quick-worker";
export const runtime = "nodejs";
export const maxDuration = 120;
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "scheduler_unconfigured" }, { status: 503, headers });
  if (!validResearchCronAuth(request.headers.get("authorization"), secret)) return NextResponse.json({ error: "unauthorised" }, { status: 401, headers });
  try {
    const result = await runQuickResearchQuestion(request.signal);
    return NextResponse.json(result, { headers });
  } catch {
    return NextResponse.json({ error: "research_answer_worker_failed" }, { status: 503, headers });
  }
}
