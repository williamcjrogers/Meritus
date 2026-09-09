import { desc, eq, inArray, and } from "drizzle-orm";
import { requireDb } from "./index";
import { activity, type Activity, type ActivityKind, type ActivityMeta } from "./schema";

export async function listActivity(pursuitId: string, limit = 200): Promise<Activity[]> {
  const db = requireDb();
  return db
    .select()
    .from(activity)
    .where(eq(activity.pursuitId, pursuitId))
    .orderBy(desc(activity.createdAt))
    .limit(limit);
}

export async function addActivity(values: {
  pursuitId: string;
  kind: ActivityKind;
  actorId: string;
  body?: string | null;
  meta?: ActivityMeta | null;
}): Promise<Activity> {
  const db = requireDb();
  const [row] = await db
    .insert(activity)
    .values({
      id: crypto.randomUUID(),
      pursuitId: values.pursuitId,
      kind: values.kind,
      actorId: values.actorId,
      body: values.body ?? null,
      meta: values.meta ?? null,
    })
    .returning();
  return row;
}

/** Latest stage change per pursuit, used by the Dormant, Instructed and Declined lists. */
export async function latestStageChanges(pursuitIds: string[]): Promise<Map<string, Activity>> {
  const result = new Map<string, Activity>();
  if (pursuitIds.length === 0) return result;
  const db = requireDb();
  const rows = await db
    .select()
    .from(activity)
    .where(and(inArray(activity.pursuitId, pursuitIds), eq(activity.kind, "stage_changed")))
    .orderBy(desc(activity.createdAt));
  for (const row of rows) {
    if (!result.has(row.pursuitId)) result.set(row.pursuitId, row);
  }
  return result;
}

/** Replaces an activity's meta, used to record the alert outcome on an enquiry after the email is attempted. */
export async function updateActivityMeta(id: string, meta: ActivityMeta): Promise<void> {
  const db = requireDb();
  await db.update(activity).set({ meta }).where(eq(activity.id, id));
}
