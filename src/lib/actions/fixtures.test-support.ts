import type { ActionDraft, DeskAction } from "./types";

export function actionFixture(overrides: Partial<DeskAction> = {}): DeskAction {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    title: "Prepare client update",
    description: null,
    ownerId: null,
    suggestedOwnerId: null,
    dueDate: null,
    originalDueDate: null,
    state: "todo",
    stateReason: null,
    completedAt: null,
    completedBy: null,
    createdBy: "director-1",
    createdAt: "2026-09-12T09:00:00.000Z",
    updatedAt: "2026-09-12T09:00:00.000Z",
    version: 1,
    legacyKey: null,
    link: { kind: "general" },
    retainedContext: null,
    ...overrides,
  };
}

export function draftFixture(overrides: Partial<ActionDraft> = {}): ActionDraft {
  return {
    title: "Prepare client update",
    description: "",
    ownerId: null,
    dueDate: null,
    state: "todo",
    stateReason: "",
    changeReason: "",
    saveUnassigned: true,
    ...overrides,
  };
}
