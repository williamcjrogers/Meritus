import { sql } from 'drizzle-orm';
import { requireDb } from '@/lib/db';

/** Called by the existing authenticated dispatcher. Stores IDs, never source text. */
export async function refreshResearchIntelligence(): Promise<void> {
  await requireDb().execute(sql`select research_refresh_intelligence(now())`);
}
