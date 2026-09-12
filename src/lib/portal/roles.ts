/**
 * Who a signed-in user is to the portal. The role lives in Clerk `publicMetadata` (`director`
 * or `client`, set by William for directors and by /api/access for clients). The session token
 * carries it when the dashboard adds the `metadata` claim; otherwise the Backend API is asked
 * and the answer held for five minutes. Anything else is no role, which every gate denies.
 *
 * Server only: this module imports "@clerk/nextjs/server".
 */

import { clerkClient } from "@clerk/nextjs/server";

export const ROLES = ["director", "client"] as const;
export type Role = (typeof ROLES)[number];

export type Identity = {
  userId: string;
  role: Role | null;
  /** The client's company domain; null for directors. */
  domain: string | null;
  email: string | null;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { identity: Identity; expiresAt: number }>();

export function roleFromMetadata(value: unknown): Role | null {
  return value === "director" || value === "client" ? value : null;
}

function readMetadata(source: unknown): Pick<Identity, "role" | "domain" | "email"> | null {
  if (!source || typeof source !== "object") return null;
  const meta = source as Record<string, unknown>;
  return {
    role: roleFromMetadata(meta.role),
    domain: typeof meta.domain === "string" && meta.domain ? meta.domain : null,
    email: typeof meta.email === "string" && meta.email ? meta.email : null,
  };
}

/** The `metadata` session claim, when the Clerk dashboard has been told to add it. */
export function identityFromClaims(userId: string, claims: unknown): Identity | null {
  if (!claims || typeof claims !== "object") return null;
  const meta = readMetadata((claims as Record<string, unknown>).metadata);
  if (!meta) return null;
  return { userId, ...meta };
}

async function fetchIdentity(userId: string): Promise<Identity> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const meta = readMetadata(user.publicMetadata) ?? { role: null, domain: null, email: null };
  const primary =
    user.emailAddresses.find((entry) => entry.id === user.primaryEmailAddressId) ?? user.emailAddresses[0];
  return { userId, role: meta.role, domain: meta.domain, email: meta.email ?? primary?.emailAddress ?? null };
}

export async function resolveIdentity(userId: string, claims: unknown): Promise<Identity> {
  const fromClaims = identityFromClaims(userId, claims);
  if (fromClaims?.role) return fromClaims;
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.identity;
  try {
    const identity = await fetchIdentity(userId);
    cache.set(userId, { identity, expiresAt: Date.now() + CACHE_TTL_MS });
    return identity;
  } catch (error) {
    console.warn("Roles: Clerk user lookup unavailable", error instanceof Error ? error.name : "unknown");
    return { userId, role: null, domain: null, email: null };
  }
}

/** Test hook. */
export function __resetIdentityCache(): void {
  cache.clear();
}
