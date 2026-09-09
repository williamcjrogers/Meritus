"use client";

import Link from "next/link";
import { useState } from "react";
import type { Pursuit, PursuitStage } from "@/lib/db/schema";
import { dueLabel } from "@/lib/portal/dates";
import { directorInitials, directorName, type Director } from "@/lib/portal/director-helpers";
import { stageLabel } from "@/lib/portal/stages";
import type { ActionResult } from "@/lib/portal/types";
import { OwnerAvatar } from "./OwnerAvatar";

export function RevisitRow({
  pursuit,
  reopenStage,
  directors,
  onReopen,
}: {
  pursuit: Pursuit;
  reopenStage: PursuitStage;
  directors: Director[];
  onReopen: (id: string) => Promise<ActionResult>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reopen() {
    setBusy(true);
    setError(null);
    const result = await onReopen(pursuit.id);
    setBusy(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <article className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Link href={`/portal/pursuits/${pursuit.id}`} className="font-serif text-xl leading-tight text-green hover:text-brass">
            {pursuit.firm}
          </Link>
          <span className="text-[13px] text-ink/70">{pursuit.nextAction || "Revisit date reached"}</span>
        </div>
        <p className="mt-1 flex items-center gap-2 text-[12px] text-ink/70">
          {pursuit.nextActionDue && (
            <span className="font-mono text-[11px] tracking-[0.05em] text-oxblood">due {dueLabel(pursuit.nextActionDue)}</span>
          )}
          <OwnerAvatar initials={directorInitials(directors, pursuit.ownerId)} name={directorName(directors, pursuit.ownerId)} />
        </p>
        {error && <p className="mt-2 text-[12px] text-oxblood">{error}</p>}
      </div>
      <button type="button" className="btn-secondary shrink-0" onClick={() => void reopen()} disabled={busy}>
        {busy ? "Reopening…" : `Reopen at ${stageLabel(reopenStage)}`}
      </button>
    </article>
  );
}
