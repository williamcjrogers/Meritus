import { describe, expect, it } from "vitest";
import { analyseProgramme, cacheKeyFor, computeCriticalPath, hygiene, selectMethod } from "./engine";
import { ingestProgramme } from "./ingest";
import type { ParseResult, Schedule } from "./types";
import { ENGINE_ID } from "./types";

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function schedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    name: "test",
    format: "csv",
    programmeType: "interim",
    evidence: "structured_export",
    activities: [],
    links: [],
    calendars: [{ id: "cal-5d", name: "Five-day week", workingDays: [1, 2, 3, 4, 5] }],
    impactEvents: [],
    ...overrides,
  };
}

function parsed(overrides: Partial<ParseResult> & { schedule?: Schedule } = {}): ParseResult {
  return {
    status: "parsed",
    engine: "meritus_structured_v1",
    confidence: 90,
    format: "csv",
    issues: [],
    schedule: overrides.schedule ?? schedule(),
    ...overrides,
  };
}

const NETWORK = parsed({
  schedule: schedule({
    activities: [
      { id: "A", name: "Enabling", start: "2020-01-06", finish: "2020-01-10", durationDays: 5 },
      { id: "B", name: "Frame", start: "2020-01-13", finish: "2020-01-24", durationDays: 10 },
      { id: "C", name: "Float work", start: "2020-01-13", finish: "2020-01-17", durationDays: 5 },
    ],
    links: [
      { predecessorId: "A", successorId: "B", type: "FS", lagDays: 0 },
      { predecessorId: "A", successorId: "C", type: "FS", lagDays: 0 },
    ],
  }),
});

describe("method selection", () => {
  it("refuses a method on PDF mark-up", () => {
    const pdf = ingestProgramme("gantt.pdf", bytes("%PDF-1.4\nBT (Critical path) Tj ET"));
    expect(selectMethod(pdf).selected).toBe("not_selected");
    expect(selectMethod(pdf).limitations[0]).toMatch(/PDF/);
  });

  it("refuses a method on a native Asta container with no rows", () => {
    const header = "SQLite format 3\u0000";
    const pp = ingestProgramme("rev.pp", bytes(`${header}\nCREATE TABLE BAR(id INTEGER)\nCREATE TABLE LINK(id INTEGER)\n`));
    expect(selectMethod(pp).selected).toBe("not_selected");
    expect(selectMethod(pp).limitations.join(" ")).toMatch(/Asta/);
  });

  it("selects TIA when fragnets exist on a planned network", () => {
    const decision = selectMethod(
      parsed({
        schedule: schedule({
          impactEvents: ["CE-047"],
          activities: NETWORK.schedule.activities,
          links: NETWORK.schedule.links,
        }),
      })
    );
    expect(decision.selected).toBe("tia");
    expect(decision.assumptions.join(" ")).toMatch(/fragnet/i);
  });

  it("selects windows when a data date and both date sets exist", () => {
    const decision = selectMethod(
      parsed({
        schedule: schedule({
          dataDate: "2020-02-01",
          activities: [
            { id: "A", name: "A", start: "2020-01-06", finish: "2020-01-10", actualFinish: "2020-01-12", durationDays: 5 },
            { id: "B", name: "B", start: "2020-01-13", finish: "2020-01-24", durationDays: 10 },
          ],
          links: [{ predecessorId: "A", successorId: "B", type: "FS", lagDays: 0 }],
        }),
      })
    );
    expect(decision.selected).toBe("windows");
  });

  it("selects collapsed as-built when most rows carry actuals and logic", () => {
    const decision = selectMethod(
      parsed({
        schedule: schedule({
          programmeType: "as_built",
          activities: [
            { id: "A", name: "A", start: "2020-01-06", finish: "2020-01-10", actualStart: "2020-01-06", actualFinish: "2020-01-12", durationDays: 5 },
            { id: "B", name: "B", start: "2020-01-13", finish: "2020-01-24", actualStart: "2020-01-14", actualFinish: "2020-01-28", durationDays: 10 },
          ],
          links: [{ predecessorId: "A", successorId: "B", type: "FS", lagDays: 0 }],
        }),
      })
    );
    expect(decision.selected).toBe("cab");
  });

  it("selects as-planned versus as-built from dates without inventing a preferred method", () => {
    const decision = selectMethod(
      parsed({
        schedule: schedule({
          activities: [
            { id: "A", name: "A", start: "2020-01-06", finish: "2020-01-10", actualFinish: "2020-01-20", durationDays: 5 },
          ],
        }),
      })
    );
    expect(decision.selected).toBe("as_planned_vs_as_built");
    expect(decision.limitations.join(" ")).toMatch(/Without links/);
    expect(decision.criteria.some((line) => /no single methodology/i.test(line))).toBe(true);
  });

  it("falls back to planned network or health only", () => {
    expect(selectMethod(NETWORK).selected).toBe("planned_network");
    expect(
      selectMethod(
        parsed({
          schedule: schedule({
            activities: [{ id: "A", name: "A" }],
          }),
        })
      ).selected
    ).toBe("health_only");
  });
});

describe("critical path", () => {
  it("marks the long chain critical and leaves float on the short branch", () => {
    const path = computeCriticalPath(NETWORK, hygiene(NETWORK.schedule));
    expect(path.computed).toBe(true);
    expect(path.criticalIds).toEqual(["A", "B"]);
    expect(path.totalFloatById.C).toBe(5);
    expect(path.totalFloatById.B).toBe(0);
  });

  it("does not invent a critical path from PDF mark-up or from bars without links", () => {
    const pdf = ingestProgramme("gantt.pdf", bytes("%PDF-1.4\nBT (Critical) Tj ET"));
    expect(computeCriticalPath(pdf, hygiene(pdf.schedule)).reason).toMatch(/PDF/);
    const bars = parsed({
      schedule: schedule({
        activities: [{ id: "A", name: "A", start: "2020-01-06", finish: "2020-01-10", durationDays: 5, suppliedCritical: true }],
      }),
    });
    expect(computeCriticalPath(bars, hygiene(bars.schedule)).computed).toBe(false);
    expect(computeCriticalPath(bars, hygiene(bars.schedule)).criticalIds).toEqual([]);
  });
});

describe("report", () => {
  it("cites every figure back to a block and fences EOT from money", () => {
    const withActuals = parsed({
      schedule: schedule({
        activities: [
          { id: "A", name: "Enabling", start: "2020-01-06", finish: "2020-01-10", actualFinish: "2020-01-20", durationDays: 5 },
          { id: "B", name: "Frame", start: "2020-01-13", finish: "2020-01-24", durationDays: 10 },
        ],
        links: [{ predecessorId: "A", successorId: "B", type: "FS", lagDays: 0 }],
      }),
    });
    const report = analyseProgramme(withActuals, new Date("2026-09-11T12:00:00Z"));
    expect(report.engine).toBe(ENGINE_ID);
    expect(report.figures.length).toBeGreaterThan(0);
    expect(report.figures.every((fig) => fig.blockId.startsWith("blk."))).toBe(true);
    expect(report.blocks.map((block) => block.id)).toContain("blk.critical_path");
    expect(report.fences.map((fence) => fence.id)).toEqual(
      expect.arrayContaining(["eot_not_money", "concurrency_is_fact", "no_universal_method"])
    );
    expect(report.fences.find((fence) => fence.id === "eot_not_money")?.text).toMatch(/not convert days into sterling/i);
    const variance = report.figures.find((fig) => fig.id === "fig.planned_vs_actual_finish");
    expect(variance?.blockId).toBe("blk.as_planned_vs_as_built");
    expect(variance?.basis).toMatch(/Not an EOT and not money/);
    expect(report.method.selected).toBe("as_planned_vs_as_built");
  });

  it("is stable under the same schedule hash and empty on a failed parse", () => {
    const a = cacheKeyFor(NETWORK);
    const b = cacheKeyFor(NETWORK);
    expect(a).toBe(b);
    const empty = analyseProgramme(
      parsed({
        status: "empty",
        schedule: schedule({ evidence: "none" }),
      })
    );
    expect(empty.method.selected).toBe("not_selected");
    expect(empty.health.level).toBe("empty");
    expect(empty.criticalPath.computed).toBe(false);
  });

  it("adds the PDF fence when the source is mark-up", () => {
    const report = analyseProgramme(ingestProgramme("gantt.pdf", bytes("%PDF-1.4\nBT (Bar chart) Tj ET")));
    expect(report.fences.some((fence) => fence.id === "no_pdf_critical_path")).toBe(true);
    expect(report.figures.find((fig) => fig.id === "fig.critical")?.value).toBe(0);
  });
});
