"use client";

import type { BoardColumns, BoardStage } from "@/lib/portal/board";
import { BOARD_STAGES, stageLabel } from "@/lib/portal/stages";
import type { Director } from "@/lib/portal/directors";
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
          <Eyebrow>
            {stageLabel(stage)} <span className="text-ink/60">({counts[stage]})</span>
          </Eyebrow>
          <div className="mt-4 space-y-3">
            {columns[stage].length === 0 ? (
              <p className="border border-dashed border-green/15 px-4 py-6 text-center text-[12px] text-ink/50">Nothing at {stageLabel(stage).toLowerCase()}</p>
            ) : (
              columns[stage].map((pursuit) => (
                <PursuitCard key={pursuit.id} pursuit={pursuit} directors={directors} now={now} onMove={onMove} />
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
