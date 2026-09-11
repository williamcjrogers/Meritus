import { and, desc, eq } from "drizzle-orm";
import { requireDb } from "./index";
import { clientFiles, type ClientFile, type ClientFileStatus, type NewClientFile } from "./schema";

export async function insertClientFile(values: NewClientFile): Promise<ClientFile> {
  const db = requireDb();
  const [row] = await db.insert(clientFiles).values(values).returning();
  return row;
}

export async function getClientFile(id: string): Promise<ClientFile | null> {
  const db = requireDb();
  const [row] = await db.select().from(clientFiles).where(eq(clientFiles.id, id)).limit(1);
  return row ?? null;
}

export async function listReadyClientFiles(domain: string): Promise<ClientFile[]> {
  const db = requireDb();
  return db
    .select()
    .from(clientFiles)
    .where(and(eq(clientFiles.domain, domain), eq(clientFiles.status, "ready")))
    .orderBy(desc(clientFiles.createdAt));
}

export async function markClientFileReady(id: string): Promise<ClientFile | null> {
  const db = requireDb();
  const [row] = await db
    .update(clientFiles)
    .set({ status: "ready" satisfies ClientFileStatus, completedAt: new Date() })
    .where(and(eq(clientFiles.id, id), eq(clientFiles.status, "pending")))
    .returning();
  return row ?? null;
}

export async function deleteClientFileRow(id: string): Promise<void> {
  const db = requireDb();
  await db.delete(clientFiles).where(eq(clientFiles.id, id));
}
