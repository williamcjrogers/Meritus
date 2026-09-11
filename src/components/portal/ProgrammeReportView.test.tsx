import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ProgrammeDetail } from "@/lib/programme/view";
import { ENGINE_ID } from "@/lib/programme/types";
import { ProgrammeReportView } from "./ProgrammeReportView";

function detail(overrides: Partial<ProgrammeDetail> = {}): ProgrammeDetail {
  return {
    id: "prog-1",
    fileName: "gantt.pdf",
    format: "pdf",
    parseStatus: "partial",
    parseEngine: "meritus_pdf_markup_v1",
    parseConfidence: 15,
    issueCount: 1,
    highIssues: 1,
    activityCount: 0,
    createdAt: "2026-09-11T12:00:00.000Z",
    issues: [
      {
        code: "pdf_not_schedule_evidence",
        severity: "high",
        title: "PDF is mark-up, not a schedule",
        detail: "Float is not computed from a Gantt PDF.",
      },
    ],
    report: null,
    reportBody: null,
    ...overrides,
  };
}

describe("ProgrammeReportView", () => {
  it("shows ingest issues and an empty-state note when no activities were mapped", () => {
    render(<ProgrammeReportView detail={detail()} />);
    expect(screen.getByText(/PDF is mark-up, not a schedule/)).toBeInTheDocument();
    expect(screen.getByText(/No activity-level schedule was mapped/)).toBeInTheDocument();
  });

  it("shows a running status and cites figures when a report is present", () => {
    render(
      <ProgrammeReportView
        detail={detail({
          report: {
            id: "run-1",
            status: "running",
            error: null,
            cacheKey: "k",
            progress: { stage: "hygiene", percent: 40 },
            method: null,
            healthScore: null,
            healthLevel: null,
            createdAt: "2026-09-11T12:00:00.000Z",
          },
          reportBody: {
            engine: ENGINE_ID,
            generatedAt: "2026-09-11T12:00:00.000Z",
            cacheKey: "k",
            parse: { status: "parsed", confidence: 90, engine: "meritus_structured_v1", format: "csv" },
            method: {
              selected: "health_only",
              alternativesConsidered: [],
              criteria: ["SCL Delay and Disruption Protocol (2nd Edition, 2017): no single methodology is preferred."],
              assumptions: [],
              limitations: [],
            },
            fences: [{ id: "eot_not_money", title: "EOT is not money", text: "Days are not sterling." }],
            health: {
              score: 70,
              level: "fair",
              metrics: {
                totalActivities: 1,
                datedActivities: 1,
                actualDatedActivities: 0,
                milestones: 0,
                links: 0,
                calendars: 1,
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
            figures: [
              {
                id: "fig.activities",
                label: "Activities mapped",
                value: 1,
                unit: "activities",
                blockId: "blk.hygiene",
                basis: "Count of activity rows.",
              },
            ],
            blocks: [{ id: "blk.hygiene", title: "Float and data hygiene", findings: ["One activity."] }],
            progress: { stage: "complete", percent: 100 },
          },
        })}
      />
    );
    expect(screen.getByRole("status")).toHaveTextContent("hygiene");
    expect(screen.getByText("fig.activities → blk.hygiene")).toBeInTheDocument();
    expect(screen.getByText("EOT is not money")).toBeInTheDocument();
  });
});
