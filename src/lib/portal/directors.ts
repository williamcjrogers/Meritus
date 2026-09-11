/**
 * The directors are the users of the Clerk application; there is no directors
 * table. The list is read through the Clerk backend client, held in memory for
 * five minutes, and abandoned after eight seconds so a slow Clerk never holds
 * up intake or the desk. Every failure path resolves to an empty list.
 *
 * This module imports "@clerk/nextjs/server", which Next refuses to bundle for
 * the browser, so only server components, route handlers and server actions
 * may import it. Client components take the Director type, initialsFor,
 * directorInitials, directorName and the placeholders from "./director-helpers";
 * they are re-exported here so server code has a single import.
 */

import { clerkClient } from "@clerk/nextjs/server";
import { listClientDomainNames } from "@/lib/db/client-domains";
import { isClerkConfigured } from "@/lib/env";
import { initialsFor, type Director } from "./director-helpers";
import { actorKindFromSignals, type ActorKind } from "./roles";

export {
  UNASSIGNED_INITIALS,
  UNASSIGNED_NAME,
  directorInitials,
  directorName,
  initialsFor,
  type Director,
} from "./director-helpers";

const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8 * 1000;
const PAGE_LIMIT = 50;

type ClerkUserLike = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  primaryEmailAddressId: string | null;
  emailAddresses: ReadonlyArray<{ id: string; emailAddress: string }>;
  publicMetadata?: Record<string, unknown> | null;
};

type CacheEntry = { directors: Director[]; clientIds: string[]; expiresAt: number };

const TIMED_OUT = Symbol("directors timed out");

let cache: CacheEntry | null = null;
let inFlight: Promise<Director[]> | null = null;

function primaryEmail(user: ClerkUserLike): string {
  const primary = user.emailAddresses.find((entry) => entry.id === user.primaryEmailAddressId);
  const chosen = primary ?? user.emailAddresses[0];
  return chosen?.emailAddress.trim() ?? "";
}

function toDirector(user: ClerkUserLike): Director {
  const email = primaryEmail(user);
  const name = [user.firstName, user.lastName]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
  return {
    id: user.id,
    name: name || email || "Director",
    email,
    initials: initialsFor({ firstName: user.firstName, lastName: user.lastName, email }),
  };
}

function byName(a: Director, b: Director): number {
  return a.name.localeCompare(b.name, "en-GB", { sensitivity: "base" });
}

async function loadClientDomains(): Promise<string[]> {
  try {
    return await listClientDomainNames();
  } catch {
    return [];
  }
}

function kindForUser(user: ClerkUserLike, clientDomains: readonly string[]): ActorKind {
  return actorKindFromSignals({
    role: user.publicMetadata?.role,
    email: primaryEmail(user),
    clientDomains,
  });
}

async function fetchActors(): Promise<{ directors: Director[]; clientIds: string[] }> {
  const client = await clerkClient();
  const [{ data }, clientDomains] = await Promise.all([
    client.users.getUserList({ limit: PAGE_LIMIT }),
    loadClientDomains(),
  ]);
  const directors: Director[] = [];
  const clientIds: string[] = [];
  for (const user of data) {
    if (kindForUser(user, clientDomains) === "client") {
      clientIds.push(user.id);
      continue;
    }
    directors.push(toDirector(user));
  }
  return { directors: directors.sort(byName), clientIds };
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
  });
  return Promise.race([work, expiry]).finally(() => clearTimeout(timer));
}

async function loadDirectors(): Promise<Director[]> {
  try {
    const result = await withTimeout(fetchActors(), FETCH_TIMEOUT_MS);
    if (result === TIMED_OUT) {
      console.warn(`Directors: Clerk user list took longer than ${FETCH_TIMEOUT_MS} ms`);
      return [];
    }
    cache = { ...result, expiresAt: Date.now() + CACHE_TTL_MS };
    return result.directors;
  } catch (error) {
    console.warn("Directors: Clerk user list unavailable", error);
    return [];
  }
}

/**
 * Every director, sorted by name. Empty when Clerk is not configured, when the
 * list cannot be read, or when Clerk takes longer than eight seconds. A good
 * answer is cached for five minutes; failures are not cached.
 */
export async function listDirectors(): Promise<Director[]> {
  if (!isClerkConfigured()) return [];
  if (cache && cache.expiresAt > Date.now()) return cache.directors;
  if (inFlight) return inFlight;
  inFlight = loadDirectors().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export async function getDirector(id: string | null | undefined): Promise<Director | null> {
  if (!id) return null;
  const directors = await listDirectors();
  return directors.find((director) => director.id === id) ?? null;
}

async function fetchSingleActorKind(id: string): Promise<ActorKind | null> {
  try {
    const client = await clerkClient();
    const result = await withTimeout(client.users.getUser(id), FETCH_TIMEOUT_MS);
    if (result === TIMED_OUT) return null;
    return kindForUser(result, await loadClientDomains());
  } catch {
    return null;
  }
}

/**
 * Director or client from Clerk metadata plus client_domains.
 * Null when the user is unknown or Clerk is down — callers must not lock
 * directors out of /portal in that case.
 */
export async function getActorKind(id: string | null | undefined): Promise<ActorKind | null> {
  if (!id) return null;
  if (cache && cache.expiresAt > Date.now()) {
    if (cache.clientIds.includes(id)) return "client";
    const director = cache.directors.find((entry) => entry.id === id);
    if (director) {
      return actorKindFromSignals({
        role: undefined,
        email: director.email,
        clientDomains: await loadClientDomains(),
      });
    }
  }
  if (!isClerkConfigured()) return null;
  return fetchSingleActorKind(id);
}

/** Test hook: forget the cached list and any request in flight. */
export function __resetDirectorsCache(): void {
  cache = null;
  inFlight = null;
}
