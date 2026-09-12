import { NextResponse } from "next/server";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { requireResearchDirector, ResearchAccessError } from "@/lib/research/roles";

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

  try {
    return { userId: await requireResearchDirector() };
  } catch (error) {
    const status = error instanceof ResearchAccessError ? error.status : 503;
    return {
      error: NextResponse.json({ error: status === 401 ? "Unauthorised" : status === 403 ? "Director access required" : "Identity service unavailable" }, { status }),
    };
  }
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
  try {
    return { ok: true, userId: await requireResearchDirector() };
  } catch (error) {
    const status = error instanceof ResearchAccessError ? error.status : 503;
    return { ok: false, error: status === 401 ? "Sign in again" : status === 403 ? "Director access required" : "Identity service unavailable" };
  }
}
