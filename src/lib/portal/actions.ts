"use server";

import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CONTACT_FORM_OPTIONS } from "@/lib/constants";
import { addActivity, listActivity } from "@/lib/db/activity";
import { listDocuments } from "@/lib/db/documents";
import {
  createPursuitWithEnquiry,
  declinePursuitGuardedWithActivity,
  deletePursuit as removePursuit,
  getPursuit,
  takePursuitGuarded,
  updatePursuit as patchPursuit,
  updatePursuitWithActivity,
  type PursuitPatch,
} from "@/lib/db/pursuits";
import { clearQuestions as deleteQuestions } from "@/lib/db/questions";
import type { NewPursuit, PursuitStage } from "@/lib/db/schema";
import { normalizeWebsite } from "@/lib/research/urls";
import { requireActionUser } from "./auth";
import { listDirectors } from "./directors";
import { isPursuitStage, resolveReopenStage, stageLabel, validateMove } from "./stages";
import type { ActionResult, CreateResult, PursuitFormInput } from "./types";

export type { ActionResult, CreateResult, PursuitFormInput } from "./types";

/*
 * Every mutation on the desk lives here. Each action checks the signed-in director, does
 * its work, returns a plain result (never a thrown redirect) and, whatever happened,
 * revalidates the portal tree so the next render is current. Clients call these inside
 * startTransition and keep their optimistic state until the result lands.
 */

type Failure = { ok: false; error: string };

const NOT_FOUND = "This pursuit no longer exists";
const NEXT_ACTION_MAX = 140;
const NOTE_MAX = 4000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const COMPANY_NUMBER = /^[A-Z0-9]{8}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Sources a director can pick when creating a pursuit by hand. The site form sets its own. */
const MANUAL_SOURCES = ["referral", "introduction", "existing_client", "other"] as const;

async function guarded<R extends { ok: boolean }>(
  name: string,
  handler: (userId: string) => Promise<R | Failure>
): Promise<R | Failure> {
  try {
    const user = await requireActionUser();
    if (!user.ok) return user;
    return await handler(user.userId);
  } catch (error) {
    console.error(`[portal] ${name} failed`, error);
    return { ok: false, error: "Something went wrong, try again" };
  } finally {
    revalidatePath("/portal", "layout");
  }
}

function notFound(): Failure {
  return { ok: false, error: NOT_FOUND };
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 64;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** A calendar date as the date inputs send it, and one that exists (no 30 February). */
function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

// Form validation ---------------------------------------------------------------------------

function emptyToNull(value: string | undefined): string | null {
  return value ? value : null;
}

function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `Keep the ${label} to ${max.toLocaleString("en-GB")} characters`)
    .optional()
    .transform(emptyToNull);
}

function choice(options: readonly string[], message: string) {
  return z
    .string()
    .trim()
    .optional()
    .transform(emptyToNull)
    .refine((value) => value === null || options.includes(value), message);
}

function companyNumber() {
  return z
    .string()
    .optional()
    .transform((value) => emptyToNull((value ?? "").replace(/\s+/g, "").toUpperCase()))
    .refine((value) => value === null || COMPANY_NUMBER.test(value), "Company numbers have eight characters");
}

const formFields = {
  firm: z
    .string("Give the firm's name")
    .trim()
    .min(1, "Give the firm's name")
    .max(200, "Keep the firm's name to 200 characters"),
  contactName: optionalText(200, "contact name"),
  contactEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "Keep the email address to 254 characters")
    .optional()
    .transform(emptyToNull)
    .refine((value) => value === null || EMAIL.test(value), "Give a valid email address"),
  contactPhone: optionalText(50, "phone number"),
  website: z
    .string()
    .trim()
    .optional()
    .transform(emptyToNull)
    .transform((value, ctx) => {
      if (value === null) return null;
      const normalised = normalizeWebsite(value);
      if (!normalised) {
        ctx.addIssue({ code: "custom", message: "Give a valid website address" });
        return z.NEVER;
      }
      return normalised;
    }),
  companyNumber: companyNumber(),
  party: optionalText(200, "party name"),
  partyCompanyNumber: companyNumber(),
  counterparty: optionalText(200, "counterparty name"),
  disputeNature: z
    .string("Choose the nature of the dispute")
    .trim()
    .refine(
      (value) => (CONTACT_FORM_OPTIONS.disputeNature as readonly string[]).includes(value),
      "Choose the nature of the dispute"
    ),
  approximateValue: choice(CONTACT_FORM_OPTIONS.approximateValue, "Choose a value band from the list"),
  forum: choice(CONTACT_FORM_OPTIONS.forum, "Choose a forum from the list"),
  sourceDetail: optionalText(200, "source detail"),
  summary: optionalText(NOTE_MAX, "summary"),
};

const createSchema = z.object({
  ...formFields,
  source: z.enum(MANUAL_SOURCES, "Choose where the pursuit came from"),
});

/** Editing keeps a site-form pursuit's source intact rather than forcing a director to change it. */
const updateSchema = z.object({
  ...formFields,
  source: z.enum([...MANUAL_SOURCES, "site_form"], "Choose where the pursuit came from"),
});

type FormValues = z.output<typeof updateSchema>;

function parseForm(
  input: PursuitFormInput,
  mode: "create" | "update"
): { ok: true; values: FormValues } | Failure {
  const result = mode === "create" ? createSchema.safeParse(input) : updateSchema.safeParse(input);
  if (!result.success) {
    const first = result.error.issues[0];
    return { ok: false, error: first?.message ?? "Check the details and try again" };
  }
  return { ok: true, values: result.data };
}

// Shared steps ------------------------------------------------------------------------------

function stageChangeEntry(actorId: string, from: PursuitStage, to: PursuitStage, reason?: string | null) {
  return {
    kind: "stage_changed" as const,
    actorId,
    body: `Moved to ${stageLabel(to)}`,
    meta: { from, to, reason: asText(reason).trim() || null },
  };
}

/** Explains a failed guarded update: the pursuit went, or another director got there first. */
async function whyGuardFailed(id: string): Promise<string> {
  const pursuit = await getPursuit(id);
  if (!pursuit) return NOT_FOUND;
  if (!pursuit.ownerId) return "This pursuit has just changed, try again";
  const directors = await listDirectors();
  const owner = directors.find((director) => director.id === pursuit.ownerId);
  return `Taken by ${owner?.initials ?? "another director"} a moment ago`;
}

async function insertNote(pursuitId: string, actorId: string, body: string): Promise<ActionResult> {
  const pursuit = await getPursuit(pursuitId);
  if (!pursuit) return notFound();
  await addActivity({ pursuitId, kind: "note", actorId, body });
  return { ok: true };
}

// Actions -----------------------------------------------------------------------------------

export async function createPursuit(input: PursuitFormInput): Promise<CreateResult> {
  return guarded<CreateResult>("createPursuit", async (userId) => {
    const parsed = parseForm(input, "create");
    if (!parsed.ok) return parsed;
    const id = crypto.randomUUID();
    const now = new Date();
    const values: NewPursuit = {
      id,
      ...parsed.values,
      ownerId: userId,
      stage: "enquiry",
      stageChangedAt: now,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };
    // One batch, so a pursuit never exists without its "created" entry.
    await createPursuitWithEnquiry(values, {
      kind: "created",
      actorId: userId,
      body: `Created ${parsed.values.firm}`,
    });
    return { ok: true, id };
  });
}

export async function updatePursuit(id: string, input: PursuitFormInput): Promise<ActionResult> {
  return guarded<ActionResult>("updatePursuit", async () => {
    if (!isId(id)) return notFound();
    const parsed = parseForm(input, "update");
    if (!parsed.ok) return parsed;
    const updated = await patchPursuit(id, parsed.values);
    if (!updated) return notFound();
    return { ok: true };
  });
}

/** Deletes the pursuit and everything under it. Blobs go first, best effort; the row cascades. */
export async function deletePursuit(id: string): Promise<ActionResult> {
  return guarded<ActionResult>("deletePursuit", async () => {
    if (!isId(id)) return notFound();
    const pursuit = await getPursuit(id);
    if (!pursuit) return notFound();
    const docs = await listDocuments({ scope: "pursuit", pursuitId: id });
    if (docs.length > 0) {
      try {
        await del(docs.map((doc) => doc.blobUrl));
      } catch (error) {
        console.warn(`[portal] blob delete failed for pursuit ${id}`, error);
      }
    }
    await removePursuit(id);
    return { ok: true };
  });
}

export async function takePursuit(id: string): Promise<ActionResult> {
  return guarded<ActionResult>("takePursuit", async (userId) => {
    if (!isId(id)) return notFound();
    const taken = await takePursuitGuarded(id, userId);
    if (!taken) return { ok: false, error: await whyGuardFailed(id) };
    await addActivity({
      pursuitId: id,
      kind: "assigned",
      actorId: userId,
      body: "Taken from the inbox",
      meta: { ownerId: userId },
    });
    return { ok: true };
  });
}

export async function declinePursuit(id: string, reason: string): Promise<ActionResult> {
  return guarded<ActionResult>("declinePursuit", async (userId) => {
    if (!isId(id)) return notFound();
    const pursuit = await getPursuit(id);
    if (!pursuit) return notFound();
    const check = validateMove(pursuit.stage, "declined", asText(reason));
    if (!check.ok) return check;
    const declined = await declinePursuitGuardedWithActivity(
      id,
      userId,
      new Date(),
      stageChangeEntry(userId, pursuit.stage, "declined", reason)
    );
    if (!declined) return { ok: false, error: await whyGuardFailed(id) };
    return { ok: true };
  });
}

export async function movePursuit(
  id: string,
  to: PursuitStage,
  reason?: string,
  revisitDue?: string
): Promise<ActionResult> {
  return guarded<ActionResult>("movePursuit", async (userId) => {
    if (!isId(id)) return notFound();
    if (typeof to !== "string" || !isPursuitStage(to)) {
      return { ok: false, error: "Choose a stage from the list" };
    }
    const pursuit = await getPursuit(id);
    if (!pursuit) return notFound();
    const check = validateMove(pursuit.stage, to, asText(reason));
    if (!check.ok) return check;
    const patch: PursuitPatch = { stage: to, stageChangedAt: new Date() };
    if (to === "dormant" && revisitDue) {
      if (!isIsoDate(asText(revisitDue))) {
        return { ok: false, error: "Give the revisit date as a valid date" };
      }
      patch.nextActionDue = revisitDue;
    }
    const moved = await updatePursuitWithActivity(id, patch, stageChangeEntry(userId, pursuit.stage, to, reason));
    if (!moved) return notFound();
    return { ok: true };
  });
}

export async function reopenPursuit(id: string): Promise<ActionResult> {
  return guarded<ActionResult>("reopenPursuit", async (userId) => {
    if (!isId(id)) return notFound();
    const pursuit = await getPursuit(id);
    if (!pursuit) return notFound();
    if (pursuit.stage !== "declined" && pursuit.stage !== "dormant") {
      return { ok: false, error: "Only declined or dormant pursuits can be reopened" };
    }
    const to = resolveReopenStage(await listActivity(id));
    // A revisit date set when parking the pursuit has done its job; without a next action it would only read as overdue.
    const patch: PursuitPatch = { stage: to, stageChangedAt: new Date() };
    if (pursuit.stage === "dormant" && !pursuit.nextAction) patch.nextActionDue = null;
    const reopened = await updatePursuitWithActivity(id, patch, {
      kind: "reopened",
      actorId: userId,
      body: `Reopened at ${stageLabel(to)}`,
      meta: { from: pursuit.stage, to },
    });
    if (!reopened) return notFound();
    return { ok: true };
  });
}

/**
 * Null returns the pursuit to the inbox at its current stage. A named owner must be a current
 * director when the list can be read; an empty list means Clerk was unavailable, and the choice
 * is then taken on trust rather than blocked.
 */
export async function setOwner(id: string, ownerId: string | null): Promise<ActionResult> {
  return guarded<ActionResult>("setOwner", async (userId) => {
    if (!isId(id)) return notFound();
    const owner = asText(ownerId).trim() || null;
    let ownerName = "a director";
    if (owner) {
      const directors = await listDirectors();
      const director = directors.find((entry) => entry.id === owner);
      if (!director && directors.length > 0) {
        return { ok: false, error: "Choose a director from the list" };
      }
      ownerName = director?.name ?? ownerName;
    }
    const updated = await updatePursuitWithActivity(
      id,
      { ownerId: owner },
      {
        kind: "assigned",
        actorId: userId,
        body: owner ? `Assigned to ${ownerName}` : "Returned to the inbox",
        meta: { ownerId: owner },
      }
    );
    if (!updated) return notFound();
    return { ok: true };
  });
}

/** Empty text clears the next action and its date together. */
export async function setNextAction(id: string, text: string, due: string | null): Promise<ActionResult> {
  return guarded<ActionResult>("setNextAction", async (userId) => {
    if (!isId(id)) return notFound();
    const nextAction = asText(text).trim();
    if (nextAction.length > NEXT_ACTION_MAX) {
      return { ok: false, error: `Keep the next action to ${NEXT_ACTION_MAX} characters` };
    }
    const dueText = asText(due).trim();
    if (dueText && !isIsoDate(dueText)) {
      return { ok: false, error: "Give the due date as a valid date" };
    }
    const nextActionDue = nextAction && dueText ? dueText : null;
    const updated = await updatePursuitWithActivity(
      id,
      { nextAction: nextAction || null, nextActionDue },
      {
        kind: "next_action_set",
        actorId: userId,
        body: nextAction || "Next action cleared",
        meta: { nextAction: nextAction || null, nextActionDue },
      }
    );
    if (!updated) return notFound();
    return { ok: true };
  });
}

export async function addNote(id: string, body: string): Promise<ActionResult> {
  return guarded<ActionResult>("addNote", async (userId) => {
    if (!isId(id)) return notFound();
    const text = asText(body).trim();
    if (!text) return { ok: false, error: "Write the note first" };
    if (text.length > NOTE_MAX) {
      return { ok: false, error: `Keep the note to ${NOTE_MAX.toLocaleString("en-GB")} characters` };
    }
    return insertNote(id, userId, text);
  });
}

/** An answer from the questions drawer is not typed by the director, so a long one is cut, not refused. */
export async function saveAnswerAsNote(id: string, body: string): Promise<ActionResult> {
  return guarded<ActionResult>("saveAnswerAsNote", async (userId) => {
    if (!isId(id)) return notFound();
    const text = asText(body).trim();
    if (!text) return { ok: false, error: "There is no answer to save" };
    return insertNote(id, userId, text.slice(0, NOTE_MAX));
  });
}

export async function clearQuestions(id: string): Promise<ActionResult> {
  return guarded<ActionResult>("clearQuestions", async () => {
    if (!isId(id)) return notFound();
    await deleteQuestions(id);
    return { ok: true };
  });
}

export async function setCompanyNumber(
  id: string,
  number: string,
  target: "firm" | "party"
): Promise<ActionResult> {
  return guarded<ActionResult>("setCompanyNumber", async () => {
    if (!isId(id)) return notFound();
    if (target !== "firm" && target !== "party") {
      return { ok: false, error: "Choose the firm or the party" };
    }
    const value = asText(number).replace(/\s+/g, "").toUpperCase();
    if (!COMPANY_NUMBER.test(value)) {
      return { ok: false, error: "Company numbers have eight characters" };
    }
    const updated = await patchPursuit(
      id,
      target === "firm" ? { companyNumber: value } : { partyCompanyNumber: value }
    );
    if (!updated) return notFound();
    return { ok: true };
  });
}
