import { lt, sql } from "drizzle-orm";
import { requireDb } from "./index";
import { enquiryThrottle } from "./schema";

const HOUR_MS = 60 * 60 * 1000;

export const EMAIL_WINDOW_MS = 24 * HOUR_MS;
export const EMAIL_CAP = 5;
export const IP_WINDOW_MS = HOUR_MS;
export const IP_CAP = 20;
export const GLOBAL_WINDOW_MS = HOUR_MS;
export const GLOBAL_CAP = 60;
export const GLOBAL_KEY = "global";
/** Rows whose window began longer ago than this are deleted on each submission. */
export const PURGE_AFTER_MS = 24 * HOUR_MS;

export type ThrottleVerdict = { emailAllowed: boolean; ipAllowed: boolean; alertAllowed: boolean };

/** The decision over the three counters, kept pure so the caps can be tested without a database. */
export function decideThrottle(counts: { email: number; ip: number; global: number }): ThrottleVerdict {
  return {
    emailAllowed: counts.email <= EMAIL_CAP,
    ipAllowed: counts.ip <= IP_CAP,
    alertAllowed: counts.global <= GLOBAL_CAP,
  };
}

/**
 * One atomic upsert per key: a row whose window has lapsed restarts at 1, otherwise the count
 * climbs by one. Written as a single statement so two concurrent submissions cannot both read
 * the old count.
 */
function bump(key: string, windowMs: number, now: Date) {
  const db = requireDb();
  const cutoff = new Date(now.getTime() - windowMs).toISOString();
  const nowIso = now.toISOString();
  return db
    .insert(enquiryThrottle)
    .values({ key, count: 1, windowStart: now })
    .onConflictDoUpdate({
      target: enquiryThrottle.key,
      set: {
        count: sql`case when ${enquiryThrottle.windowStart} < ${cutoff}::timestamptz then 1 else ${enquiryThrottle.count} + 1 end`,
        windowStart: sql`case when ${enquiryThrottle.windowStart} < ${cutoff}::timestamptz then ${nowIso}::timestamptz else ${enquiryThrottle.windowStart} end`,
      },
    })
    .returning({ count: enquiryThrottle.count });
}

/**
 * Counts a submission against its hashed email key, hashed IP key and the global key in one
 * round trip, and says which caps still hold. `keys` are already hashed (see intake.hashKey).
 */
export async function registerEnquiryAttempt(
  keys: { email: string; ip: string },
  now: Date = new Date()
): Promise<ThrottleVerdict> {
  const db = requireDb();
  const [emailRows, ipRows] = await db.batch([
    bump(keys.email, EMAIL_WINDOW_MS, now),
    bump(keys.ip, IP_WINDOW_MS, now),
  ]);
  const counts = { email: emailRows[0]?.count ?? 1, ip: ipRows[0]?.count ?? 1, global: 0 };
  const capped = decideThrottle(counts);
  // A rejected submission sends no alert, so it must not use up the hourly alert budget.
  if (!capped.emailAllowed || !capped.ipAllowed) return capped;
  const globalRows = await bump(GLOBAL_KEY, GLOBAL_WINDOW_MS, now);
  return decideThrottle({ ...counts, global: globalRows[0]?.count ?? 1 });
}

/** Deletes counters whose window began more than 24 hours ago. */
export async function purgeExpiredThrottle(now: Date = new Date()): Promise<void> {
  const db = requireDb();
  await db.delete(enquiryThrottle).where(lt(enquiryThrottle.windowStart, new Date(now.getTime() - PURGE_AFTER_MS)));
}
