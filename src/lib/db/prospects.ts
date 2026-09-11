import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  APPROACHABLE_TIERS,
  EXCLUDED_TIERS,
  type ProspectView,
} from "@/lib/prospects/model";
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
      return [...APPROACHABLE_TIERS];
    case "excluded":
      return [...EXCLUDED_TIERS];
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

export async function countProspectsWithTiers(tiers: ProspectConflict[]): Promise<number> {
  if (tiers.length === 0) return 0;
  const db = requireDb();
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(prospects)
    .where(inArray(prospects.conflictTier, tiers));
  return Number(rows[0]?.count ?? 0);
}

export async function resetUnconvertedApproachableOutreach(): Promise<void> {
  const db = requireDb();
  await db
    .update(prospects)
    .set({ outreachStatus: "unworked", updatedAt: new Date() })
    .where(
      and(
        inArray(prospects.conflictTier, [...APPROACHABLE_TIERS]),
        eq(prospects.outreachStatus, "do_not_approach"),
        isNull(prospects.convertedPursuitId)
      )
    );
}

export async function countApproachableProspects(): Promise<number> {
  const db = requireDb();
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(prospects)
    .where(inArray(prospects.conflictTier, [...APPROACHABLE_TIERS]));
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

  const sumTiers = (tiers: readonly ProspectConflict[]) =>
    tiers.reduce((sum, tier) => sum + (byTier[tier] ?? 0), 0);

  return {
    approachable: sumTiers(APPROACHABLE_TIERS),
    excluded: sumTiers(EXCLUDED_TIERS),
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
