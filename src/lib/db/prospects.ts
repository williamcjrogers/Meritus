import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { ProspectView } from "@/lib/prospects/model";
import { requireDb } from "./index";
import {
  prospects,
  type NewProspect,
  type Prospect,
  type ProspectConflict,
  type ProspectOutreach,
} from "./schema";

function conflictTiersForView(view: ProspectView): ProspectConflict[] | null {
  switch (view) {
    case "approachable":
      return ["latent_conflict"];
    case "conflicted":
      return ["hard_conflict", "competitor", "related_party"];
    case "excluded":
      return ["excluded"];
    case "all":
      return null;
    default: {
      const exhaustive: never = view;
      return exhaustive;
    }
  }
}

export async function countProspects(): Promise<number> {
  const db = requireDb();
  const rows = await db.select({ count: sql<number>`count(*)` }).from(prospects);
  return Number(rows[0]?.count ?? 0);
}

export async function countApproachableProspects(): Promise<number> {
  const db = requireDb();
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(prospects)
    .where(eq(prospects.conflictTier, "latent_conflict"));
  return Number(rows[0]?.count ?? 0);
}

export async function countProspectsByView(): Promise<Record<ProspectView, number>> {
  const db = requireDb();
  const rows = await db
    .select({
      tier: prospects.conflictTier,
      count: sql<number>`count(*)`,
    })
    .from(prospects)
    .groupBy(prospects.conflictTier);

  const byTier = Object.fromEntries(rows.map((row) => [row.tier, Number(row.count)])) as Partial<
    Record<ProspectConflict, number>
  >;

  return {
    approachable: byTier.latent_conflict ?? 0,
    conflicted:
      (byTier.hard_conflict ?? 0) + (byTier.competitor ?? 0) + (byTier.related_party ?? 0),
    excluded: byTier.excluded ?? 0,
    all: rows.reduce((sum, row) => sum + Number(row.count), 0),
  };
}

export async function listProspects(view: ProspectView = "approachable"): Promise<Prospect[]> {
  const db = requireDb();
  const tiers = conflictTiersForView(view);
  const query = db.select().from(prospects);
  const filtered = tiers ? query.where(inArray(prospects.conflictTier, tiers)) : query;
  return filtered.orderBy(
    sql`${prospects.rank} asc nulls last`,
    desc(prospects.valueScore),
    asc(prospects.organisation)
  );
}

export async function getProspect(id: string): Promise<Prospect | null> {
  const db = requireDb();
  const [row] = await db.select().from(prospects).where(eq(prospects.id, id)).limit(1);
  return row ?? null;
}

export async function upsertProspects(rows: NewProspect[]): Promise<void> {
  const db = requireDb();
  const chunkSize = 40;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await db
      .insert(prospects)
      .values(chunk)
      .onConflictDoUpdate({
        target: prospects.id,
        set: {
          organisation: sql`excluded.organisation`,
          organisationType: sql`excluded.organisation_type`,
          conflictTier: sql`excluded.conflict_tier`,
          rank: sql`excluded.rank`,
          need: sql`excluded.need`,
          gap: sql`excluded.gap`,
          capacity: sql`excluded.capacity`,
          access: sql`excluded.access`,
          valueScore: sql`excluded.value_score`,
          evidence: sql`excluded.evidence`,
          whyTheyNeedYou: sql`excluded.why_they_need_you`,
          routeInNote: sql`excluded.route_in_note`,
          sourceList: sql`excluded.source_list`,
          updatedAt: sql`now()`,
        },
      });
  }
}

export async function updateProspect(
  id: string,
  values: Partial<{
    outreachStatus: ProspectOutreach;
    partnerNotes: string | null;
    convertedPursuitId: string | null;
  }>
): Promise<Prospect | null> {
  const db = requireDb();
  const [row] = await db
    .update(prospects)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(prospects.id, id))
    .returning();
  return row ?? null;
}
