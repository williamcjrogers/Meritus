import { eq } from "drizzle-orm";
import { requireDb } from "./index";
import { enquiryThrottle } from "./schema";

export const ENQUIRY_LIMIT = 5;
export const ENQUIRY_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Counts a submission for an address and says whether it is within the daily limit. */
export async function registerEnquiryAttempt(
  email: string,
  now: Date = new Date()
): Promise<{ allowed: boolean; count: number }> {
  const db = requireDb();
  const key = email.trim().toLowerCase();
  const [existing] = await db.select().from(enquiryThrottle).where(eq(enquiryThrottle.key, key)).limit(1);
  const inWindow = existing && now.getTime() - existing.windowStart.getTime() < ENQUIRY_WINDOW_MS;
  const count = inWindow ? existing.count + 1 : 1;
  if (existing) {
    await db
      .update(enquiryThrottle)
      .set({ count, windowStart: inWindow ? existing.windowStart : now })
      .where(eq(enquiryThrottle.key, key));
  } else {
    await db.insert(enquiryThrottle).values({ key, count, windowStart: now });
  }
  return { allowed: count <= ENQUIRY_LIMIT, count };
}
