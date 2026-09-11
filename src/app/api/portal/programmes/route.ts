import { NextResponse } from "next/server";
import {
  completeProgrammeReport,
  createProgrammeReportRun,
  expireStaleProgrammeReports,
  failProgrammeReport,
  findCompleteReportByCacheKey,
  findProgrammeByHash,
  insertProgramme,
  latestReport,
  listProgrammes,
} from "@/lib/db/programmes";
import { getPursuit } from "@/lib/db/pursuits";
import { requireDatabaseOr503, requirePortalUser } from "@/lib/portal/auth";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, isAllowedProgrammeUpload } from "@/lib/programme/files";
import { hashBytes } from "@/lib/programme/hash";
import { runProgrammeFile, shouldReuseReport } from "@/lib/programme/run";
import { summariseProgramme } from "@/lib/programme/view";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const gate = await requirePortalUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;

  const pursuitId = new URL(request.url).searchParams.get("pursuitId");
  if (pursuitId) {
    const pursuit = await getPursuit(pursuitId);
    if (!pursuit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await listProgrammes(pursuitId);
  const items = await Promise.all(
    rows.map(async (row) => {
      await expireStaleProgrammeReports(row.id);
      return summariseProgramme(row, await latestReport(row.id));
    })
  );
  return NextResponse.json({ programmes: items });
}

export async function POST(request: Request) {
  const gate = await requirePortalUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart form" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: `File exceeds ${MAX_UPLOAD_LABEL}` }, { status: 400 });
  }
  if (!isAllowedProgrammeUpload(file.name, file.type || "application/octet-stream")) {
    return NextResponse.json(
      { error: "File type not allowed. Use Asta .pp or XML, P6 .xer, MSP XML, CSV, JSON, or a programme PDF." },
      { status: 400 }
    );
  }

  const pursuitIdRaw = form.get("pursuitId");
  const pursuitId = typeof pursuitIdRaw === "string" && pursuitIdRaw.trim() ? pursuitIdRaw.trim() : null;
  if (pursuitId) {
    const pursuit = await getPursuit(pursuitId);
    if (!pursuit) return NextResponse.json({ error: "Pursuit not found" }, { status: 404 });
  }

  const recompute = form.get("recompute") === "1";
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentHash = hashBytes(bytes);

  try {
    const existing = await findProgrammeByHash(contentHash, pursuitId);
    if (existing && !recompute) {
      await expireStaleProgrammeReports(existing.id);
      const report = await latestReport(existing.id);
      return NextResponse.json({
        programme: summariseProgramme(existing, report),
        reused: true,
        progress: report?.progress ?? { stage: existing.parseStatus === "failed" ? "failed" : "complete", percent: 100 },
      });
    }

    const run = runProgrammeFile(file.name, bytes);
    const row = await insertProgramme({
      id: crypto.randomUUID(),
      pursuitId,
      fileName: file.name,
      parse: run.parse,
      contentHash,
      createdBy: gate.userId,
    });

    if (run.parse.status === "failed" || !run.report) {
      return NextResponse.json(
        {
          programme: summariseProgramme(row, null),
          reused: false,
          progress: run.progress,
          error: run.error,
          issues: run.parse.issues,
        },
        { status: 201 }
      );
    }

    const cached = await findCompleteReportByCacheKey(run.cacheKey);
    if (cached && shouldReuseReport(cached.cacheKey, run.cacheKey, recompute)) {
      return NextResponse.json({
        programme: summariseProgramme(row, cached),
        reused: true,
        progress: cached.progress,
      });
    }

    const created = await createProgrammeReportRun({
      programmeId: row.id,
      cacheKey: run.cacheKey,
      createdBy: gate.userId,
    });
    try {
      await completeProgrammeReport(created.id, run.report);
    } catch (error) {
      await failProgrammeReport(created.id, error instanceof Error ? error.message : "Report store failed");
      throw error;
    }

    const stored = await latestReport(row.id);
    return NextResponse.json(
      {
        programme: summariseProgramme(row, stored),
        reused: false,
        progress: run.progress,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("programme ingest failed", error);
    const message = error instanceof Error ? error.message : "Programme ingest failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
