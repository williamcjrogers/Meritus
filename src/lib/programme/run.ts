/**
 * Ingest then analyse, with a cache key and a hard budget. Persistence lives
 * in the db module; this function is the pure run the routes call.
 */

import { analyseProgramme, cacheKeyFor, emptyProgress, REPORT_BUDGET_MS } from "./engine";
import { ingestProgramme } from "./ingest";
import type { ParseResult, ProgrammeReport } from "./types";

export type ProgrammeRun = {
  parse: ParseResult;
  report: ProgrammeReport | null;
  cacheKey: string;
  progress: { stage: string; percent: number };
  error: string | null;
};

export function runProgrammeFile(fileName: string, bytes: Uint8Array, now = new Date(), budgetMs = REPORT_BUDGET_MS): ProgrammeRun {
  const parse = ingestProgramme(fileName, bytes);
  const cacheKey = cacheKeyFor(parse);
  if (parse.status === "failed") {
    return {
      parse,
      report: null,
      cacheKey,
      progress: { ...emptyProgress("failed"), percent: 0 },
      error: parse.issues[0]?.detail ?? "Programme ingest failed",
    };
  }
  try {
    const report = analyseProgramme(parse, now, budgetMs);
    return {
      parse,
      report,
      cacheKey,
      progress: report.progress,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Programme analysis failed";
    return {
      parse,
      report: null,
      cacheKey,
      progress: { stage: "failed", percent: 0 },
      error: message.slice(0, 500),
    };
  }
}

export function shouldReuseReport(existingKey: string | null | undefined, nextKey: string, recompute: boolean): boolean {
  if (recompute) return false;
  return Boolean(existingKey && existingKey === nextKey);
}
