import { NextResponse } from "next/server";
import { requireDatabaseOr503, requirePortalUser, setupResponse } from "@/lib/portal/auth";
import { getLead, latestResearch } from "@/lib/db/queries";
import { isAiConfigured } from "@/lib/env";
import { runLeadResearch } from "@/lib/research/run-research";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requirePortalUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;

  const { id } = await context.params;
  const lead = await getLead(id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ research: await latestResearch(id) });
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requirePortalUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;
  if (!isAiConfigured()) return setupResponse("OPENAI_API_KEY or AI_GATEWAY_API_KEY is not configured");

  const { id } = await context.params;
  const lead = await getLead(id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await runLeadResearch({ leadId: id, authorId: gate.userId });
  const status = result.error ? 502 : 200;
  return NextResponse.json(result, { status });
}
