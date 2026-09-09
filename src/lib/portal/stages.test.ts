import { describe, expect, it } from "vitest";
import { PURSUIT_STAGES, type Activity, type PursuitStage } from "@/lib/db/schema";
import {
  ACTIVE_STAGES,
  BOARD_STAGES,
  STAGE_LABELS,
  isActiveStage,
  isPursuitStage,
  requiresReason,
  resolveReopenStage,
  stageLabel,
  validateMove,
} from "./stages";

function stageChange(from: PursuitStage, to: PursuitStage, createdAt: string): Activity {
  return {
    id: `${from}-${to}-${createdAt}`,
    pursuitId: "p1",
    kind: "stage_changed",
    actorId: "user_1",
    body: null,
    meta: { from, to, reason: "Because" },
    createdAt: new Date(createdAt),
  };
}

describe("stage constants", () => {
  it("names the three active stages in board order", () => {
    expect(BOARD_STAGES).toEqual(["enquiry", "scoping", "proposal"]);
    expect([...ACTIVE_STAGES]).toEqual(["enquiry", "scoping", "proposal"]);
  });

  it("labels every stage in British English title case", () => {
    expect(STAGE_LABELS).toEqual({
      enquiry: "Enquiry",
      scoping: "Scoping",
      proposal: "Proposal",
      instructed: "Instructed",
      declined: "Declined",
      dormant: "Dormant",
    });
    expect(stageLabel("dormant")).toBe("Dormant");
  });

  it("labels exactly the stages the schema declares, in the same order", () => {
    expect(Object.keys(STAGE_LABELS)).toEqual([...PURSUIT_STAGES]);
  });
});

describe("isActiveStage", () => {
  it("is true for enquiry, scoping and proposal only", () => {
    expect(isActiveStage("enquiry")).toBe(true);
    expect(isActiveStage("scoping")).toBe(true);
    expect(isActiveStage("proposal")).toBe(true);
    expect(isActiveStage("instructed")).toBe(false);
    expect(isActiveStage("declined")).toBe(false);
    expect(isActiveStage("dormant")).toBe(false);
  });
});

describe("isPursuitStage", () => {
  it("accepts the six stage values and rejects anything else", () => {
    for (const stage of ["enquiry", "scoping", "proposal", "instructed", "declined", "dormant"]) {
      expect(isPursuitStage(stage)).toBe(true);
    }
    for (const stage of PURSUIT_STAGES) expect(isPursuitStage(stage)).toBe(true);
    expect(isPursuitStage("conflict_check")).toBe(false);
    expect(isPursuitStage("Enquiry")).toBe(false);
    expect(isPursuitStage("")).toBe(false);
  });
});

describe("requiresReason", () => {
  it("requires a reason for declined and dormant only", () => {
    expect(requiresReason("declined")).toBe(true);
    expect(requiresReason("dormant")).toBe(true);
    expect(requiresReason("enquiry")).toBe(false);
    expect(requiresReason("scoping")).toBe(false);
    expect(requiresReason("proposal")).toBe(false);
    expect(requiresReason("instructed")).toBe(false);
  });
});

describe("validateMove", () => {
  it("rejects a move to the current stage", () => {
    expect(validateMove("scoping", "scoping")).toEqual({ ok: false, error: "Already at Scoping" });
  });

  it("allows any move between different stages when no reason is needed", () => {
    expect(validateMove("enquiry", "scoping")).toEqual({ ok: true });
    expect(validateMove("instructed", "enquiry")).toEqual({ ok: true });
    expect(validateMove("declined", "proposal")).toEqual({ ok: true });
  });

  it("requires at least three characters of reason for declined and dormant", () => {
    const error = "Give a reason (at least three characters)";
    expect(validateMove("enquiry", "declined")).toEqual({ ok: false, error });
    expect(validateMove("enquiry", "declined", null)).toEqual({ ok: false, error });
    expect(validateMove("enquiry", "dormant", "  ab  ")).toEqual({ ok: false, error });
    expect(validateMove("enquiry", "dormant", "abc")).toEqual({ ok: true });
    expect(validateMove("proposal", "declined", "  Fee too low  ")).toEqual({ ok: true });
  });

  it("checks the same stage before the reason", () => {
    expect(validateMove("declined", "declined")).toEqual({ ok: false, error: "Already at Declined" });
  });
});

describe("resolveReopenStage", () => {
  it("returns the stage a pursuit was at before it went dormant", () => {
    const activity = [stageChange("proposal", "dormant", "2026-09-01T10:00:00Z")];
    expect(resolveReopenStage(activity)).toBe("proposal");
  });

  it("returns the stage a pursuit was at before it was declined", () => {
    const activity = [stageChange("enquiry", "declined", "2026-09-01T10:00:00Z")];
    expect(resolveReopenStage(activity)).toBe("enquiry");
  });

  it("falls back to enquiry when there is no activity", () => {
    expect(resolveReopenStage([])).toBe("enquiry");
  });

  it("uses the latest change into declined or dormant whatever the list order", () => {
    const older = stageChange("proposal", "dormant", "2026-08-01T10:00:00Z");
    const newer = stageChange("scoping", "declined", "2026-09-01T10:00:00Z");
    expect(resolveReopenStage([older, newer])).toBe("scoping");
    expect(resolveReopenStage([newer, older])).toBe("scoping");
  });

  it("ignores stage changes that did not go into declined or dormant", () => {
    const activity = [
      stageChange("proposal", "dormant", "2026-08-01T10:00:00Z"),
      stageChange("dormant", "scoping", "2026-08-15T10:00:00Z"),
      stageChange("scoping", "proposal", "2026-09-01T10:00:00Z"),
    ];
    expect(resolveReopenStage(activity)).toBe("proposal");
  });

  it("falls back to enquiry when the previous stage was not active", () => {
    const activity = [stageChange("instructed", "dormant", "2026-09-01T10:00:00Z")];
    expect(resolveReopenStage(activity)).toBe("enquiry");
  });

  it("ignores entries of other kinds and entries without meta", () => {
    const note: Activity = {
      id: "n1",
      pursuitId: "p1",
      kind: "note",
      actorId: "user_1",
      body: "Spoke to Jane",
      meta: null,
      createdAt: new Date("2026-09-02T10:00:00Z"),
    };
    const bare: Activity = { ...note, id: "s1", kind: "stage_changed", body: null };
    expect(resolveReopenStage([note, bare])).toBe("enquiry");
  });
});
