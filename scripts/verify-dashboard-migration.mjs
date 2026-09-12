// Read-only deployment checks. The Vercel CLI supplies the production environment.
import { Pool, neonConfig } from "@neondatabase/serverless";
import { readMigrationFiles } from "drizzle-orm/migrator";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (typeof WebSocket === "undefined") neonConfig.webSocketConstructor = (await import("ws")).default;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let client;
try {
  client = await pool.connect();
  await client.query("BEGIN READ ONLY");
  const migrations = (await client.query("select hash,created_at from drizzle.__drizzle_migrations order by created_at")).rows;
  const expected = readMigrationFiles({ migrationsFolder: "./drizzle" });
  const mismatchedHashes = migrations.filter(row => {
    const local = expected.find(entry => entry.folderMillis === Number(row.created_at));
    return local && local.hash !== row.hash;
  }).map(row => Number(row.created_at));
  const schema = (await client.query("select to_regclass('public.desk_actions')::text as actions,to_regclass('public.desk_action_events')::text as events,to_regclass('public.desk_action_priorities')::text as priorities")).rows[0];
  const legacy = (await client.query("select count(*)::int as actions,count(*) filter(where length(btrim(next_action))>240)::int as incompatible_titles,coalesce(max(length(btrim(next_action))),0)::int as longest_title from pursuits where nullif(btrim(next_action),'') is not null")).rows[0];
  const dormant = (await client.query("select count(*)::int as dates from pursuits where stage='dormant' and next_action_due is not null")).rows[0];
  const result = { phase: process.argv[2] ?? "before", latestMigration: Number(migrations.at(-1)?.created_at ?? 0), mismatchedHashes, schema, legacy, dormant };
  if (process.argv[2] === "after") {
    result.reconciliation = (await client.query(`select
      (select count(*)::int from pursuits p where nullif(btrim(p.next_action),'') is not null and not exists(select 1 from desk_actions a join desk_action_events e on e.action_id=a.id and e.kind='imported' where a.legacy_key='pursuit:'||p.id and e.after->>'title'=p.next_action and (e.after->>'due_date')::date is not distinct from p.next_action_due and e.after->>'pursuit_id'=p.id)) as missing_imports,
      (select count(*)::int from desk_actions a where a.legacy_key is not null and not exists(select 1 from desk_action_events e where e.action_id=a.id and e.kind='imported')) as missing_import_events,
      (select count(*)::int from pursuits where stage='dormant' and next_action_due is not null and review_due is distinct from next_action_due) as unmatched_dormant_dates,
      (select count(*)::int from desk_actions) as actions,
      (select count(*)::int from desk_action_events) as events`)).rows[0];
  }
  await client.query("COMMIT");
  console.log(JSON.stringify(result, null, 2));
  if (legacy.incompatible_titles || mismatchedHashes.length) process.exitCode = 1;
  if (process.argv[2] === "before" && result.latestMigration >= 1789228800006 && !schema.actions) process.exitCode = 1;
  if (process.argv[2] === "after" && (result.latestMigration < 1789228800006 || Object.entries(result.reconciliation).some(([key, value]) => !["actions", "events"].includes(key) && value !== 0))) process.exitCode = 1;
} catch (error) {
  console.error("Read-only migration verification failed:", error.code ?? error.name);
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
