import { maskResearchPursuitSummaries, maskResearchPursuitSummary } from "./research-workflow";
import { and, asc, desc, eq, gte, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { normaliseFirm } from "@/lib/portal/intake";
import { requireDb } from "./index";
import {
  activity as activityTable,
  pursuits,
  type Activity,
  type ActivityKind,
  type ActivityMeta,
  type NewPursuit,
  type Pursuit,
  type PursuitStage,
} from "./schema";

export const ACTIVE_STAGES: readonly PursuitStage[] = ["enquiry", "scoping", "proposal"];

export async function getPursuit(id: string): Promise<Pursuit | null> {
  const db = requireDb();
  const [row] = await db.select().from(pursuits).where(eq(pursuits.id, id)).limit(1);
  return row ? maskResearchPursuitSummary(row) : null;
}

/** Enquiries from the site that no director has taken yet, oldest first. */
export async function listInbox(): Promise<Pursuit[]> {
  const db = requireDb();
  const rows = await db
    .select()
    .from(pursuits)
    .where(and(isNull(pursuits.ownerId), eq(pursuits.stage, "enquiry")))
    .orderBy(pursuits.createdAt);
  return maskResearchPursuitSummaries(rows);
}

/** Owned pursuits in the three active stages. Sorting into columns happens in lib/portal/board. */
export async function listBoard(): Promise<Pursuit[]> {
  const db = requireDb();
  const rows = await db
    .select()
    .from(pursuits)
    .where(and(inArray(pursuits.stage, [...ACTIVE_STAGES]), sql`${pursuits.ownerId} is not null`))
    .orderBy(desc(pursuits.updatedAt));
  return maskResearchPursuitSummaries(rows);
}

export async function listByStage(stage: PursuitStage): Promise<Pursuit[]> {
  const db = requireDb();
  const query = db.select().from(pursuits).where(eq(pursuits.stage, stage));
  if (stage === "dormant") {
    return maskResearchPursuitSummaries(await query.orderBy(sql`${pursuits.reviewDue} asc nulls last`, desc(pursuits.stageChangedAt)));
  }
  return maskResearchPursuitSummaries(await query.orderBy(desc(pursuits.stageChangedAt)));
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
  return row ? maskResearchPursuitSummary(row) : null;
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
    | "contactPhone"
    | "website"
    | "companyNumber"
    | "party"
    | "partyCompanyNumber"
    | "counterparty"
    | "disputeNature"
    | "approximateValue"
    | "forum"
    | "summary"
    | "source"
    | "sourceDetail"
    | "ownerId"
    | "stage"
    | "stageChangedAt"
    | "reviewDue"
  >
>;

export async function updatePursuit(id: string, values: PursuitPatch): Promise<Pursuit | null> {
  const db = requireDb();
  const [row] = await db
    .update(pursuits)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(pursuits.id, id))
    .returning();
  return row ? maskResearchPursuitSummary(row) : null;
}

export async function touchPursuit(id: string): Promise<void> {
  const db = requireDb();
  await db.update(pursuits).set({ updatedAt: new Date() }).where(eq(pursuits.id, id));
}

export async function deletePursuit(id: string): Promise<void> {
  const db = requireDb();
  await db.delete(pursuits).where(eq(pursuits.id, id));
}

/** Everything the desk shows: the three active stages for the inbox and board, plus dormant for the revisit strip. */
export async function listDeskPursuits(): Promise<Pursuit[]> {
  const db = requireDb();
  const rows = await db
    .select()
    .from(pursuits)
    .where(inArray(pursuits.stage, [...ACTIVE_STAGES, "dormant"]))
    .orderBy(pursuits.createdAt);
  return maskResearchPursuitSummaries(rows);
}

/**
 * Assigns an unowned pursuit to a director. The `owner_id is null` guard means two directors
 * pressing Take at once cannot both win; the loser gets false and the caller reports who won.
 */
export async function takePursuitGuarded(id: string, ownerId: string): Promise<boolean> {
  const db = requireDb();
  const rows = await db
    .update(pursuits)
    .set({ ownerId, updatedAt: new Date() })
    .where(and(eq(pursuits.id, id), isNull(pursuits.ownerId)))
    .returning({ id: pursuits.id });
  return rows.length > 0;
}

/**
 * Declines an unowned pursuit straight from the inbox, recording the declining director as
 * its owner. Same guard as takePursuitGuarded; returns false when someone took it first.
 */
export async function declinePursuitGuarded(id: string, ownerId: string, now: Date): Promise<boolean> {
  const db = requireDb();
  const rows = await db
    .update(pursuits)
    .set({ stage: "declined", ownerId, stageChangedAt: now, updatedAt: now })
    .where(and(eq(pursuits.id, id), isNull(pursuits.ownerId)))
    .returning({ id: pursuits.id });
  return rows.length > 0;
}

const DOUBLE_SUBMISSION_WINDOW_MS = 24 * 60 * 60 * 1000;
const RELATED_CANDIDATE_LIMIT = 50;

/** The most recent unowned enquiry from this address created within the last 24 hours, if any. */
export async function findDoubleSubmissionCandidate(email: string, now: Date): Promise<Pursuit | null> {
  const [row] = await findDoubleSubmissionCandidates(email, now);
  return row ? maskResearchPursuitSummary(row) : null;
}

/** Unowned enquiries from this address in the last 24 hours, newest first, so the firm can be matched in code. */
export async function findDoubleSubmissionCandidates(email: string, now: Date): Promise<Pursuit[]> {
  const db = requireDb();
  const since = new Date(now.getTime() - DOUBLE_SUBMISSION_WINDOW_MS);
  const rows = await db
    .select()
    .from(pursuits)
    .where(
      and(
        eq(pursuits.contactEmail, email.trim().toLowerCase()),
        eq(pursuits.stage, "enquiry"),
        isNull(pursuits.ownerId),
        gte(pursuits.createdAt, since)
      )
    )
    .orderBy(desc(pursuits.createdAt))
    .limit(5);
  return maskResearchPursuitSummaries(rows);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Other pursuits sharing the contact email or the normalised firm name. Candidates come from
 * the database by email and by a case-insensitive prefix of the firm; the firm comparison
 * itself runs in code so both sides use the same normalisation.
 */
export async function findRelatedPursuits(
  email: string | null,
  firmNormalised: string,
  excludeId?: string
): Promise<Pursuit[]> {
  const lowerEmail = email?.trim().toLowerCase() || null;
  const prefix = firmNormalised.trim().split(" ")[0] ?? "";
  const conditions = [
    lowerEmail ? eq(pursuits.contactEmail, lowerEmail) : undefined,
    prefix ? ilike(pursuits.firm, `${escapeLike(prefix)}%`) : undefined,
  ].filter((c) => c !== undefined);
  if (conditions.length === 0) return [];

  const db = requireDb();
  const rows = await db
    .select()
    .from(pursuits)
    .where(or(...conditions))
    .orderBy(desc(pursuits.updatedAt))
    .limit(RELATED_CANDIDATE_LIMIT);

  return maskResearchPursuitSummaries(rows.filter((row) => {
    if (excludeId && row.id === excludeId) return false;
    if (lowerEmail && row.contactEmail?.toLowerCase() === lowerEmail) return true;
    return firmNormalised !== "" && normaliseFirm(row.firm) === firmNormalised;
  }));
}

export type ActivityEntry = {
  id?: string;
  kind: ActivityKind;
  actorId: string;
  body?: string | null;
  meta?: ActivityMeta | null;
};

/** Inserts a pursuit and its first activity as one batch, so the pair is all or nothing. */
export async function createPursuitWithEnquiry(
  values: NewPursuit,
  entry: ActivityEntry
): Promise<{ pursuit: Pursuit; activity: Activity }> {
  const db = requireDb();
  const [pursuitRows, activityRows] = await db.batch([
    db.insert(pursuits).values(values).returning(),
    db
      .insert(activityTable)
      .values({
        id: entry.id ?? crypto.randomUUID(),
        pursuitId: values.id,
        kind: entry.kind,
        actorId: entry.actorId,
        body: entry.body ?? null,
        meta: entry.meta ?? null,
      })
      .returning(),
  ]);
  return { pursuit: pursuitRows[0], activity: activityRows[0] };
}

/** Updates a pursuit and writes one activity entry as a single batch, so neither lands alone. */
export async function updatePursuitWithActivity(
  id: string,
  values: PursuitPatch,
  entry: ActivityEntry
): Promise<Pursuit | null> {
  const db = requireDb();
  const [rows] = await db.batch([
    db
      .update(pursuits)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(pursuits.id, id))
      .returning(),
    db.insert(activityTable).values({
      id: entry.id ?? crypto.randomUUID(),
      pursuitId: id,
      kind: entry.kind,
      actorId: entry.actorId,
      body: entry.body ?? null,
      meta: entry.meta ?? null,
    }),
  ]);
  return rows[0] ? maskResearchPursuitSummary(rows[0]) : null;
}

/**
 * Declines an unowned pursuit from the inbox and logs it in one batch. The guard is the
 * `owner_id is null` condition: when another director got there first no row updates, the
 * batch is rolled back (the activity insert is discarded with it) and false is returned.
 */
export async function declinePursuitGuardedWithActivity(
  id: string,
  ownerId: string,
  now: Date,
  entry: ActivityEntry
): Promise<boolean> {
  const db = requireDb();
  const activityId = entry.id ?? crypto.randomUUID();
  const [rows] = await db.batch([
    db
      .update(pursuits)
      .set({ ownerId, stage: "declined", stageChangedAt: now, updatedAt: now })
      .where(and(eq(pursuits.id, id), isNull(pursuits.ownerId)))
      .returning({ id: pursuits.id }),
    db.insert(activityTable).values({
      id: activityId,
      pursuitId: id,
      kind: entry.kind,
      actorId: entry.actorId,
      body: entry.body ?? null,
      meta: entry.meta ?? null,
    }),
  ]);
  if (rows.length === 0) {
    // The guard matched nothing, so the entry written in the same batch is withdrawn.
    await db.delete(activityTable).where(eq(activityTable.id, activityId));
    return false;
  }
  return true;
}

/** Every pursuit a client domain could be linked to: everything but declined, by firm name. */
export async function listPursuitsForLinking(): Promise<Pursuit[]> {
  const db = requireDb();
  return db.select().from(pursuits).where(ne(pursuits.stage, "declined")).orderBy(asc(pursuits.firm));
}

export type GuardedPursuitDeletion = { ok: true; blobKeys: string[] } | { ok: false; code: "linked_actions" | "not_found" };
export async function deletePursuitGuarded(id: string): Promise<GuardedPursuitDeletion> {
  const result = await requireDb().execute(sql`select desk_delete_pursuit_guarded(${id}) as result`);
  return result.rows[0].result as GuardedPursuitDeletion;
}
