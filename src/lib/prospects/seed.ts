import type { NewProspect, ProspectConflict, ProspectEvidence, ProspectSourceList } from "@/lib/db/schema";
import { countProspects, upsertProspects } from "@/lib/db/prospects";
import { defaultOutreach } from "./model";
import seed from "./bree-seed.json";

type SeedRow = {
  id: string;
  rank: number | null;
  organisation: string;
  organisationType: string | null;
  conflictTier: ProspectConflict;
  need: number | null;
  gap: number | null;
  capacity: number | null;
  access: number | null;
  valueScore: number | null;
  evidence: ProspectEvidence | null;
  whyTheyNeedYou: string | null;
  routeInNote: string | null;
  sourceList: ProspectSourceList;
};

export function seedProspectValues(): NewProspect[] {
  return (seed.prospects as SeedRow[]).map((row) => ({
    id: row.id,
    organisation: row.organisation,
    organisationType: row.organisationType,
    conflictTier: row.conflictTier,
    rank: row.rank,
    need: row.need,
    gap: row.gap,
    capacity: row.capacity,
    access: row.access,
    valueScore: row.valueScore,
    evidence: row.evidence,
    whyTheyNeedYou: row.whyTheyNeedYou,
    routeInNote: row.routeInNote,
    sourceList: row.sourceList,
    outreachStatus: defaultOutreach(row.conflictTier),
  }));
}

export async function ensureProspectsSeeded(): Promise<number> {
  const existing = await countProspects();
  if (existing > 0) return existing;
  await upsertProspects(seedProspectValues());
  return countProspects();
}
