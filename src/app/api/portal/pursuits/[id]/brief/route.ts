import { after, NextResponse } from "next/server";
import { defaultBriefDeps, runBrief } from "@/lib/brief/run-brief";
import { createBriefRun, expireStaleRuns, latestBrief, latestCompleteBrief } from "@/lib/db/briefs";
import { getPursuit } from "@/lib/db/pursuits";
import type { Brief } from "@/lib/db/schema";
import { isAiConfigured } from "@/lib/env";
import { requireDatabaseOr503, requirePortalUser, setupResponse } from "@/lib/portal/auth";

export const dynamic = "force-dynamic";
/** A run may take the full two minutes; the expiry sweep marks anything older as failed. */
export const maxDuration = 120;

type Context = { params: Promise<{ id: string }> };

export type BriefRunSummary = {
  id: string;
  status: Brief["status"];
  error: string | null;
  createdAt: string;
};

function runSummary(brief: Brief | null): BriefRunSummary | null {
  if (!brief) return null;
  return {
    id: brief.id,
    status: brief.status,
    error: brief.error,
    createdAt: brief.createdAt.toISOString(),
  };
}

export async function GET(_request: Request, context: Context) {
  const gate = await requirePortalUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;

  const { id } = await context.params;
  const pursuit = await getPursuit(id);
  if (!pursuit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await expireStaleRuns(id);
  const [run, brief] = await Promise.all([latestBrief(id), latestCompleteBrief(id)]);
  return NextResponse.json({ latestRun: runSummary(run), brief });
}

export async function POST(_request: Request, context: Context) {
  const gate = await requirePortalUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;
  if (!isAiConfigured()) return setupResponse("Vercel AI Gateway is not configured");

  const { id } = await context.params;
  const pursuit = await getPursuit(id);
  if (!pursuit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await expireStaleRuns(id);
  // A run already under way is handed back rather than doubled up.
  const current = await latestBrief(id);
  if (current?.status === "running") {
    return NextResponse.json({ id: current.id }, { status: 202 });
  }

  const run = await createBriefRun({ pursuitId: id, createdBy: gate.userId });
  after(() => runBrief(run.id, id, gate.userId, defaultBriefDeps()));
  return NextResponse.json({ id: run.id }, { status: 202 });
}
