/**
 * The directors are the Clerk users whose publicMetadata.role is "director";
 * there is no directors table. The list is read through the Clerk backend
 * client, held in memory for five minutes, and abandoned after eight seconds so
 * a slow Clerk never holds up intake or the desk. The directory result
 * distinguishes a failed lookup from a healthy empty list.
 *
 * This module imports "@clerk/nextjs/server", which Next refuses to bundle for
 * the browser, so only server components, route handlers and server actions
 * may import it. Client components take the Director type, initialsFor,
 * directorInitials, directorName and the placeholders from "./director-helpers";
 * they are re-exported here so server code has a single import.
 */

import { clerkClient } from "@clerk/nextjs/server";
import { isClerkConfigured } from "@/lib/env";
import { initialsFor, type Director } from "./director-helpers";

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

type CacheEntry = { directors: Director[]; expiresAt: number };

export type DirectorDirectory = { available: boolean; directors: Director[] };

const TIMED_OUT = Symbol("directors timed out");

let cache: CacheEntry | null = null;
let inFlight: Promise<DirectorDirectory> | null = null;

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

function isDirector(user: ClerkUserLike): boolean {
  return user.publicMetadata?.role === "director";
}

async function fetchDirectors(): Promise<Director[]> {
  const client = await clerkClient();
  const directors: Director[] = [];
  let offset = 0;
  while (true) {
    const { data, totalCount } = await client.users.getUserList({ limit: PAGE_LIMIT, offset });
    directors.push(...data.filter(isDirector).map((user) => toDirector(user)));
    offset += data.length;
    if (offset >= totalCount) break;
    if (data.length === 0) throw new Error("Incomplete director directory");
  }
  return directors.sort(byName);
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
  });
  return Promise.race([work, expiry]).finally(() => clearTimeout(timer));
}

async function loadDirectors(): Promise<DirectorDirectory> {
  try {
    const result = await withTimeout(fetchDirectors(), FETCH_TIMEOUT_MS);
    if (result === TIMED_OUT) {
      console.warn(`Directors: Clerk user list took longer than ${FETCH_TIMEOUT_MS} ms`);
      return { available: false, directors: [] };
    }
    cache = { directors: result, expiresAt: Date.now() + CACHE_TTL_MS };
    return { available: true, directors: result };
  } catch (error) {
    console.warn("Directors: Clerk user list unavailable", error);
    return { available: false, directors: [] };
  }
}

/**
 * Every director, sorted by name, with explicit availability. A good answer is
 * cached for five minutes; failures are not cached.
 */
export async function readDirectorDirectory(): Promise<DirectorDirectory> {
  if (!isClerkConfigured()) return { available: false, directors: [] };
  if (cache && cache.expiresAt > Date.now()) return { available: true, directors: cache.directors };
  if (inFlight) return inFlight;
  inFlight = loadDirectors().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** Compatibility reader; callers needing availability use readDirectorDirectory. */
export async function listDirectors(): Promise<Director[]> {
  return (await readDirectorDirectory()).directors;
}

export async function getDirector(id: string | null | undefined): Promise<Director | null> {
  if (!id) return null;
  const directors = await listDirectors();
  return directors.find((director) => director.id === id) ?? null;
}

/** Test hook: forget the cached list and any request in flight. */
export function __resetDirectorsCache(): void {
  cache = null;
  inFlight = null;
}
