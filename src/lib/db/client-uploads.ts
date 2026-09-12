import { and, asc, eq, lt } from "drizzle-orm";
import { requireDb } from "./index";
import { clientUploads, type ClientUpload, type ClientUploadStatus, type NewClientUpload } from "./schema";

export async function insertClientUpload(values: NewClientUpload): Promise<ClientUpload> {
  const db = requireDb();
  const [row] = await db.insert(clientUploads).values(values).returning();
  return row;
}

export async function getClientUpload(id: string): Promise<ClientUpload | null> {
  const db = requireDb();
  const [row] = await db.select().from(clientUploads).where(eq(clientUploads.id, id)).limit(1);
  return row ?? null;
}

/** Moves a pending upload on; false when it was no longer pending, so two completions cannot both win. */
export async function updateClientUpload(
  id: string,
  patch: { status?: ClientUploadStatus; documentId?: string | null }
): Promise<boolean> {
  const db = requireDb();
  const rows = await db
    .update(clientUploads)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(clientUploads.id, id), eq(clientUploads.status, "pending")))
    .returning({ id: clientUploads.id });
  return rows.length > 0;
}

/** Pending uploads started before `before`, oldest first, capped so a sweep stays cheap. */
export async function listStaleClientUploads(before: Date, limit = 20): Promise<ClientUpload[]> {
  const db = requireDb();
  return db
    .select()
    .from(clientUploads)
    .where(and(eq(clientUploads.status, "pending"), lt(clientUploads.createdAt, before)))
    .orderBy(asc(clientUploads.createdAt))
    .limit(limit);
}
