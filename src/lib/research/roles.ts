import { auth } from "@clerk/nextjs/server";
import { isClerkConfigured } from "@/lib/env";
import { resolveIdentity } from "@/lib/portal/roles";

export class ResearchAccessError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
    this.name = "ResearchAccessError";
  }
}
export type ResearchActor = { userId: string; role: "director" | "client" | "unknown" };

/** Uses the same current backend authority as pages, uploads, APIs and actions. */
export async function readResearchActor(userId: string): Promise<ResearchActor> {
  try {
    const identity = await resolveIdentity(userId);
    return { userId, role: identity.role ?? "unknown" };
  } catch { throw new ResearchAccessError("actor_unavailable", 503); }
}
export async function requireResearchDirector(): Promise<string> {
  if (!isClerkConfigured()) throw new ResearchAccessError("clerk_unconfigured", 503);
  let userId: string | null;
  try { ({ userId } = await auth()); } catch { throw new ResearchAccessError("actor_unavailable", 503); }
  if (!userId) throw new ResearchAccessError("unauthenticated", 401);
  const actor = await readResearchActor(userId);
  if (actor.role !== "director") throw new ResearchAccessError("forbidden", 403);
  return userId;
}
