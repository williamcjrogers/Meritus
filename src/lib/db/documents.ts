import { and, desc, eq } from "drizzle-orm";
import { requireDb } from "./index";
import { documents, type DocumentRow, type DocumentScope } from "./schema";

export async function listDocuments(opts: {
  scope: DocumentScope;
  pursuitId?: string;
}): Promise<DocumentRow[]> {
  const db = requireDb();
  if (opts.scope === "pursuit") {
    if (!opts.pursuitId) return [];
    return db
      .select()
      .from(documents)
      .where(and(eq(documents.scope, "pursuit"), eq(documents.pursuitId, opts.pursuitId)))
      .orderBy(desc(documents.createdAt));
  }
  return db
    .select()
    .from(documents)
    .where(eq(documents.scope, "library"))
    .orderBy(desc(documents.createdAt));
}

export async function getDocument(id: string): Promise<DocumentRow | null> {
  const db = requireDb();
  const [row] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return row ?? null;
}

export async function insertDocument(values: typeof documents.$inferInsert): Promise<DocumentRow> {
  const db = requireDb();
  const [row] = await db.insert(documents).values(values).returning();
  return row;
}

export async function deleteDocumentRow(id: string): Promise<void> {
  const db = requireDb();
  await db.delete(documents).where(eq(documents.id, id));
}
