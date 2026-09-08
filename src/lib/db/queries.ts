import { desc, eq, and, sql } from "drizzle-orm";
import { requireDb } from "./index";
import {
  chatMessages,
  chatThreads,
  documents,
  leads,
  notes,
  researchRuns,
  type LeadStatus,
  type NewLead,
} from "./schema";

export async function listLeads() {
  const db = requireDb();
  return db.select().from(leads).orderBy(desc(leads.updatedAt));
}

export async function countOpenLeads() {
  const db = requireDb();
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(sql`${leads.status} in ('new','researching','conflict_check','parked')`);
  return Number(rows[0]?.count ?? 0);
}

export async function countRecentDocuments() {
  const db = requireDb();
  const rows = await db.select({ count: sql<number>`count(*)` }).from(documents);
  return Number(rows[0]?.count ?? 0);
}

export async function getLead(id: string) {
  const db = requireDb();
  const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  return lead ?? null;
}

export async function createLead(values: NewLead) {
  const db = requireDb();
  const [row] = await db.insert(leads).values(values).returning();
  return row;
}

export async function updateLead(
  id: string,
  values: Partial<{
    companyName: string;
    companyNumber: string | null;
    contactName: string | null;
    contactEmail: string | null;
    source: string | null;
    status: LeadStatus;
  }>
) {
  const db = requireDb();
  const [row] = await db
    .update(leads)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(leads.id, id))
    .returning();
  return row ?? null;
}

export async function listNotes(leadId: string) {
  const db = requireDb();
  return db.select().from(notes).where(eq(notes.leadId, leadId)).orderBy(desc(notes.createdAt));
}

export async function addNote(values: {
  leadId: string;
  authorId: string;
  body: string;
  source?: "human" | "research" | "chat";
}) {
  const db = requireDb();
  const [row] = await db
    .insert(notes)
    .values({
      id: crypto.randomUUID(),
      leadId: values.leadId,
      authorId: values.authorId,
      body: values.body,
      source: values.source ?? "human",
    })
    .returning();
  await db.update(leads).set({ updatedAt: new Date() }).where(eq(leads.id, values.leadId));
  return row;
}

export async function listDocuments(opts: { scope: "lead" | "library"; leadId?: string }) {
  const db = requireDb();
  if (opts.scope === "lead" && opts.leadId) {
    return db
      .select()
      .from(documents)
      .where(and(eq(documents.scope, "lead"), eq(documents.leadId, opts.leadId)))
      .orderBy(desc(documents.createdAt));
  }
  return db
    .select()
    .from(documents)
    .where(eq(documents.scope, "library"))
    .orderBy(desc(documents.createdAt));
}

export async function getDocument(id: string) {
  const db = requireDb();
  const [row] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return row ?? null;
}

export async function latestResearch(leadId: string) {
  const db = requireDb();
  const [row] = await db
    .select()
    .from(researchRuns)
    .where(eq(researchRuns.leadId, leadId))
    .orderBy(desc(researchRuns.createdAt))
    .limit(1);
  return row ?? null;
}

export async function getOrCreateThread(leadId: string) {
  const db = requireDb();
  const [existing] = await db.select().from(chatThreads).where(eq(chatThreads.leadId, leadId)).limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(chatThreads)
    .values({ id: crypto.randomUUID(), leadId })
    .returning();
  return created;
}

export async function listChatMessages(threadId: string) {
  const db = requireDb();
  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.threadId, threadId))
    .orderBy(chatMessages.createdAt);
}

export async function addChatMessage(values: { threadId: string; role: string; content: string }) {
  const db = requireDb();
  const [row] = await db
    .insert(chatMessages)
    .values({
      id: crypto.randomUUID(),
      threadId: values.threadId,
      role: values.role,
      content: values.content,
    })
    .returning();
  return row;
}
