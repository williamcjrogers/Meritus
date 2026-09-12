import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { resolveIdentity, type Identity, type Role } from "./roles";
import { PAGE_PATH_HEADER, requestedPagePath } from "./request-path";
import { safeReturnPath, unavailableDestination } from "./destination";

const UNAVAILABLE = "We could not verify your access. Please try again.";
function forbidden(message: string): NextResponse {
  return NextResponse.json({ error: message, code: "FORBIDDEN" }, { status: 403 });
}
function unavailable(): NextResponse {
  return NextResponse.json({ error: UNAVAILABLE, code: "IDENTITY_UNAVAILABLE" }, { status: 503, headers: { "Retry-After": "5", "Cache-Control": "no-store" } });
}

/** Shared session and backend lookup, without cross-request authority caching. */
async function currentIdentity(): Promise<Identity | null> {
  const { userId, sessionClaims } = await auth();
  return userId ? resolveIdentity(userId, sessionClaims) : null;
}

export async function requirePortalUser(): Promise<
  { userId: string; error?: undefined } | { userId?: undefined; error: NextResponse }
> {
  if (!isClerkConfigured()) return { error: unavailable() };
  let identity: Identity | null;
  try { identity = await currentIdentity(); } catch { return { error: unavailable() }; }
  if (!identity) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (identity.role !== "director") return { error: forbidden("Workspace access required") };
  return { userId: identity.userId };
}

export type ClientIdentity = Identity & { role: Role };
/** Existing API scope is retained: clients and staff pass; individual operations enforce domains. */
export async function requireClientUser(): Promise<
  { identity: ClientIdentity; error?: undefined } | { identity?: undefined; error: NextResponse }
> {
  if (!isClerkConfigured()) return { error: unavailable() };
  let identity: Identity | null;
  try { identity = await currentIdentity(); } catch { return { error: unavailable() }; }
  if (!identity) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (identity.role !== "client" && identity.role !== "director") return { error: forbidden("No access") };
  return { identity: { ...identity, role: identity.role } };
}

/** Page guards call this independently of middleware; callers enforce their experience boundary. */
export async function requirePageIdentity(fallback: string): Promise<Identity> {
  const requested = requestedPagePath(fallback, (await headers()).get(PAGE_PATH_HEADER));
  if (!isClerkConfigured()) redirect(unavailableDestination(requested));
  let identity: Identity | null;
  try { identity = await currentIdentity(); } catch { redirect(unavailableDestination(requested)); }
  if (!identity) {
    const target = safeReturnPath(requested);
    const entry = target?.startsWith("/client") ? "/access" : "/sign-in";
    redirect(target ? `${entry}?returnTo=${encodeURIComponent(target)}` : entry);
  }
  return identity;
}

/** Page recovery is separate from Research's typed API and background-worker error contract. */
export async function requireWorkspacePage(fallback = "/portal"): Promise<string> {
  const identity = await requirePageIdentity(fallback);
  if (identity.role !== "director") {
    redirect(identity.role === "client" ? "/client" : "/access/denied");
  }
  return identity.userId;
}

export function setupResponse(message = "This service is temporarily unavailable. Please try again."): NextResponse {
  return NextResponse.json({ error: message, code: "SETUP" }, { status: 503 });
}
export function requireDatabaseOr503(): NextResponse | null {
  return isDatabaseConfigured() ? null : setupResponse();
}
export type ActionUser = { ok: true; userId: string } | { ok: false; error: string; code?: string; status?: number };
export async function requireActionUser(): Promise<ActionUser> {
  if (!isClerkConfigured()) return { ok: false, error: UNAVAILABLE, code: "IDENTITY_UNAVAILABLE", status: 503 };
  if (!isDatabaseConfigured()) return { ok: false, error: "This service is temporarily unavailable. Please try again.", code: "SERVICE_UNAVAILABLE", status: 503 };
  let identity: Identity | null;
  try { identity = await currentIdentity(); } catch { return { ok: false, error: UNAVAILABLE, code: "IDENTITY_UNAVAILABLE", status: 503 }; }
  if (!identity) return { ok: false, error: "Sign in again" };
  if (identity.role !== "director") return { ok: false, error: "Workspace access required" };
  return { ok: true, userId: identity.userId };
}
