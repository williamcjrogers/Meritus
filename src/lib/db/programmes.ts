import { and, desc, eq, sql } from "drizzle-orm";
import { PROGRAMME_FORMATS, type ParseResult, type ProgrammeFormat, type ProgrammeReport } from "@/lib/programme/types";
import { requireDb } from "./index";
import { programmeReports, programmes, type ProgrammeReportRow, type ProgrammeRow } from "./schema";

export async function listProgrammes(pursuitId?: string | null): Promise<ProgrammeRow[]> {
  const db = requireDb();
  const query = db.select().from(programmes).orderBy(desc(programmes.createdAt));
  if (pursuitId) {
    return db
      .select()
      .from(programmes)
      .where(eq(programmes.pursuitId, pursuitId))
      .orderBy(desc(programmes.createdAt));
  }
  return query;
}

export async function getProgramme(id: string): Promise<ProgrammeRow | null> {
  const db = requireDb();
  const [row] = await db.select().from(programmes).where(eq(programmes.id, id)).limit(1);
  return row ?? null;
}

export async function findProgrammeByHash(contentHash: string, pursuitId?: string | null): Promise<ProgrammeRow | null> {
  const db = requireDb();
  const [row] = await db
    .select()
    .from(programmes)
    .where(
      pursuitId
        ? and(eq(programmes.contentHash, contentHash), eq(programmes.pursuitId, pursuitId))
        : and(eq(programmes.contentHash, contentHash), sql`${programmes.pursuitId} is null`)
    )
    .orderBy(desc(programmes.createdAt))
    .limit(1);
  return row ?? null;
}

export async function insertProgramme(values: {
  id: string;
  pursuitId?: string | null;
  fileName: string;
  parse: ParseResult;
  contentHash: string;
  createdBy: string;
}): Promise<ProgrammeRow> {
  const db = requireDb();
  const [row] = await db
    .insert(programmes)
    .values({
      id: values.id,
      pursuitId: values.pursuitId ?? null,
      fileName: values.fileName,
      format: values.parse.format,
      contentHash: values.contentHash,
      parseStatus: values.parse.status,
      parseEngine: values.parse.engine,
      parseConfidence: values.parse.confidence,
      schedule: values.parse.schedule,
      issues: values.parse.issues,
      createdBy: values.createdBy,
    })
    .returning();
  return row;
}

export async function latestReport(programmeId: string): Promise<ProgrammeReportRow | null> {
  const db = requireDb();
  const [row] = await db
    .select()
    .from(programmeReports)
    .where(eq(programmeReports.programmeId, programmeId))
    .orderBy(desc(programmeReports.createdAt))
    .limit(1);
  return row ?? null;
}

export async function latestCompleteReport(programmeId: string): Promise<ProgrammeReportRow | null> {
  const db = requireDb();
  const [row] = await db
    .select()
    .from(programmeReports)
    .where(and(eq(programmeReports.programmeId, programmeId), eq(programmeReports.status, "complete")))
    .orderBy(desc(programmeReports.createdAt))
    .limit(1);
  return row ?? null;
}

export async function findCompleteReportByCacheKey(cacheKey: string): Promise<ProgrammeReportRow | null> {
  const db = requireDb();
  const [row] = await db
    .select()
    .from(programmeReports)
    .where(and(eq(programmeReports.cacheKey, cacheKey), eq(programmeReports.status, "complete")))
    .orderBy(desc(programmeReports.createdAt))
    .limit(1);
  return row ?? null;
}

/** Marks runs still "running" after two minutes as failed so a stuck run never blocks a new one. */
export async function expireStaleProgrammeReports(programmeId: string): Promise<void> {
  const db = requireDb();
  await db
    .update(programmeReports)
    .set({ status: "failed", error: "Timed out, try again", progress: { stage: "failed", percent: 0 } })
    .where(
      and(
        eq(programmeReports.programmeId, programmeId),
        eq(programmeReports.status, "running"),
        sql`${programmeReports.createdAt} < now() - interval '2 minutes'`
      )
    );
}

export async function createProgrammeReportRun(values: {
  programmeId: string;
  cacheKey: string;
  createdBy: string;
}): Promise<ProgrammeReportRow> {
  const db = requireDb();
  const [row] = await db
    .insert(programmeReports)
    .values({
      id: crypto.randomUUID(),
      programmeId: values.programmeId,
      cacheKey: values.cacheKey,
      progress: { stage: "running", percent: 20 },
      createdBy: values.createdBy,
    })
    .returning();
  return row;
}

export async function completeProgrammeReport(id: string, report: ProgrammeReport): Promise<void> {
  const db = requireDb();
  await db
    .update(programmeReports)
    .set({
      status: "complete",
      error: null,
      report,
      progress: report.progress,
      completedAt: new Date(),
    })
    .where(eq(programmeReports.id, id));
}

export async function failProgrammeReport(id: string, error: string): Promise<void> {
  const db = requireDb();
  await db
    .update(programmeReports)
    .set({ status: "failed", error, progress: { stage: "failed", percent: 0 }, completedAt: new Date() })
    .where(eq(programmeReports.id, id));
}

function asFormat(value: string): ProgrammeFormat {
  return (PROGRAMME_FORMATS as readonly string[]).includes(value) ? (value as ProgrammeFormat) : "unknown";
}

export function parseFromRow(row: ProgrammeRow): ParseResult {
  const format = asFormat(row.format);
  return {
    status: row.parseStatus,
    engine: row.parseEngine,
    confidence: row.parseConfidence,
    format,
    schedule: row.schedule ?? {
      name: row.fileName,
      format,
      programmeType: "unknown",
      evidence: "none",
      activities: [],
      links: [],
      calendars: [],
      impactEvents: [],
    },
    issues: row.issues ?? [],
  };
}
