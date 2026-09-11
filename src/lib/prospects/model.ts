import type {
  ProspectConflict,
  ProspectEvidence,
  ProspectOutreach,
} from "@/lib/db/schema";

export const PROSPECT_VIEWS = ["approachable", "all", "excluded"] as const;

export type ProspectView = (typeof PROSPECT_VIEWS)[number];

export const PROSPECT_OUTREACH_STATUSES: readonly ProspectOutreach[] = [
  "unworked",
  "approaching",
  "contacted",
  "parked",
  "converted",
  "do_not_approach",
] as const;

export const SCORE_WEIGHTS = {
  need: 0.35,
  gap: 0.25,
  capacity: 0.25,
  access: 0.15,
} as const;

/** Firms worth targeting. Legacy tracker-category tiers stay in the enum but rank here. */
export const APPROACHABLE_TIERS: readonly ProspectConflict[] = [
  "latent_conflict",
  "hard_conflict",
  "related_party",
  "other",
];

/** True non-clients: competitors/advisers and dissolved, insolvent, or generic rows. */
export const EXCLUDED_TIERS: readonly ProspectConflict[] = ["excluded", "competitor"];

export function isProspectView(value: string): value is ProspectView {
  return (PROSPECT_VIEWS as readonly string[]).includes(value);
}

export function isProspectOutreach(value: string): value is ProspectOutreach {
  return (PROSPECT_OUTREACH_STATUSES as readonly string[]).includes(value);
}

export function isApproachableTier(tier: ProspectConflict): boolean {
  return (APPROACHABLE_TIERS as readonly string[]).includes(tier);
}

export function defaultOutreach(tier: ProspectConflict): ProspectOutreach {
  switch (tier) {
    case "latent_conflict":
    case "hard_conflict":
    case "related_party":
    case "other":
      return "unworked";
    case "competitor":
    case "excluded":
      return "do_not_approach";
    default: {
      const exhaustive: never = tier;
      return exhaustive;
    }
  }
}

export function conflictTierLabel(tier: ProspectConflict): string {
  switch (tier) {
    case "hard_conflict":
    case "latent_conflict":
    case "related_party":
      return "Ranked";
    case "competitor":
      return "Competitor / adviser";
    case "excluded":
      return "Excluded";
    case "other":
      return "Other";
    default: {
      const exhaustive: never = tier;
      return exhaustive;
    }
  }
}

export function conflictTierHint(tier: ProspectConflict): string {
  switch (tier) {
    case "hard_conflict":
    case "latent_conflict":
    case "related_party":
      return "Ranked by need, gap, capacity and access. A firm worth targeting.";
    case "competitor":
      return "Sells forensic or dispute services, or already acts as an adviser. Not a client.";
    case "excluded":
      return "Dissolved, insolvent, generic, or too small to treat as a prospect.";
    case "other":
      return "Review the notes before any approach.";
    default: {
      const exhaustive: never = tier;
      return exhaustive;
    }
  }
}

export function evidenceLabel(evidence: ProspectEvidence | null): string {
  if (!evidence) return "—";
  switch (evidence) {
    case "researched":
      return "Researched";
    case "tracker":
      return "Tracker";
    case "sector_profile":
      return "Sector profile";
    default: {
      const exhaustive: never = evidence;
      return exhaustive;
    }
  }
}

export function outreachLabel(status: ProspectOutreach): string {
  switch (status) {
    case "unworked":
      return "Unworked";
    case "approaching":
      return "Approaching";
    case "contacted":
      return "Contacted";
    case "parked":
      return "Parked";
    case "converted":
      return "Opened as lead";
    case "do_not_approach":
      return "Do not approach";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export function prospectViewLabel(view: ProspectView): string {
  switch (view) {
    case "approachable":
      return "Approachable";
    case "all":
      return "All ranked";
    case "excluded":
      return "Excluded";
    default: {
      const exhaustive: never = view;
      return exhaustive;
    }
  }
}

export function prospectViewDescription(view: ProspectView): string {
  switch (view) {
    case "approachable":
      return "Firms worth targeting, ranked by need, gap, capacity and access.";
    case "all":
      return "The full list, including firms that are not clients.";
    case "excluded":
      return "Competitors, advisers, dissolved, insolvent, generic, or composite tracker entries. Kept so they are not approached by mistake.";
    default: {
      const exhaustive: never = view;
      return exhaustive;
    }
  }
}

export function scoreBarWidth(score: number | null, max = 5): string {
  if (score == null || max <= 0) return "0%";
  return `${Math.max(0, Math.min(100, (score / max) * 100))}%`;
}
