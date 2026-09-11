import { and, desc, eq, isNull, or } from "drizzle-orm";
import { getDb, requireDb } from "./index";
import { clientMatters, type ClientMatter } from "./schema";

export async function listClientMatters(): Promise<ClientMatter[]> {
  const db = getDb();
  if (!db) return [];
  return db.select().from(clientMatters).orderBy(desc(clientMatters.createdAt));
}

export async function findClientMatter(
  email: string,
  vericaseWorkspaceId: string
): Promise<ClientMatter | null> {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(clientMatters)
    .where(
      and(eq(clientMatters.email, email), eq(clientMatters.vericaseWorkspaceId, vericaseWorkspaceId))
    )
    .limit(1);
  return row ?? null;
}

export async function listMattersForClient(input: {
  email: string;
  clerkUserId?: string | null;
}): Promise<ClientMatter[]> {
  const db = getDb();
  if (!db) return [];
  const clauses = [eq(clientMatters.email, input.email)];
  if (input.clerkUserId) {
    clauses.push(eq(clientMatters.clerkUserId, input.clerkUserId));
  }
  return db
    .select()
    .from(clientMatters)
    .where(or(...clauses))
    .orderBy(desc(clientMatters.createdAt));
}

export async function createClientMatter(input: {
  email: string;
  vericaseWorkspaceId: string;
  vericaseWorkspaceName: string;
  createdBy: string;
  clerkUserId?: string | null;
}): Promise<ClientMatter> {
  const db = requireDb();
  const [row] = await db
    .insert(clientMatters)
    .values({
      id: crypto.randomUUID(),
      email: input.email,
      clerkUserId: input.clerkUserId ?? null,
      vericaseWorkspaceId: input.vericaseWorkspaceId,
      vericaseWorkspaceName: input.vericaseWorkspaceName,
      createdBy: input.createdBy,
    })
    .returning();
  return row;
}

/** Bind the Clerk user to every grant for this email on first login. */
export async function attachClerkUserToMatters(email: string, clerkUserId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db
    .update(clientMatters)
    .set({ clerkUserId })
    .where(and(eq(clientMatters.email, email), isNull(clientMatters.clerkUserId)));
}
