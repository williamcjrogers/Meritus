"use client";

import Link from "next/link";
import type { LiveLead } from "@/lib/portal/live-leads";
import { stageLabel } from "@/lib/portal/stages";
import type { PursuitStage } from "@/lib/db/schema";
import { daysInStage, dueLabel, isOverdue } from "@/lib/portal/dates";
import { directorInitials, directorName, type Director } from "@/lib/portal/director-helpers";
import type { ActionResult } from "@/lib/portal/types";
import { MoveToMenu } from "./MoveToMenu";
import { OwnerAvatar } from "./OwnerAvatar";
import { actionStateLabels } from "./actions/ActionRow";

export type CardMoveHandler = (
  id: string,
  to: PursuitStage,
  reason?: string,
  revisitDue?: string
) => Promise<ActionResult>;

export function PursuitCard({
  lead,
  directors,
  now,
  onMove,
}: {
  lead: LiveLead;
  directors: Director[];
  now: Date;
  onMove: CardMoveHandler;
}) {
  const { pursuit, nextAction } = lead;
  const days = daysInStage(pursuit.stageChangedAt, now);
  const overdue = isOverdue(nextAction?.dueDate, now);
  const detail = [pursuit.disputeNature, pursuit.approximateValue].filter(Boolean).join(" · ");

  return (
    <article className="group panel-brackets relative border border-green/10 bg-parchment p-4 transition-colors hover:border-brass/40 focus-within:border-brass/40">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/portal/pursuits/${pursuit.id}`} className="font-serif text-[19px] leading-tight text-green hover:text-brass">
          {pursuit.firm}
        </Link>
        <div className="shrink-0 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
          <MoveToMenu
            current={pursuit.stage}
            onMove={(to, reason, due) => onMove(pursuit.id, to, reason, due)}
            label="Move"
            buttonClassName="btn-quiet text-[11px]"
          />
        </div>
      </div>
      <p className="mt-1 text-[12px] text-ink/70">{detail || "No details yet"}</p>
      <div className="mt-3 flex items-center gap-2 text-[12px] text-ink/70">
        <OwnerAvatar initials={directorInitials(directors, pursuit.ownerId)} name={directorName(directors, pursuit.ownerId)} />
        <span className="font-mono text-[11px] tracking-[0.05em]">
          {`In ${stageLabel(pursuit.stage).toLowerCase()} for ${days} ${days === 1 ? "day" : "days"}`}
        </span>
      </div>
      <p className={`mt-3 flex items-start gap-2 text-[14px] ${overdue ? "text-oxblood" : "text-green/90"}`}>
        {nextAction?.title ? (
          <>
            <span aria-hidden="true" className="mt-[3px] text-[9px]">
              {overdue ? "●" : "▸"}
            </span>
            <span>
              {nextAction?.title}
              {nextAction?.dueDate && (
                <span className="ml-2 text-[14px]">
                  {overdue ? "overdue" : dueLabel(nextAction?.dueDate)}
                </span>
              )}
            </span>
          </>
        ) : (
          <span className="text-ink/70">No next action</span>
        )}
      </p>
      {nextAction && <p className="mt-1 text-[14px] text-ink/70">{actionStateLabels[nextAction.state]} · Action assignee: {nextAction.ownerName}</p>}
    </article>
  );
}
