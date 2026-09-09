import type { Activity, PursuitStage } from "@/lib/db/schema";

/** The three stages shown as board columns, in order. */
export const BOARD_STAGES = ["enquiry", "scoping", "proposal"] as const;

/** Stages in which a pursuit is still being worked. Everything else is terminal or parked. */
export const ACTIVE_STAGES: readonly PursuitStage[] = BOARD_STAGES;

export const STAGE_LABELS: Record<PursuitStage, string> = {
  enquiry: "Enquiry",
  scoping: "Scoping",
  proposal: "Proposal",
  instructed: "Instructed",
  declined: "Declined",
  dormant: "Dormant",
};

/**
 * Every stage, in schema order. Taken from the labels rather than the schema so
 * this module only imports types from the database layer and can ship to the client.
 */
const ALL_STAGES = Object.keys(STAGE_LABELS) as readonly PursuitStage[];

export function stageLabel(stage: PursuitStage): string {
  return STAGE_LABELS[stage];
}

export function isActiveStage(stage: PursuitStage): boolean {
  return ACTIVE_STAGES.includes(stage);
}

export function isPursuitStage(value: string): value is PursuitStage {
  return (ALL_STAGES as readonly string[]).includes(value);
}

/** Declined and Dormant carry a reason; the other stages do not. */
export function requiresReason(to: PursuitStage): boolean {
  return to === "declined" || to === "dormant";
}

export const MIN_REASON_LENGTH = 3;

export function validateMove(
  from: PursuitStage,
  to: PursuitStage,
  reason?: string | null
): { ok: true } | { ok: false; error: string } {
  if (from === to) {
    return { ok: false, error: `Already at ${stageLabel(to)}` };
  }
  if (requiresReason(to) && (reason ?? "").trim().length < MIN_REASON_LENGTH) {
    return { ok: false, error: "Give a reason (at least three characters)" };
  }
  return { ok: true };
}

/**
 * The stage a declined or dormant pursuit returns to: the `from` on the latest
 * stage change into Declined or Dormant when that stage is active, else Enquiry.
 * The list may be in any order; the newest matching entry wins.
 */
export function resolveReopenStage(activity: Activity[]): PursuitStage {
  let latest: Activity | null = null;
  for (const entry of activity) {
    if (entry.kind !== "stage_changed") continue;
    const to = entry.meta?.to;
    if (!to || !requiresReason(to)) continue;
    if (!latest || entry.createdAt.getTime() > latest.createdAt.getTime()) {
      latest = entry;
    }
  }
  const from = latest?.meta?.from;
  return from && isActiveStage(from) ? from : "enquiry";
}
