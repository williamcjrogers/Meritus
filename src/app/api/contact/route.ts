import { NextResponse } from "next/server";
import { SITE_CONFIG } from "@/lib/constants";
import { addActivity, updateActivityMeta } from "@/lib/db/activity";
import {
  createPursuitWithEnquiry,
  findDoubleSubmissionCandidates,
  findRelatedPursuits,
  touchPursuit,
} from "@/lib/db/pursuits";
import type { ActivityMeta, AlertOutcome } from "@/lib/db/schema";
import { purgeExpiredThrottle, registerEnquiryAttempt } from "@/lib/db/throttle";
import { sendEnquiryAlert } from "@/lib/portal/alerts";
import { listDirectors } from "@/lib/portal/directors";
import {
  firstHop,
  hashKey,
  isDoubleSubmission,
  isHoneypotFilled,
  normaliseFirm,
  parseEnquiry,
  toPursuitValues,
  toSubmission,
  type EnquiryInput,
} from "@/lib/portal/intake";

type Stored = {
  pursuitId: string;
  activityId: string;
  meta: ActivityMeta;
  /** True when the enquiry joined or relates to an existing pursuit; the alert then reads "Further enquiry". */
  related: boolean;
};

/** Recorded on the activity when the hourly global cap withholds the email. */
const GLOBAL_CAP_MESSAGE = "Withheld: the hourly cap on enquiry alerts was reached";

function pursuitUrl(id: string): string {
  return `${SITE_CONFIG.url}/portal/pursuits/${id}`;
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Creates the pursuit and its enquiry_received activity as one batch, or appends the
 * submission to a matching unowned enquiry from the last 24 hours.
 */
async function store(input: EnquiryInput, now: Date): Promise<Stored> {
  const submission = toSubmission(input, now);
  const candidates = await findDoubleSubmissionCandidates(input.email, now);
  const candidate = candidates.find((row) => isDoubleSubmission(row, input, now)) ?? null;

  if (candidate) {
    const relatedToCandidate = await findRelatedPursuits(input.email, normaliseFirm(input.firm), candidate.id);
    const meta: ActivityMeta = { submission, relatedPursuitIds: relatedToCandidate.map((row) => row.id) };
    const entry = await addActivity({ pursuitId: candidate.id, kind: "enquiry_received", actorId: "site", meta });
    try {
      await touchPursuit(candidate.id);
    } catch (err) {
      // The submission is already on the pursuit; a stale updated_at is no reason to send it by email as NOT SAVED.
      console.error("Enquiry pursuit not touched", { firm: input.firm, email: input.email, error: message(err) });
    }
    return { pursuitId: candidate.id, activityId: entry.id, meta, related: true };
  }

  const id = crypto.randomUUID();
  const related = await findRelatedPursuits(input.email, normaliseFirm(input.firm), id);
  const meta: ActivityMeta = { submission, relatedPursuitIds: related.map((row) => row.id) };
  const { activity } = await createPursuitWithEnquiry(toPursuitValues(input, id, now), {
    kind: "enquiry_received",
    actorId: "site",
    meta,
  });
  return { pursuitId: id, activityId: activity.id, meta, related: related.length > 0 };
}

async function alert(input: EnquiryInput, now: Date, stored: Stored | null): Promise<AlertOutcome> {
  try {
    const directors = await listDirectors();
    return await sendEnquiryAlert(
      {
        firm: input.firm,
        disputeNature: input.disputeNature,
        approximateValue: input.approximateValue,
        forum: input.forum,
        receivedAt: now,
        pursuitUrl: stored ? pursuitUrl(stored.pursuitId) : null,
        related: stored?.related ?? false,
        notSaved: stored ? undefined : toSubmission(input, now),
      },
      directors.map((director) => director.email)
    );
  } catch (err) {
    return { error: message(err) };
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
  }

  // Screen: automated submissions get a quiet success and nothing else.
  if (isHoneypotFilled(body)) return NextResponse.json({ success: true });

  const parsed = parseEnquiry(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const input = parsed.data;
  const now = new Date();
  const logContext = { firm: input.firm, email: input.email };

  let alertAllowed = true;
  try {
    const verdict = await registerEnquiryAttempt(
      { email: hashKey("email", input.email), ip: hashKey("ip", firstHop(request.headers.get("x-forwarded-for"))) },
      now
    );
    if (!verdict.emailAllowed || !verdict.ipAllowed) {
      return NextResponse.json({ error: "Too many enquiries" }, { status: 429 });
    }
    alertAllowed = verdict.alertAllowed;
  } catch (err) {
    // A broken counter must not lose an enquiry; the store and alert still run.
    console.error("Enquiry throttle unavailable", { ...logContext, error: message(err) });
  }

  // Store.
  let stored: Stored | null = null;
  try {
    stored = await store(input, now);
  } catch (err) {
    console.error("Enquiry not stored", { ...logContext, error: message(err) });
  }

  // Alert. Above the global cap the enquiry is stored but no email goes out; the activity
  // records that as an error so the inbox row and the timeline show "Alert not sent".
  let outcome: AlertOutcome;
  if (alertAllowed) {
    outcome = await alert(input, now, stored);
    if ("error" in outcome) console.error("Enquiry alert not sent", { ...logContext, error: outcome.error });
  } else {
    outcome = { error: GLOBAL_CAP_MESSAGE };
    console.warn("Enquiry alert withheld: global cap reached", logContext);
  }

  if (stored) {
    try {
      await updateActivityMeta(stored.activityId, { ...stored.meta, alert: outcome });
    } catch (err) {
      console.error("Enquiry alert outcome not recorded", { ...logContext, error: message(err) });
    }
  }

  try {
    await purgeExpiredThrottle(now);
  } catch {
    // Housekeeping only; the next submission will try again.
  }

  if (stored || "sentAt" in outcome) return NextResponse.json({ success: true });
  return NextResponse.json({ error: "Enquiry not sent" }, { status: 500 });
}
