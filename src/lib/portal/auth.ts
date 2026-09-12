import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { resolveIdentity, type Identity, type Role } from "./roles";

function forbidden(message: string): NextResponse {
  return NextResponse.json({ error: message, code: "FORBIDDEN" }, { status: 403 });
}

/** A route-handler gate for directors. The middleware has already checked; this checks again. */
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

  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const identity = await resolveIdentity(userId, sessionClaims);
  if (identity.role !== "director") {
    return { error: forbidden("Directors only") };
  }

  return { userId };
}

export type ClientIdentity = Identity & { role: Role };

/** A route-handler gate for the client desk. Clients and directors pass; a director has no domain. */
export async function requireClientUser(): Promise<
  { identity: ClientIdentity; error?: undefined } | { identity?: undefined; error: NextResponse }
> {
  if (!isClerkConfigured()) {
    return { error: setupResponse("Clerk is not configured") };
  }
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const identity = await resolveIdentity(userId, sessionClaims);
  if (identity.role !== "client" && identity.role !== "director") {
    return { error: forbidden("No access") };
  }
  return { identity: { ...identity, role: identity.role } };
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
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return { ok: false, error: "Sign in again" };
  }
  const identity = await resolveIdentity(userId, sessionClaims);
  if (identity.role !== "director") {
    return { ok: false, error: "Directors only" };
  }
  return { ok: true, userId };
}
