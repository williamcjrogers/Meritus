import { auth, clerkClient } from "@clerk/nextjs/server";
import { isClerkConfigured } from "@/lib/env";

export class ResearchAccessError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
    this.name = "ResearchAccessError";
  }
}

export type ResearchActor = { userId: string; role: "director" | "client" | "unknown" };

/** Metadata is read from Clerk's backend, never from user-editable form fields. */
export async function readResearchActor(userId: string): Promise<ResearchActor> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const user = await Promise.race([
      (async () => (await clerkClient()).users.getUser(userId))(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ResearchAccessError("actor_unavailable", 503)), 8000);
      }),
    ]);
    const value = user.publicMetadata.role;
    return { userId, role: value === "director" || value === "client" ? value : "unknown" };
  } catch {
    throw new ResearchAccessError("actor_unavailable", 503);
  } finally {
    clearTimeout(timer);
  }
}

export async function requireResearchDirector(): Promise<string> {
  if (!isClerkConfigured()) throw new ResearchAccessError("clerk_unconfigured", 503);
  let userId: string | null;
  try {
    ({ userId } = await auth());
  } catch {
    throw new ResearchAccessError("actor_unavailable", 503);
  }
  if (!userId) throw new ResearchAccessError("unauthenticated", 401);
  const actor = await readResearchActor(userId);
  if (actor.role !== "director") throw new ResearchAccessError("forbidden", 403);
  return userId;
}
