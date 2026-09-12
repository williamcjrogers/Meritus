import type { LiveLead } from "./live-leads";
import type { Pursuit } from "@/lib/db/schema";
import { isOverdue } from "./dates";
import { BOARD_STAGES, isActiveStage } from "./stages";

export type Scope = "mine" | "all";

export type BoardStage = (typeof BOARD_STAGES)[number];

export type BoardColumns = Record<BoardStage, LiveLead[]>;

export type DeskPartition = {
  /** Unowned pursuits in an active stage, oldest first. Never filtered by scope. */
  inbox: LiveLead[];
  /** Dormant pursuits past their revisit date, soonest due first. Never filtered by scope. */
  revisit: LiveLead[];
  /** Owned pursuits in the active stages, one sorted column per stage. */
  board: BoardColumns;
  /** Column sizes after the scope filter. */
  counts: Record<BoardStage, number>;
};

function byStageChangedAt(a: LiveLead, b: LiveLead): number {
  return a.pursuit.stageChangedAt.getTime() - b.pursuit.stageChangedAt.getTime();
}

function byDue(a: LiveLead, b: LiveLead): number {
  return (a.nextAction?.dueDate ?? "").localeCompare(b.nextAction?.dueDate ?? "");
}

/** 0 overdue, 1 due on or after today, 2 no due date. */
function tier(pursuit: LiveLead, now: Date): number {
  if (!pursuit.nextAction?.dueDate) return 2;
  return isOverdue(pursuit.nextAction?.dueDate, now) ? 0 : 1;
}

/**
 * Column order: overdue next actions first by due date, then dated next actions
 * by due date, then the rest with the longest waiting first. Returns a new array.
 */
export function sortColumn(pursuits: LiveLead[], now: Date = new Date()): LiveLead[] {
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
  pursuits: LiveLead[],
  opts: { scope: Scope; userId: string; now?: Date }
): DeskPartition {
  const now = opts.now ?? new Date();

  const inbox = pursuits
    .filter((p) => p.pursuit.ownerId === null && isActiveStage(p.pursuit.stage))
    .sort((a, b) => b.pursuit.createdAt.getTime() - a.pursuit.createdAt.getTime());

  const revisit = pursuits
    .filter((p) => p.pursuit.stage === "dormant" && isOverdue(p.reviewDue, now))
    .sort((a, b) => (a.reviewDue ?? "").localeCompare(b.reviewDue ?? ""));

  const columns = emptyColumns();
  for (const pursuit of pursuits) {
    if (pursuit.pursuit.ownerId === null || !isBoardStage(pursuit.pursuit.stage)) continue;
    if (opts.scope === "mine" && pursuit.pursuit.ownerId !== opts.userId) continue;
    columns[pursuit.pursuit.stage].push(pursuit);
  }

  const board = emptyColumns();
  const counts = { enquiry: 0, scoping: 0, proposal: 0 };
  for (const stage of BOARD_STAGES) {
    board[stage] = sortColumn(columns[stage], now);
    counts[stage] = board[stage].length;
  }

  return { inbox, revisit, board, counts };
}
