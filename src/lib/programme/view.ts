import type { ProgrammeReportRow, ProgrammeRow } from "@/lib/db/schema";
import { methodLabel } from "./engine";
import type { ProgrammeIssue, ProgrammeReport } from "./types";

export type ProgrammeListItem = {
  id: string;
  fileName: string;
  format: string;
  parseStatus: ProgrammeRow["parseStatus"];
  parseEngine: string;
  parseConfidence: number;
  issueCount: number;
  highIssues: number;
  activityCount: number;
  createdAt: string;
  report: ProgrammeReportSummary | null;
};

export type ProgrammeReportSummary = {
  id: string;
  status: ProgrammeReportRow["status"];
  error: string | null;
  cacheKey: string;
  progress: { stage: string; percent: number } | null;
  method: string | null;
  healthScore: number | null;
  healthLevel: string | null;
  createdAt: string;
};

export type ProgrammeDetail = ProgrammeListItem & {
  issues: ProgrammeIssue[];
  reportBody: ProgrammeReport | null;
};

export function summariseProgramme(row: ProgrammeRow, report: ProgrammeReportRow | null): ProgrammeListItem {
  const body = report?.status === "complete" ? report.report : null;
  return {
    id: row.id,
    fileName: row.fileName,
    format: row.format,
    parseStatus: row.parseStatus,
    parseEngine: row.parseEngine,
    parseConfidence: row.parseConfidence,
    issueCount: row.issues?.length ?? 0,
    highIssues: (row.issues ?? []).filter((issue) => issue.severity === "high").length,
    activityCount: row.schedule?.activities.length ?? 0,
    createdAt: row.createdAt.toISOString(),
    report: report
      ? {
          id: report.id,
          status: report.status,
          error: report.error,
          cacheKey: report.cacheKey,
          progress: report.progress,
          method: body ? methodLabel(body.method.selected) : null,
          healthScore: body?.health.score ?? null,
          healthLevel: body?.health.level ?? null,
          createdAt: report.createdAt.toISOString(),
        }
      : null,
  };
}

export function detailProgramme(row: ProgrammeRow, report: ProgrammeReportRow | null): ProgrammeDetail {
  return {
    ...summariseProgramme(row, report),
    issues: row.issues ?? [],
    reportBody: report?.status === "complete" ? report.report : null,
  };
}
