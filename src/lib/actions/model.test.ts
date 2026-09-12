import { describe, expect, it } from "vitest";
import { actionFixture, draftFixture } from "./fixtures.test-support";
import {
  actionIssue,
  chooseNextAction,
  isOpenAction,
  saveActionInputSchema,
} from "./model";
import type { ActionState } from "./types";

describe("recorded commitments", () => {
  it("does not equate cancellation with completion", () => {
    expect(isOpenAction(actionFixture({ state: "cancelled" }))).toBe(false);
  });

  it("requires a reason when a recorded deadline changes", () => {
    expect(
      actionIssue(
        draftFixture({ dueDate: "2026-09-18", changeReason: "" }),
        actionFixture({ dueDate: "2026-09-12" }),
      ),
    ).toBe("Explain why the due date changed");
  });

  it("requires a dated follow-up for waiting work", () => {
    expect(
      actionIssue(
        draftFixture({ state: "waiting", stateReason: "Awaiting client", dueDate: null }),
        null,
      ),
    ).toBe("Set a follow-up date for waiting work");
  });

  it("requires every assigned action to have a date", () => {
    const current = actionFixture({ ownerId: "director-1", dueDate: null });
    expect(actionIssue(draftFixture({ ownerId: "director-1", dueDate: null }), current)).toBe(
      "Set a due date for this assignment",
    );
  });

  it("rejects an invalid status even when supplied outside TypeScript", () => {
    expect(actionIssue(draftFixture({ state: "invalid" as ActionState }), null)).toBe(
      "Choose a valid status",
    );
  });

  it("rejects edits to a closed record until it is reopened", () => {
    const current = actionFixture({
      state: "completed",
      ownerId: "director-1",
      dueDate: "2026-09-12",
      completedAt: "2026-09-12T10:00:00.000Z",
      completedBy: "director-1",
    });
    expect(
      actionIssue(
        draftFixture({
          title: "Changed title",
          state: "completed",
          ownerId: "director-1",
          dueDate: "2026-09-12",
        }),
        current,
      ),
    ).toBe("Reopen the action before changing it");
  });

  it("allows a pure repeated completion and a pure completed-action reopen", () => {
    const current = actionFixture({
      state: "completed",
      ownerId: "director-1",
      dueDate: "2026-09-12",
      completedAt: "2026-09-12T10:00:00.000Z",
      completedBy: "director-1",
    });
    const unchanged = draftFixture({
      state: "completed",
      ownerId: "director-1",
      dueDate: "2026-09-12",
    });
    expect(actionIssue(unchanged, current)).toBeNull();
    expect(actionIssue({ ...unchanged, state: "todo" }, current)).toBeNull();
  });

  it.each([
    ["title", { title: "Changed title" }],
    ["description", { description: "Changed description" }],
    ["owner", { ownerId: "director-2" }],
    ["due date", { dueDate: "2026-09-13", changeReason: "Rescheduled" }],
    ["state reason", { stateReason: "Changed reason" }],
  ])("rejects a completed-action reopen combined with a %s edit", (_label, edit) => {
    const current = actionFixture({
      state: "completed",
      ownerId: "director-1",
      dueDate: "2026-09-12",
      completedAt: "2026-09-12T10:00:00.000Z",
      completedBy: "director-1",
    });
    expect(
      actionIssue(
        draftFixture({
          state: "todo",
          ownerId: "director-1",
          dueDate: "2026-09-12",
          ...edit,
        }),
        current,
      ),
    ).toBe("Reopen the action before changing it");
  });

  it("allows a pure cancelled-action reopen which clears its closed-state reason", () => {
    const current = actionFixture({
      state: "cancelled",
      stateReason: "Superseded by client instruction",
      ownerId: "director-1",
      dueDate: "2026-09-12",
    });
    expect(
      actionIssue(
        draftFixture({ state: "todo", ownerId: "director-1", dueDate: "2026-09-12" }),
        current,
      ),
    ).toBeNull();
  });

  it("rejects a cancelled-action reopen combined with an edit", () => {
    const current = actionFixture({
      state: "cancelled",
      stateReason: "Superseded by client instruction",
      ownerId: "director-1",
      dueDate: "2026-09-12",
    });
    expect(
      actionIssue(
        draftFixture({
          title: "Replacement commitment",
          state: "todo",
          ownerId: "director-1",
          dueDate: "2026-09-12",
        }),
        current,
      ),
    ).toBe("Reopen the action before changing it");
  });

  it("ignores a completed nomination and selects the earliest open action", () => {
    const done = actionFixture({ id: "done", state: "completed" });
    const due = actionFixture({ id: "due", dueDate: "2026-09-13" });
    expect(chooseNextAction([done, due], "done")?.id).toBe("due");
  });

  it("selects deterministically without mutating the source array", () => {
    const later = actionFixture({ id: "later", dueDate: "2026-09-14" });
    const earlier = actionFixture({ id: "earlier", dueDate: "2026-09-13" });
    const actions = [later, earlier];
    expect(chooseNextAction(actions, null)?.id).toBe("earlier");
    expect(actions.map(({ id }) => id)).toEqual(["later", "earlier"]);
  });

  it("accepts creation version zero in a strict command envelope", () => {
    const command = {
      id: "00000000-0000-4000-8000-000000000001",
      requestId: "00000000-0000-4000-8000-000000000002",
      expectedVersion: 0,
      link: { kind: "general" },
      draft: draftFixture(),
    };
    expect(saveActionInputSchema.safeParse(command).success).toBe(true);
    expect(saveActionInputSchema.safeParse({ ...command, unexpected: true }).success).toBe(false);
  });

  it("rejects forged states, malformed IDs and invalid related identifiers", () => {
    const command = {
      id: "00000000-0000-4000-8000-000000000001",
      requestId: "00000000-0000-4000-8000-000000000002",
      expectedVersion: 1,
      link: { kind: "general" },
      draft: draftFixture(),
    };
    expect(saveActionInputSchema.safeParse({ ...command, id: "action-1" }).success).toBe(false);
    expect(
      saveActionInputSchema.safeParse({
        ...command,
        draft: { ...command.draft, state: "done" },
      }).success,
    ).toBe(false);
    expect(
      saveActionInputSchema.safeParse({
        ...command,
        link: { kind: "investigation", id: "research-1" },
      }).success,
    ).toBe(false);
    expect(
      saveActionInputSchema.safeParse({
        ...command,
        link: { kind: "pursuit", id: "x".repeat(65) },
      }).success,
    ).toBe(false);
    expect(saveActionInputSchema.safeParse({ ...command, expectedVersion: -1 }).success).toBe(false);
  });
});
