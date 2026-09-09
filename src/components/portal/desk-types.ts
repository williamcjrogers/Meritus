import type { AlertOutcome, PursuitStage } from "@/lib/db/schema";

/** A pointer to another pursuit that shares the contact email or firm. */
export type RelatedRef = { id: string; firm: string; stage: PursuitStage; date: string };

export type DeskExtras = {
  related: Record<string, RelatedRef[]>;
  alerts: Record<string, AlertOutcome | undefined>;
  reopenStages: Record<string, PursuitStage>;
};
