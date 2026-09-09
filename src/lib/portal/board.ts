import type { Pursuit } from "@/lib/db/schema";
import { isOverdue } from "./dates";
import { BOARD_STAGES, isActiveStage } from "./stages";

export type Scope = "mine" | "all";

export type BoardStage = (typeof BOARD_STAGES)[number];

export type BoardColumns = Record<BoardStage, Pursuit[]>;

export type DeskPartition = {
  /** Unowned pursuits in an active stage, oldest first. Never filtered by scope. */
  inbox: Pursuit[];
  /** Dormant pursuits past their revisit date, soonest due first. Never filtered by scope. */
  revisit: Pursuit[];
  /** Owned pursuits in the active stages, one sorted column per stage. */
  board: BoardColumns;
  /** Column sizes after the scope filter. */
  counts: Record<BoardStage, number>;
};

function byStageChangedAt(a: Pursuit, b: Pursuit): number {
  return a.stageChangedAt.getTime() - b.stageChangedAt.getTime();
}

function byDue(a: Pursuit, b: Pursuit): number {
  return (a.nextActionDue ?? "").localeCompare(b.nextActionDue ?? "");
}

/** 0 overdue, 1 due on or after today, 2 no due date. */
function tier(pursuit: Pursuit, now: Date): number {
  if (!pursuit.nextActionDue) return 2;
  return isOverdue(pursuit.nextActionDue, now) ? 0 : 1;
}

/**
 * Column order: overdue next actions first by due date, then dated next actions
 * by due date, then the rest with the longest waiting first. Returns a new array.
 */
export function sortColumn(pursuits: Pursuit[], now: Date = new Date()): Pursuit[] {
  const ranked = pursuits.map((pursuit) => ({ pursuit, tier: tier(pursuit, now) }));
  ranked.sort(
    (a, b) =>
      a.tier - b.tier || byDue(a.pursuit, b.pursuit) || byStageChangedAt(a.pursuit, b.pursuit)
  );
  return ranked.map((entry) => entry.pursuit);
}

function emptyColumns(): BoardColumns {
  return { enquiry: [], scoping: [], proposal: [] };
}

function isBoardStage(stage: Pursuit["stage"]): stage is BoardStage {
  return (BOARD_STAGES as readonly string[]).includes(stage);
}

export function partitionDesk(
  pursuits: Pursuit[],
  opts: { scope: Scope; userId: string; now?: Date }
): DeskPartition {
  const now = opts.now ?? new Date();

  const inbox = pursuits
    .filter((p) => p.ownerId === null && isActiveStage(p.stage))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const revisit = pursuits
    .filter((p) => p.stage === "dormant" && isOverdue(p.nextActionDue, now))
    .sort(byDue);

  const columns = emptyColumns();
  for (const pursuit of pursuits) {
    if (pursuit.ownerId === null || !isBoardStage(pursuit.stage)) continue;
    if (opts.scope === "mine" && pursuit.ownerId !== opts.userId) continue;
    columns[pursuit.stage].push(pursuit);
  }

  const board = emptyColumns();
  const counts = { enquiry: 0, scoping: 0, proposal: 0 };
  for (const stage of BOARD_STAGES) {
    board[stage] = sortColumn(columns[stage], now);
    counts[stage] = board[stage].length;
  }

  return { inbox, revisit, board, counts };
}
