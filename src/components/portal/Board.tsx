"use client";

import type { BoardColumns, BoardStage } from "@/lib/portal/board";
import { BOARD_STAGES, stageLabel } from "@/lib/portal/stages";
import type { Director } from "@/lib/portal/director-helpers";
import { Eyebrow } from "./Eyebrow";
import { PursuitCard, type CardMoveHandler } from "./PursuitCard";

export function Board({
  columns,
  counts,
  directors,
  now,
  onMove,
}: {
  columns: BoardColumns;
  counts: Record<BoardStage, number>;
  directors: Director[];
  now: Date;
  onMove: CardMoveHandler;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {BOARD_STAGES.map((stage) => (
        <section key={stage} aria-label={`${stageLabel(stage)} column`} className="min-w-0">
          {/* On a phone each column folds behind its heading; from md up the heading is plain. */}
          <details open className="group">
            <summary className="cursor-pointer list-none md:pointer-events-none [&::-webkit-details-marker]:hidden">
              <Eyebrow>
                {stageLabel(stage)} <span className="text-muted">({counts[stage]})</span>
                <span aria-hidden="true" className="ml-2 inline-block text-[13px] transition-transform group-open:rotate-180 md:hidden">▾</span>
              </Eyebrow>
            </summary>
            <div className="mt-4 space-y-3">
              {columns[stage].length === 0 ? (
                <p className="border border-dashed border-line px-4 py-6 text-center text-[13px] text-muted">Nothing at {stageLabel(stage).toLowerCase()}</p>
              ) : (
                columns[stage].map((pursuit) => (
                  <PursuitCard key={pursuit.pursuit.id} lead={pursuit} directors={directors} now={now} onMove={onMove} />
                ))
              )}
            </div>
          </details>
        </section>
      ))}
    </div>
  );
}
