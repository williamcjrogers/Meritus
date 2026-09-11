import type {
  ProspectConflict,
  ProspectEvidence,
  ProspectOutreach,
} from "@/lib/db/schema";

export const PROSPECT_VIEWS = [
  "approachable",
  "conflicted",
  "all",
  "excluded",
] as const;

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

export function isProspectView(value: string): value is ProspectView {
  return (PROSPECT_VIEWS as readonly string[]).includes(value);
}

export function isProspectOutreach(value: string): value is ProspectOutreach {
  return (PROSPECT_OUTREACH_STATUSES as readonly string[]).includes(value);
}

export function defaultOutreach(tier: ProspectConflict): ProspectOutreach {
  switch (tier) {
    case "latent_conflict":
      return "unworked";
    case "hard_conflict":
    case "competitor":
    case "related_party":
    case "excluded":
    case "other":
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
      return "Hard conflict";
    case "latent_conflict":
      return "Latent conflict";
    case "competitor":
      return "Competitor / adviser";
    case "related_party":
      return "Related party";
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
      return "BREE is adverse on a live tracker matter. Do not approach while that matter is live.";
    case "latent_conflict":
      return "No live adverse matter, but a BREE-lineage relationship exists. A conflict check is still required before any approach.";
    case "competitor":
      return "Sells forensic or dispute services, or is already instructed on the BREE side.";
    case "related_party":
      return "Inside the BREE group or lineage. Internal work, not business development.";
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
    case "conflicted":
      return "Conflicted";
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
      return "Latent conflict only. These are the firms to target, subject to a conflict check and informed consent.";
    case "conflicted":
      return "Hard conflicts, competitors, and related parties. High value, but not approachable as clients today.";
    case "all":
      return "The full ranked list, including conflicted counterparties.";
    case "excluded":
      return "Dissolved, insolvent, generic, or composite tracker entries. Kept so they are not approached by mistake.";
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
