"use client";

import { startTransition, useMemo, useOptimistic } from "react";
import type { Pursuit, PursuitStage } from "@/lib/db/schema";
import { partitionDesk, type Scope } from "@/lib/portal/board";
import type { Director } from "@/lib/portal/director-helpers";
import { declinePursuit, movePursuit, reopenPursuit, takePursuit } from "@/lib/portal/actions";
import type { ActionResult } from "@/lib/portal/types";
import { Board } from "./Board";
import { Eyebrow } from "./Eyebrow";
import { InboxRow } from "./InboxRow";
import { MineAllToggle } from "./MineAllToggle";
import { RevisitRow } from "./RevisitRow";
import type { DeskExtras } from "./desk-types";

type Patch = { id: string; changes: Partial<Pursuit> };

/**
 * Owns the optimistic list behind the inbox strip, the revisit strip and the
 * board, so Take can remove a row and add a card in one render.
 */
export function Desk({
  pursuits,
  extras,
  directors,
  userId,
  scope,
  now,
}: {
  pursuits: Pursuit[];
  extras: DeskExtras;
  directors: Director[];
  userId: string;
  scope: Scope;
  now: string;
}) {
  const nowDate = useMemo(() => new Date(now), [now]);
  const [list, applyPatch] = useOptimistic(pursuits, (state: Pursuit[], patch: Patch) =>
    state.map((pursuit) => (pursuit.id === patch.id ? { ...pursuit, ...patch.changes } : pursuit))
  );

  function run(patch: Patch, action: () => Promise<ActionResult>): Promise<ActionResult> {
    return new Promise((resolve) => {
      startTransition(async () => {
        applyPatch(patch);
        try {
          resolve(await action());
        } catch (error) {
          resolve({ ok: false, error: error instanceof Error ? error.message : "Something went wrong" });
        }
      });
    });
  }

  const take = (id: string) => run({ id, changes: { ownerId: userId } }, () => takePursuit(id));
  const decline = (id: string, reason: string) =>
    run({ id, changes: { stage: "declined", ownerId: userId, stageChangedAt: nowDate } }, () => declinePursuit(id, reason));
  const move = (id: string, to: PursuitStage, reason?: string, revisitDue?: string) =>
    run(
      { id, changes: { stage: to, stageChangedAt: nowDate, ...(revisitDue ? { nextActionDue: revisitDue } : {}) } },
      () => movePursuit(id, to, reason, revisitDue)
    );
  const reopen = (id: string) =>
    run({ id, changes: { stage: extras.reopenStages[id] ?? "enquiry", stageChangedAt: nowDate } }, () => reopenPursuit(id));

  const { inbox, revisit, board, counts } = partitionDesk(list, { scope, userId, now: nowDate });

  return (
    <div className="space-y-10">
      {inbox.length > 0 && (
        <section aria-label="Inbox">
          <Eyebrow>
            Inbox{" "}
            <span className="text-ink/60">
              {inbox.length} {inbox.length === 1 ? "enquiry" : "enquiries"} awaiting a director
            </span>
          </Eyebrow>
          <div className="panel-brackets mt-4 divide-y divide-green/10 border border-green/10 bg-parchment">
            {inbox.map((pursuit) => (
              <InboxRow
                key={pursuit.id}
                pursuit={pursuit}
                related={extras.related[pursuit.id]}
                alert={extras.alerts[pursuit.id]}
                directors={directors}
                now={nowDate}
                onTake={take}
                onDecline={decline}
              />
            ))}
          </div>
        </section>
      )}

      {revisit.length > 0 && (
        <section aria-label="Revisit">
          <Eyebrow>
            Revisit{" "}
            <span className="text-ink/60">
              {revisit.length} dormant {revisit.length === 1 ? "pursuit" : "pursuits"} past the revisit date
            </span>
          </Eyebrow>
          <div className="mt-4 divide-y divide-green/10 border border-green/10 bg-parchment/70">
            {revisit.map((pursuit) => (
              <RevisitRow
                key={pursuit.id}
                pursuit={pursuit}
                reopenStage={extras.reopenStages[pursuit.id] ?? "enquiry"}
                directors={directors}
                onReopen={reopen}
              />
            ))}
          </div>
        </section>
      )}

      <section aria-label="Pipeline">
        <div className="mb-4 flex items-center justify-end">
          <MineAllToggle scope={scope} />
        </div>
        <Board columns={board} counts={counts} directors={directors} now={nowDate} onMove={move} />
      </section>
    </div>
  );
}
