"use client";

import Link from "next/link";
import { useState } from "react";
import type { Pursuit } from "@/lib/db/schema";
import type { AlertOutcome } from "@/lib/db/schema";
import { directorInitials, type Director } from "@/lib/portal/director-helpers";
import { relativeLabel } from "@/lib/portal/dates";
import { stageLabel } from "@/lib/portal/stages";
import type { ActionResult } from "@/lib/portal/types";
import { OwnerAvatar } from "./OwnerAvatar";
import { StagePill } from "./StagePill";
import type { RelatedRef } from "./desk-types";

function meta(p: Pursuit): string {
  return [p.disputeNature, p.approximateValue, p.forum].filter(Boolean).join(" · ");
}

export function InboxRow({
  pursuit,
  related = [],
  alert,
  directors,
  now,
  error: refusal,
  onDismiss,
  onTake,
  onDecline,
}: {
  pursuit: Pursuit;
  related?: RelatedRef[];
  alert?: AlertOutcome;
  directors: Director[];
  now: Date;
  /** A refusal the desk remembered for this row, for example "Taken by MD a moment ago". */
  error?: string;
  onDismiss?: () => void;
  onTake: (id: string) => Promise<ActionResult>;
  onDecline: (id: string, reason: string) => Promise<ActionResult>;
}) {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [localError, setError] = useState<string | null>(null);
  const [localTaken, setTaken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const taken = localTaken ?? (refusal && /taken/i.test(refusal) ? refusal : null);
  const error = localError ?? (refusal && !/taken/i.test(refusal) ? refusal : null);

  async function take() {
    setBusy(true);
    setError(null);
    const result = await onTake(pursuit.id);
    setBusy(false);
    if (!result.ok) {
      if (/taken/i.test(result.error)) setTaken(result.error);
      else setError(result.error);
    }
  }

  async function decline() {
    if (reason.trim().length < 3) return;
    setBusy(true);
    setError(null);
    const result = await onDecline(pursuit.id, reason.trim());
    setBusy(false);
    if (!result.ok) {
      if (/taken/i.test(result.error)) setTaken(result.error);
      else setError(result.error);
    }
  }

  const alertFailed = alert !== undefined && "error" in alert;
  const takenInitials = taken ? (taken.match(/by ([A-Z]{1,3})/)?.[1] ?? null) : null;

  return (
    <article className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Link href={`/portal/pursuits/${pursuit.id}`} className="font-sans text-xl leading-tight text-primary hover:text-primary">
            {pursuit.firm}
          </Link>
          {pursuit.stage !== "enquiry" && <StagePill stage={pursuit.stage} />}
          <span className="text-[13px] text-muted">{meta(pursuit) || "No details given"}</span>
        </div>
        <p className="mt-1 text-[13px] text-muted">
          {pursuit.contactName || "No contact name"}
          {pursuit.contactEmail ? ` · ${pursuit.contactEmail}` : ""}
          {" · "}
          <span className="font-sans text-[13px] ">{relativeLabel(pursuit.createdAt, now)}</span>
        </p>
        {related.length > 0 && (
          <p className="mt-1 text-[13px] text-muted">
            Previously:{" "}
            {related.map((ref, index) => (
              <span key={ref.id}>
                {index > 0 && ", "}
                <Link href={`/portal/pursuits/${ref.id}`} className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary">
                  {ref.firm}
                </Link>
                {` (${stageLabel(ref.stage).toLowerCase()}, ${ref.date})`}
              </span>
            ))}
          </p>
        )}
        {alertFailed && (
          <p className="mt-1 font-sans text-[13px]   text-muted">Alert not sent</p>
        )}
        {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        {taken ? (
          <p className="flex items-center gap-2 text-[13px] text-muted">
            {takenInitials && <OwnerAvatar initials={takenInitials} name={taken} />}
            {taken}
            {onDismiss && (
              <button type="button" className="app-button app-button--ghost text-[13px]" onClick={onDismiss}>
                Dismiss
              </button>
            )}
          </p>
        ) : declining ? (
          <form noValidate
            className="flex flex-col items-end gap-2 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              void decline();
            }}
          >
            <label className="block w-full sm:w-64">
              <span className="app-label">Reason for declining</span>
              <input
                autoFocus
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="app-field"
                placeholder="At least three characters"
                aria-label="Reason for declining"
              />
            </label>
            <div className="flex gap-2">
              <button type="button" className="app-button app-button--ghost" onClick={() => setDeclining(false)} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="app-button app-button--secondary app-button--danger" disabled={busy || reason.trim().length < 3}>
                {busy ? "Declining…" : "Decline"}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex gap-2">
            <button type="button" className="app-button app-button--secondary" onClick={() => void take()} disabled={busy}>
              {busy ? "Taking…" : "Take"}
            </button>
            <button type="button" className="app-button app-button--ghost" onClick={() => setDeclining(true)} disabled={busy}>
              Decline
            </button>
          </div>
        )}
        {pursuit.ownerId && !taken && (
          <span className="sr-only">Owned by {directorInitials(directors, pursuit.ownerId)}</span>
        )}
      </div>
    </article>
  );
}
