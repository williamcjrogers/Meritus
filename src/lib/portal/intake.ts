import { createHash } from "node:crypto";
import { z } from "zod";
import { CONTACT_FORM_OPTIONS } from "@/lib/constants";
import type { EnquirySubmission, NewPursuit, Pursuit } from "@/lib/db/schema";

/** A site-form submission after validation: trimmed, email lower-cased, optional selects null when empty. */
export type EnquiryInput = {
  name: string;
  firm: string;
  email: string;
  disputeNature: string;
  approximateValue: string | null;
  forum: string | null;
  description: string | null;
};

/** A second submission from the same person about the same firm inside this window joins the first pursuit. */
export const DOUBLE_SUBMISSION_WINDOW_MS = 24 * 60 * 60 * 1000;

const SUBJECT_MAX_LENGTH = 80;

/** Whole-word tokens dropped from firm names so "X Ltd", "X Limited" and "X" compare equal. */
const LEGAL_SUFFIXES = /\b(?:ltd|limited|llp|plc)\b/g;

/** Empty or blank strings and missing values become null; everything else passes through trimmed. */
function emptyToNull(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function inList(options: readonly string[], label: string) {
  return z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .refine((value) => options.includes(value), `${label} is not one of the options`);
}

function optionalInList(options: readonly string[], label: string) {
  return z.preprocess(
    emptyToNull,
    z.string({ error: `${label} is not one of the options` }).refine((value) => options.includes(value), `${label} is not one of the options`).nullable()
  );
}

const enquirySchema = z.object({
  name: z.string({ error: "Name is required" }).trim().min(1, "Name is required").max(200, "Name is too long"),
  firm: z.string({ error: "Firm is required" }).trim().min(1, "Firm is required").max(200, "Firm is too long"),
  email: z
    .string({ error: "Email is required" })
    .trim()
    .toLowerCase()
    .min(1, "Email is required")
    .max(254, "Email is too long")
    .pipe(z.email({ error: "Email is not valid" })),
  disputeNature: inList(CONTACT_FORM_OPTIONS.disputeNature, "Nature of dispute"),
  approximateValue: optionalInList(CONTACT_FORM_OPTIONS.approximateValue, "Approximate value"),
  forum: optionalInList(CONTACT_FORM_OPTIONS.forum, "Forum"),
  description: z.preprocess(
    emptyToNull,
    z.string({ error: "Brief summary must be text" }).max(4000, "Brief summary is too long (4,000 characters at most)").nullable()
  ),
});

/** Validates a raw request body against the wire contract in spec 5.2. */
export function parseEnquiry(body: unknown): { ok: true; data: EnquiryInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Invalid submission" };
  }
  const result = enquirySchema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    return { ok: false, error: first?.message ?? "Invalid submission" };
  }
  const d = result.data;
  return {
    ok: true,
    data: {
      name: d.name,
      firm: d.firm,
      email: d.email,
      disputeNature: d.disputeNature,
      approximateValue: d.approximateValue ?? null,
      forum: d.forum ?? null,
      description: d.description ?? null,
    },
  };
}

/** The honeypot field is hidden from people; anything typed into it marks the submission as automated. */
export function isHoneypotFilled(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;
  const value = (body as Record<string, unknown>).company_website;
  if (value === undefined || value === null) return false;
  return String(value).trim() !== "";
}

/** Lower-cases, strips punctuation and legal suffixes, and collapses spaces so two spellings of a firm compare equal. */
export function normaliseFirm(firm: string): string {
  return firm
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(LEGAL_SUFFIXES, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Same email, same normalised firm, still an unowned enquiry, and created within the window. */
export function isDoubleSubmission(existing: Pursuit, input: EnquiryInput, now: Date): boolean {
  if (existing.stage !== "enquiry" || existing.ownerId !== null) return false;
  if ((existing.contactEmail ?? "").trim().toLowerCase() !== input.email.trim().toLowerCase()) return false;
  if (normaliseFirm(existing.firm) !== normaliseFirm(input.firm)) return false;
  const age = now.getTime() - existing.createdAt.getTime();
  return age >= 0 && age < DOUBLE_SUBMISSION_WINDOW_MS;
}

/** The row for a pursuit created from the site form: enquiry stage, no owner, created by "site". */
export function toPursuitValues(input: EnquiryInput, id: string, now: Date): NewPursuit {
  return {
    id,
    firm: input.firm,
    contactName: input.name,
    contactEmail: input.email,
    contactPhone: null,
    website: null,
    companyNumber: null,
    party: null,
    partyCompanyNumber: null,
    counterparty: null,
    disputeNature: input.disputeNature,
    approximateValue: input.approximateValue,
    forum: input.forum,
    summary: input.description,
    source: "site_form",
    sourceDetail: null,
    ownerId: null,
    stage: "enquiry",
    stageChangedAt: now,
    createdBy: "site",
    createdAt: now,
    updatedAt: now,
  };
}

/** The submission as received, stored on the enquiry_received activity. */
export function toSubmission(input: EnquiryInput, now: Date): EnquirySubmission {
  return {
    name: input.name,
    firm: input.firm,
    email: input.email,
    disputeNature: input.disputeNature,
    approximateValue: input.approximateValue,
    forum: input.forum,
    description: input.description,
    receivedAt: now.toISOString(),
  };
}

/** Makes a firm name safe for an email subject: no control characters or line breaks, single spaces, 80 characters at most. */
export function sanitiseSubject(firm: string): string {
  return firm
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SUBJECT_MAX_LENGTH)
    .trim();
}

/** Throttle keys never hold an address: "<prefix>:<sha256>" of the lower-cased, trimmed value. */
export function hashKey(prefix: "email" | "ip" | "access-email" | "access-ip", value: string): string {
  const digest = createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
  return `${prefix}:${digest}`;
}

/** The client address from x-forwarded-for: the first hop, or "unknown" when the header is absent. */
export function firstHop(forwardedFor: string | null): string {
  const first = forwardedFor?.split(",")[0]?.trim();
  return first ? first : "unknown";
}
