import { and, asc, eq, isNull } from "drizzle-orm";
import { domainFromEmail, isReservedDirectorDomain } from "@/lib/portal/domains";
import { requireDb } from "./index";
import { clientDomains, type ClientDomain, type NewClientDomain } from "./schema";

export async function listActiveClientDomains(): Promise<ClientDomain[]> {
  const db = requireDb();
  return db
    .select()
    .from(clientDomains)
    .where(isNull(clientDomains.removedAt))
    .orderBy(asc(clientDomains.domain));
}

export async function findActiveClientDomain(domain: string): Promise<ClientDomain | null> {
  const db = requireDb();
  const [row] = await db
    .select()
    .from(clientDomains)
    .where(and(eq(clientDomains.domain, domain), isNull(clientDomains.removedAt)))
    .limit(1);
  return row ?? null;
}

/** Any row for the domain, removed or not, so a re-listed domain reuses its id and keeps its files. */
export async function findClientDomainByName(domain: string): Promise<ClientDomain | null> {
  const db = requireDb();
  const [row] = await db.select().from(clientDomains).where(eq(clientDomains.domain, domain)).limit(1);
  return row ?? null;
}

/** The active domain for an address, or null. meritusvia.com never matches. */
export async function findClientDomainForEmail(
  email: string | null | undefined
): Promise<ClientDomain | null> {
  const domain = domainFromEmail(email);
  if (!domain || isReservedDirectorDomain(domain)) return null;
  return findActiveClientDomain(domain);
}

export async function getClientDomain(id: string): Promise<ClientDomain | null> {
  const db = requireDb();
  const [row] = await db.select().from(clientDomains).where(eq(clientDomains.id, id)).limit(1);
  return row ?? null;
}

export async function insertClientDomain(values: NewClientDomain): Promise<ClientDomain> {
  const db = requireDb();
  const [row] = await db.insert(clientDomains).values(values).returning();
  return row;
}

export async function reactivateClientDomain(
  id: string,
  patch: { firm: string; pursuitId: string | null }
): Promise<ClientDomain | null> {
  const db = requireDb();
  const [row] = await db
    .update(clientDomains)
    .set({ firm: patch.firm, pursuitId: patch.pursuitId, removedAt: null })
    .where(eq(clientDomains.id, id))
    .returning();
  return row ?? null;
}

export async function setClientDomainPursuit(
  id: string,
  pursuitId: string | null
): Promise<ClientDomain | null> {
  const db = requireDb();
  const [row] = await db
    .update(clientDomains)
    .set({ pursuitId })
    .where(and(eq(clientDomains.id, id), isNull(clientDomains.removedAt)))
    .returning();
  return row ?? null;
}

/** Marks the domain removed. Files and upload rows keep pointing at it. */
export async function removeClientDomain(id: string, now: Date = new Date()): Promise<boolean> {
  const db = requireDb();
  const rows = await db
    .update(clientDomains)
    .set({ removedAt: now })
    .where(and(eq(clientDomains.id, id), isNull(clientDomains.removedAt)))
    .returning({ id: clientDomains.id });
  return rows.length > 0;
}
