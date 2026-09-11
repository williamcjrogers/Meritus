import { asc, eq } from "drizzle-orm";
import { domainFromEmail, isReservedDirectorDomain } from "@/lib/portal/domains";
import { getDb, requireDb } from "./index";
import { clientDomains, type ClientDomain, type NewClientDomain } from "./schema";

const CACHE_TTL_MS = 60 * 1000;

let nameCache: { names: string[]; expiresAt: number } | null = null;

export function __resetClientDomainCache(): void {
  nameCache = null;
}

export async function listClientDomains(): Promise<ClientDomain[]> {
  const db = getDb();
  if (!db) return [];
  return db.select().from(clientDomains).orderBy(asc(clientDomains.domain));
}

export async function listClientDomainNames(): Promise<string[]> {
  if (nameCache && nameCache.expiresAt > Date.now()) return nameCache.names;
  try {
    const rows = await listClientDomains();
    const names = rows.map((row) => row.domain);
    nameCache = { names, expiresAt: Date.now() + CACHE_TTL_MS };
    return names;
  } catch {
    return [];
  }
}

export const listClientDomainHosts = listClientDomainNames;

export async function getClientDomainByName(domain: string): Promise<ClientDomain | null> {
  const db = getDb();
  if (!db) return null;
  const [row] = await db.select().from(clientDomains).where(eq(clientDomains.domain, domain)).limit(1);
  return row ?? null;
}

export const findClientDomain = getClientDomainByName;

export async function findClientDomainForEmail(email: string | null | undefined): Promise<ClientDomain | null> {
  const domain = domainFromEmail(email);
  if (!domain || isReservedDirectorDomain(domain)) return null;
  return getClientDomainByName(domain);
}

export async function insertClientDomain(values: NewClientDomain): Promise<ClientDomain> {
  const db = requireDb();
  const [row] = await db.insert(clientDomains).values(values).returning();
  __resetClientDomainCache();
  return row;
}

export async function createClientDomain(input: {
  domain: string;
  vericaseWorkspaceId?: string | null;
  vericaseWorkspaceName?: string | null;
  createdBy: string;
}): Promise<ClientDomain> {
  return insertClientDomain({
    id: crypto.randomUUID(),
    domain: input.domain,
    vericaseWorkspaceId: input.vericaseWorkspaceId?.trim() || null,
    vericaseWorkspaceName: input.vericaseWorkspaceName?.trim() || null,
    createdBy: input.createdBy,
  });
}

export async function deleteClientDomain(id: string): Promise<boolean> {
  const db = requireDb();
  const deleted = await db.delete(clientDomains).where(eq(clientDomains.id, id)).returning({ id: clientDomains.id });
  __resetClientDomainCache();
  return deleted.length > 0;
}
