import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { getActorKind } from "./directors";
import { allowPortalAccess, type ActorKind } from "./roles";

export async function currentActorKind(): Promise<ActorKind | null> {
  if (!isClerkConfigured()) return null;
  try {
    const { userId } = await auth();
    return getActorKind(userId);
  } catch {
    return null;
  }
}

const DIRECTORS_ONLY = "This area is for directors only";

export async function requirePortalUser(): Promise<
  { userId: string; error?: undefined } | { userId?: undefined; error: NextResponse }
> {
  if (!isClerkConfigured()) {
    return {
      error: NextResponse.json(
        { error: "Clerk is not configured", code: "SETUP" },
        { status: 503 }
      ),
    };
  }

  const { userId } = await auth();
  if (!userId) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const kind = await getActorKind(userId);
  if (!allowPortalAccess(kind)) {
    return {
      error: NextResponse.json({ error: DIRECTORS_ONLY }, { status: 403 }),
    };
  }

  return { userId };
}

export function setupResponse(message = "Portal is not fully configured"): NextResponse {
  return NextResponse.json({ error: message, code: "SETUP" }, { status: 503 });
}

export function requireDatabaseOr503(): NextResponse | null {
  if (!isDatabaseConfigured()) {
    return setupResponse("DATABASE_URL is not configured");
  }
  return null;
}

export type ActionUser = { ok: true; userId: string } | { ok: false; error: string };

/**
 * The server-action counterpart of requirePortalUser: a result object rather than a
 * NextResponse, so an action can hand it straight back to the client.
 */
export async function requireActionUser(): Promise<ActionUser> {
  if (!isClerkConfigured()) {
    return { ok: false, error: "Clerk is not configured" };
  }
  if (!isDatabaseConfigured()) {
    return { ok: false, error: "DATABASE_URL is not configured" };
  }
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, error: "Sign in again" };
  }
  const kind = await getActorKind(userId);
  if (!allowPortalAccess(kind)) {
    return { ok: false, error: DIRECTORS_ONLY };
  }
  return { ok: true, userId };
}
