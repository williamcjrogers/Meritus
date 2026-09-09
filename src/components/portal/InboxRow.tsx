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
  onTake,
  onDecline,
}: {
  pursuit: Pursuit;
  related?: RelatedRef[];
  alert?: AlertOutcome;
  directors: Director[];
  now: Date;
  onTake: (id: string) => Promise<ActionResult>;
  onDecline: (id: string, reason: string) => Promise<ActionResult>;
}) {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
          <Link href={`/portal/pursuits/${pursuit.id}`} className="font-serif text-xl leading-tight text-green hover:text-brass">
            {pursuit.firm}
          </Link>
          {pursuit.stage !== "enquiry" && <StagePill stage={pursuit.stage} />}
          <span className="text-[13px] text-ink/70">{meta(pursuit) || "No details given"}</span>
        </div>
        <p className="mt-1 text-[13px] text-ink/70">
          {pursuit.contactName || "No contact name"}
          {pursuit.contactEmail ? ` · ${pursuit.contactEmail}` : ""}
          {" · "}
          <span className="font-mono text-[11px] tracking-[0.05em]">{relativeLabel(pursuit.createdAt, now)}</span>
        </p>
        {related.length > 0 && (
          <p className="mt-1 text-[12px] text-ink/70">
            Previously:{" "}
            {related.map((ref, index) => (
              <span key={ref.id}>
                {index > 0 && ", "}
                <Link href={`/portal/pursuits/${ref.id}`} className="text-green underline decoration-brass/40 underline-offset-2 hover:decoration-brass">
                  {ref.firm}
                </Link>
                {` (${stageLabel(ref.stage).toLowerCase()}, ${ref.date})`}
              </span>
            ))}
          </p>
        )}
        {alertFailed && (
          <p className="mt-1 font-mono text-[10px] tracking-[0.15em] uppercase text-ink/60">Alert not sent</p>
        )}
        {error && <p className="mt-2 text-[12px] text-oxblood">{error}</p>}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        {taken ? (
          <p className="flex items-center gap-2 text-[12px] text-ink/70">
            {takenInitials && <OwnerAvatar initials={takenInitials} name={taken} />}
            {taken}
          </p>
        ) : declining ? (
          <form
            className="flex flex-col items-end gap-2 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              void decline();
            }}
          >
            <label className="block w-full sm:w-64">
              <span className="portal-label">Reason for declining</span>
              <input
                autoFocus
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="portal-field"
                placeholder="At least three characters"
                aria-label="Reason for declining"
              />
            </label>
            <div className="flex gap-2">
              <button type="button" className="btn-quiet" onClick={() => setDeclining(false)} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="btn-secondary btn-danger" disabled={busy || reason.trim().length < 3}>
                {busy ? "Declining…" : "Decline"}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={() => void take()} disabled={busy}>
              {busy ? "Taking…" : "Take"}
            </button>
            <button type="button" className="btn-quiet" onClick={() => setDeclining(true)} disabled={busy}>
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
