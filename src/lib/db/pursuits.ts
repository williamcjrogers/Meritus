import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { requireDb } from "./index";
import { pursuits, type NewPursuit, type Pursuit, type PursuitStage } from "./schema";

export const ACTIVE_STAGES: readonly PursuitStage[] = ["enquiry", "scoping", "proposal"];

export async function getPursuit(id: string): Promise<Pursuit | null> {
  const db = requireDb();
  const [row] = await db.select().from(pursuits).where(eq(pursuits.id, id)).limit(1);
  return row ?? null;
}

/** Enquiries from the site that no director has taken yet, oldest first. */
export async function listInbox(): Promise<Pursuit[]> {
  const db = requireDb();
  return db
    .select()
    .from(pursuits)
    .where(and(isNull(pursuits.ownerId), eq(pursuits.stage, "enquiry")))
    .orderBy(pursuits.createdAt);
}

/** Owned pursuits in the three active stages. Sorting into columns happens in lib/portal/board. */
export async function listBoard(): Promise<Pursuit[]> {
  const db = requireDb();
  return db
    .select()
    .from(pursuits)
    .where(and(inArray(pursuits.stage, [...ACTIVE_STAGES]), sql`${pursuits.ownerId} is not null`))
    .orderBy(desc(pursuits.updatedAt));
}

export async function listByStage(stage: PursuitStage): Promise<Pursuit[]> {
  const db = requireDb();
  return db
    .select()
    .from(pursuits)
    .where(eq(pursuits.stage, stage))
    .orderBy(desc(pursuits.stageChangedAt));
}

export async function countByStage(): Promise<Record<PursuitStage, number>> {
  const db = requireDb();
  const rows = await db
    .select({ stage: pursuits.stage, count: sql<number>`count(*)` })
    .from(pursuits)
    .groupBy(pursuits.stage);
  const counts = {
    enquiry: 0,
    scoping: 0,
    proposal: 0,
    instructed: 0,
    declined: 0,
    dormant: 0,
  } as Record<PursuitStage, number>;
  for (const row of rows) counts[row.stage] = Number(row.count);
  return counts;
}

/** The open pursuit (enquiry, scoping or proposal) for an email address, if any. */
export async function findOpenPursuitByEmail(email: string): Promise<Pursuit | null> {
  const db = requireDb();
  const [row] = await db
    .select()
    .from(pursuits)
    .where(
      and(eq(pursuits.contactEmail, email.toLowerCase()), inArray(pursuits.stage, [...ACTIVE_STAGES]))
    )
    .orderBy(desc(pursuits.updatedAt))
    .limit(1);
  return row ?? null;
}

export async function createPursuit(values: NewPursuit): Promise<Pursuit> {
  const db = requireDb();
  const [row] = await db.insert(pursuits).values(values).returning();
  return row;
}

export type PursuitPatch = Partial<
  Pick<
    Pursuit,
    | "firm"
    | "contactName"
    | "contactEmail"
    | "website"
    | "companyNumber"
    | "disputeNature"
    | "approximateValue"
    | "forum"
    | "summary"
    | "source"
    | "sourceDetail"
    | "ownerId"
    | "stage"
    | "stageChangedAt"
    | "nextAction"
    | "nextActionDue"
  >
>;

export async function updatePursuit(id: string, values: PursuitPatch): Promise<Pursuit | null> {
  const db = requireDb();
  const [row] = await db
    .update(pursuits)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(pursuits.id, id))
    .returning();
  return row ?? null;
}

export async function touchPursuit(id: string): Promise<void> {
  const db = requireDb();
  await db.update(pursuits).set({ updatedAt: new Date() }).where(eq(pursuits.id, id));
}

export async function deletePursuit(id: string): Promise<void> {
  const db = requireDb();
  await db.delete(pursuits).where(eq(pursuits.id, id));
}
