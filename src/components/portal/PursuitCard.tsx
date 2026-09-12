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
    <article className="group app-panel relative border border-line bg-surface p-4 transition-colors hover:border-primary/40 focus-within:border-primary/40">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/portal/pursuits/${pursuit.id}`} className="font-sans text-[19px] leading-tight text-primary hover:text-primary">
          {pursuit.firm}
        </Link>
        <div className="shrink-0 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
          <MoveToMenu
            current={pursuit.stage}
            onMove={(to, reason, due) => onMove(pursuit.id, to, reason, due)}
            label="Move"
            buttonClassName="app-button app-button--ghost text-[13px]"
          />
        </div>
      </div>
      <p className="mt-1 text-[13px] text-muted">{detail || "No details yet"}</p>
      <div className="mt-3 flex items-center gap-2 text-[13px] text-muted">
        <OwnerAvatar initials={directorInitials(directors, pursuit.ownerId)} name={directorName(directors, pursuit.ownerId)} />
        <span className="font-sans text-[13px] ">
          {`In ${stageLabel(pursuit.stage).toLowerCase()} for ${days} ${days === 1 ? "day" : "days"}`}
        </span>
      </div>
      <p className={`mt-3 flex items-start gap-2 text-[15px] ${overdue ? "text-danger" : "text-primary/90"}`}>
        {nextAction?.title ? (
          <>
            <span aria-hidden="true" className="mt-[3px] text-[13px]">
              {overdue ? "●" : "▸"}
            </span>
            <span>
              {nextAction?.title}
              {nextAction?.dueDate && (
                <span className="ml-2 text-[15px]">
                  {overdue ? "overdue" : dueLabel(nextAction?.dueDate)}
                </span>
              )}
            </span>
          </>
        ) : (
          <span className="text-muted">No next action</span>
        )}
      </p>
      {nextAction && <p className="mt-1 text-[15px] text-muted">{actionStateLabels[nextAction.state]} · Action assignee: {nextAction.ownerName}</p>}
    </article>
  );
}
