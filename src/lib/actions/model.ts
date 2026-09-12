import { z } from "zod";
import { validDate } from "./dates";
import type { ActionDraft, DeskAction, SaveActionInput, WorkLink } from "./types";

export const OPEN_STATES = ["todo", "in_progress", "waiting"] as const;
export const ACTION_STATES = [...OPEN_STATES, "completed", "cancelled"] as const;

const existingTextIdSchema = z.string().trim().min(1).max(64);
const researchIdSchema = z.uuid();
const dateSchema = z.string().refine(validDate, "Choose a valid due date");

export const actionStateSchema = z.enum(ACTION_STATES);

export const workLinkSchema: z.ZodType<WorkLink> = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("general") }).strict(),
  z.object({ kind: z.literal("pursuit"), id: existingTextIdSchema }).strict(),
  z.object({ kind: z.literal("prospect"), id: existingTextIdSchema }).strict(),
  z.object({ kind: z.literal("programme"), id: existingTextIdSchema }).strict(),
  z.object({ kind: z.literal("investigation"), id: researchIdSchema }).strict(),
  z.object({ kind: z.literal("calendar"), id: researchIdSchema }).strict(),
]);

export const actionDraftSchema: z.ZodType<ActionDraft> = z
  .object({
    title: z.string().max(240),
    description: z.string().max(4000),
    ownerId: existingTextIdSchema.nullable(),
    dueDate: dateSchema.nullable(),
    state: actionStateSchema,
    stateReason: z.string().max(1000),
    changeReason: z.string().max(1000),
    saveUnassigned: z.boolean(),
  })
  .strict();

export const saveActionInputSchema: z.ZodType<SaveActionInput> = z
  .object({
    id: z.uuid(),
    requestId: z.uuid(),
    expectedVersion: z.number().int().nonnegative(),
    link: workLinkSchema,
    draft: actionDraftSchema,
  })
  .strict();

export function isOpenAction(action: Pick<DeskAction, "state">): boolean {
  return (
    action.state === "todo" || action.state === "in_progress" || action.state === "waiting"
  );
}

function nullableText(value: string): string | null {
  return value === "" ? null : value;
}

function isPureRepeatedCompletion(draft: ActionDraft, current: DeskAction): boolean {
  return (
    current.state === "completed" &&
    draft.state === "completed" &&
    draft.title.trim() === current.title &&
    nullableText(draft.description) === current.description &&
    draft.ownerId === current.ownerId &&
    draft.dueDate === current.dueDate &&
    nullableText(draft.stateReason) === current.stateReason
  );
}

function isPureReopen(draft: ActionDraft, current: DeskAction): boolean {
  const submittedReason = nullableText(draft.stateReason);
  return (
    !isOpenAction(current) &&
    isOpenAction(draft) &&
    draft.title.trim() === current.title &&
    nullableText(draft.description) === current.description &&
    draft.ownerId === current.ownerId &&
    draft.dueDate === current.dueDate &&
    (submittedReason === current.stateReason || submittedReason === null)
  );
}

export function actionIssue(draft: ActionDraft, current: DeskAction | null): string | null {
  if (!ACTION_STATES.includes(draft.state)) return "Choose a valid status";
  if (!draft.title.trim()) return "Give the action a title";
  if (draft.title.trim().length > 240) return "Keep the action title to 240 characters";
  if (draft.description.length > 4000) return "Keep the description to 4,000 characters";
  if (draft.stateReason.length > 1000 || draft.changeReason.length > 1000) {
    return "Keep the reason to 1,000 characters";
  }
  if (draft.dueDate && !validDate(draft.dueDate)) return "Choose a valid due date";

  if (
    current &&
    !isOpenAction(current) &&
    !isPureRepeatedCompletion(draft, current) &&
    !isPureReopen(draft, current)
  ) {
    return "Reopen the action before changing it";
  }

  if (draft.state === "waiting" && !draft.dueDate) {
    return "Set a follow-up date for waiting work";
  }
  if (
    (draft.state === "waiting" || draft.state === "cancelled") &&
    !draft.stateReason.trim()
  ) {
    return "Give a reason for this status";
  }
  if (draft.state === "completed" && !draft.ownerId) {
    return "Confirm an assignee before completing the action";
  }
  if (!draft.ownerId && !draft.saveUnassigned) {
    return "Assign the action or save it as unassigned";
  }
  if (draft.ownerId && !draft.dueDate) return "Set a due date for this assignment";
  if (current && current.dueDate !== draft.dueDate && !draft.changeReason.trim()) {
    return "Explain why the due date changed";
  }
  return null;
}

export function chooseNextAction(
  actions: DeskAction[],
  nominatedId: string | null,
): DeskAction | null {
  const open = actions.filter(isOpenAction);
  const nominated = open.find((action) => action.id === nominatedId);
  if (nominated) return nominated;
  return (
    [...open].sort(
      (left, right) =>
        (left.dueDate ?? "9999-12-31").localeCompare(right.dueDate ?? "9999-12-31") ||
        left.createdAt.localeCompare(right.createdAt) ||
        left.id.localeCompare(right.id),
    )[0] ?? null
  );
}
