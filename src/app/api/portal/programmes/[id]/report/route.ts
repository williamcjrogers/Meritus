import { NextResponse } from "next/server";
import {
  completeProgrammeReport,
  createProgrammeReportRun,
  expireStaleProgrammeReports,
  failProgrammeReport,
  findCompleteReportByCacheKey,
  getProgramme,
  latestReport,
  parseFromRow,
} from "@/lib/db/programmes";
import { requireDatabaseOr503, requirePortalUser } from "@/lib/portal/auth";
import { analyseProgramme, cacheKeyFor } from "@/lib/programme/engine";
import { shouldReuseReport } from "@/lib/programme/run";
import { detailProgramme } from "@/lib/programme/view";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requirePortalUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;

  const { id } = await context.params;
  const row = await getProgramme(id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await expireStaleProgrammeReports(id);
  const current = await latestReport(id);
  if (current?.status === "running") {
    return NextResponse.json({ id: current.id, progress: current.progress }, { status: 202 });
  }

  const recompute = new URL(request.url).searchParams.get("recompute") === "1";
  const parse = parseFromRow(row);
  const key = cacheKeyFor(parse);

  if (parse.status === "failed") {
    return NextResponse.json({ error: row.issues[0]?.detail ?? "Programme ingest failed", issues: row.issues }, { status: 409 });
  }

  const cached = await findCompleteReportByCacheKey(key);
  if (cached && shouldReuseReport(cached.cacheKey, key, recompute)) {
    return NextResponse.json({ programme: detailProgramme(row, cached), reused: true, progress: cached.progress });
  }

  const created = await createProgrammeReportRun({ programmeId: row.id, cacheKey: key, createdBy: gate.userId });
  try {
    const report = analyseProgramme(parse);
    await completeProgrammeReport(created.id, report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Programme analysis failed";
    await failProgrammeReport(created.id, message);
    return NextResponse.json({ error: message, id: created.id, progress: { stage: "failed", percent: 0 } }, { status: 500 });
  }

  const stored = await latestReport(row.id);
  return NextResponse.json({ programme: detailProgramme(row, stored), reused: false, progress: stored?.progress });
}
