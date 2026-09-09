import { Resend, type CreateEmailRequestOptions } from "resend";
import type { AlertOutcome, EnquirySubmission } from "@/lib/db/schema";
import { isResendConfigured } from "@/lib/env";
import { dateTime } from "@/lib/portal/dates";
import { sanitiseSubject } from "@/lib/portal/intake";

export const ALERT_TIMEOUT_MS = 8_000;
export const DEFAULT_ALERT_FROM = "enquiries@meritusvia.com";
export const NOT_SAVED_PREFIX = "NOT SAVED: create this pursuit by hand";

export type AlertInput = {
  firm: string;
  disputeNature: string;
  approximateValue: string | null;
  forum: string | null;
  receivedAt: Date;
  /** Null when the pursuit could not be stored. */
  pursuitUrl: string | null;
  /** True when other pursuits share the email or firm; the subject then reads "Further enquiry". */
  related: boolean;
  /** Set only when the store failed: the whole submission travels by email so a director can create the pursuit by hand. */
  notSaved?: EnquirySubmission;
};

export function alertFrom(): string {
  const configured = process.env.ENQUIRY_ALERT_FROM?.trim();
  return configured ? configured : DEFAULT_ALERT_FROM;
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function alertSubject(input: AlertInput): string {
  const kind = input.related ? "Further enquiry" : "New enquiry";
  const firm = sanitiseSubject(input.firm) || "unnamed firm";
  const subject = `${kind}: ${firm}`;
  return input.notSaved ? `NOT SAVED: ${subject}` : subject;
}

/** Plain text: firm, nature, value band, forum, time received and the link. Name, email and summary stay behind Clerk unless the store failed. */
export function alertText(input: AlertInput): string {
  const lines = [
    `Firm: ${oneLine(input.firm)}`,
    `Nature: ${oneLine(input.disputeNature)}`,
    `Value: ${input.approximateValue ?? "Not given"}`,
    `Forum: ${input.forum ?? "Not given"}`,
    `Received: ${dateTime(input.receivedAt)} (London)`,
    `Pursuit: ${input.pursuitUrl ?? "Not saved"}`,
  ];
  if (input.notSaved) {
    const s = input.notSaved;
    return [
      NOT_SAVED_PREFIX,
      "",
      ...lines,
      "",
      "Submission as received:",
      `Name: ${oneLine(s.name)}`,
      `Email: ${oneLine(s.email)}`,
      `Firm: ${oneLine(s.firm)}`,
      `Nature: ${oneLine(s.disputeNature)}`,
      `Value: ${s.approximateValue ?? "Not given"}`,
      `Forum: ${s.forum ?? "Not given"}`,
      `Summary: ${s.description?.trim() || "None"}`,
    ].join("\n");
  }
  return lines.join("\n");
}

/**
 * Sends the enquiry alert to the directors through Resend. Never throws: the outcome is
 * written to the enquiry activity and decides, with the store result, what the visitor sees.
 */
export async function sendEnquiryAlert(input: AlertInput, recipients: string[]): Promise<AlertOutcome> {
  if (!isResendConfigured()) return { skipped: "not_configured" };
  const to = Array.from(new Set(recipients.map((r) => r.trim()).filter(Boolean)));
  if (to.length === 0) return { error: "No recipients: the director list was unavailable" };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<AlertOutcome>((resolve) => {
    timer = setTimeout(
      () => resolve({ error: `Timed out after ${ALERT_TIMEOUT_MS / 1000} seconds` }),
      ALERT_TIMEOUT_MS
    );
  });

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    // The SDK spreads request options into fetch, so the signal cancels the request even though its types omit it.
    const options = { signal: AbortSignal.timeout(ALERT_TIMEOUT_MS) } as CreateEmailRequestOptions;
    const request = resend.emails
      .send({ from: alertFrom(), to, subject: alertSubject(input), text: alertText(input) }, options)
      .then(({ error }): AlertOutcome => {
        if (error) return { error: `${error.name}: ${error.message}` };
        return { sentAt: new Date().toISOString(), recipients: to.length };
      });
    return await Promise.race([request, timeout]);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
