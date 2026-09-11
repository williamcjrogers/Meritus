import { NextResponse } from "next/server";
import { expireStaleProgrammeReports, getProgramme, latestCompleteReport, latestReport } from "@/lib/db/programmes";
import { requireDatabaseOr503, requirePortalUser } from "@/lib/portal/auth";
import { detailProgramme } from "@/lib/programme/view";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requirePortalUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;

  const { id } = await context.params;
  const row = await getProgramme(id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await expireStaleProgrammeReports(id);
  const [run, complete] = await Promise.all([latestReport(id), latestCompleteReport(id)]);
  return NextResponse.json({
    programme: detailProgramme(row, complete ?? run),
    latestRun: run
      ? {
          id: run.id,
          status: run.status,
          error: run.error,
          progress: run.progress,
          createdAt: run.createdAt.toISOString(),
        }
      : null,
  });
}
