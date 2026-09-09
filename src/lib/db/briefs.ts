import { and, desc, eq, sql } from "drizzle-orm";
import { requireDb } from "./index";
import { briefs, type Brief, type BriefAnalysisLine, type BriefFacts } from "./schema";

export async function latestBrief(pursuitId: string): Promise<Brief | null> {
  const db = requireDb();
  const [row] = await db
    .select()
    .from(briefs)
    .where(eq(briefs.pursuitId, pursuitId))
    .orderBy(desc(briefs.createdAt))
    .limit(1);
  return row ?? null;
}

export async function latestCompleteBrief(pursuitId: string): Promise<Brief | null> {
  const db = requireDb();
  const [row] = await db
    .select()
    .from(briefs)
    .where(and(eq(briefs.pursuitId, pursuitId), eq(briefs.status, "complete")))
    .orderBy(desc(briefs.createdAt))
    .limit(1);
  return row ?? null;
}

export async function getBrief(id: string): Promise<Brief | null> {
  const db = requireDb();
  const [row] = await db.select().from(briefs).where(eq(briefs.id, id)).limit(1);
  return row ?? null;
}

/** Marks runs still "running" after two minutes as failed so a stuck run never blocks a new one. */
export async function expireStaleRuns(pursuitId: string): Promise<void> {
  const db = requireDb();
  await db
    .update(briefs)
    .set({ status: "failed", error: "Superseded by a newer run" })
    .where(
      and(
        eq(briefs.pursuitId, pursuitId),
        eq(briefs.status, "running"),
        sql`${briefs.createdAt} < now() - interval '2 minutes'`
      )
    );
}

export async function createBriefRun(values: { pursuitId: string; createdBy: string }): Promise<Brief> {
  const db = requireDb();
  const [row] = await db
    .insert(briefs)
    .values({ id: crypto.randomUUID(), pursuitId: values.pursuitId, createdBy: values.createdBy })
    .returning();
  return row;
}

export async function completeBrief(
  id: string,
  values: { facts: BriefFacts | null; analysis: BriefAnalysisLine[]; summary: string; sources: string[] }
): Promise<void> {
  const db = requireDb();
  await db
    .update(briefs)
    .set({ status: "complete", error: null, ...values })
    .where(eq(briefs.id, id));
}

export async function failBrief(id: string, error: string): Promise<void> {
  const db = requireDb();
  await db.update(briefs).set({ status: "failed", error }).where(eq(briefs.id, id));
}
