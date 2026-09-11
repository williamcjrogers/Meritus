import { describe, expect, it } from "vitest";
import type { ProgrammeReportRow, ProgrammeRow } from "@/lib/db/schema";
import { ENGINE_ID } from "./types";
import { detailProgramme, summariseProgramme } from "./view";

const NOW = new Date("2026-09-11T12:00:00Z");

function row(overrides: Partial<ProgrammeRow> = {}): ProgrammeRow {
  return {
    id: "prog-1",
    pursuitId: "p1",
    fileName: "rev.csv",
    format: "csv",
    contentHash: "abc",
    parseStatus: "parsed",
    parseEngine: "meritus_structured_v1",
    parseConfidence: 90,
    schedule: {
      name: "rev.csv",
      format: "csv",
      programmeType: "interim",
      evidence: "structured_export",
      activities: [{ id: "A", name: "A" }],
      links: [],
      calendars: [],
      impactEvents: [],
    },
    issues: [{ code: "x", severity: "high", title: "Issue", detail: "Detail" }],
    createdBy: "user_wr",
    createdAt: NOW,
    ...overrides,
  };
}

function report(overrides: Partial<ProgrammeReportRow> = {}): ProgrammeReportRow {
  return {
    id: "rep-1",
    programmeId: "prog-1",
    status: "complete",
    cacheKey: "key",
    progress: { stage: "complete", percent: 100 },
    report: {
      engine: ENGINE_ID,
      generatedAt: NOW.toISOString(),
      cacheKey: "key",
      parse: { status: "parsed", confidence: 90, engine: "meritus_structured_v1", format: "csv" },
      method: {
        selected: "planned_network",
        alternativesConsidered: [],
        criteria: ["criteria"],
        assumptions: [],
        limitations: [],
      },
      fences: [],
      health: {
        score: 88,
        level: "good",
        metrics: {
          totalActivities: 1,
          datedActivities: 0,
          actualDatedActivities: 0,
          milestones: 0,
          links: 0,
          calendars: 0,
          duplicateIds: 0,
          missingIds: 0,
          reverseDateActivities: 0,
          zeroDurationNonMilestone: 0,
          veryLongActivities: 0,
          negativeFloat: 0,
          openStarts: 1,
          suppliedCritical: 0,
        },
      },
      criticalPath: { computed: false, reason: "none", criticalIds: [], negativeFloatIds: [], totalFloatById: {} },
      figures: [],
      blocks: [],
      progress: { stage: "complete", percent: 100 },
    },
    error: null,
    createdBy: "user_wr",
    createdAt: NOW,
    completedAt: NOW,
    ...overrides,
  };
}

describe("programme view", () => {
  it("summarises without sending the schedule body to the list", () => {
    const item = summariseProgramme(row(), report());
    expect(item.activityCount).toBe(1);
    expect(item.highIssues).toBe(1);
    expect(item.report?.method).toBe("Planned network (no as-built)");
    expect(item.report?.healthScore).toBe(88);
    expect(item).not.toHaveProperty("schedule");
  });

  it("keeps the report body on the detail view only when the run completed", () => {
    expect(detailProgramme(row(), report()).reportBody?.engine).toBe(ENGINE_ID);
    expect(detailProgramme(row(), report({ status: "failed", report: null, error: "Timed out, try again" })).reportBody).toBeNull();
  });
});
