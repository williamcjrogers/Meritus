// Applies pending Drizzle migrations at build time. Skips silently when no database is configured
// (for example a local build without env vars) so `next build` still works.
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("migrate: DATABASE_URL is not set, skipping migrations");
  process.exit(0);
}

const db = drizzle(neon(url));
await migrate(db, { migrationsFolder: "./drizzle" });
console.log("migrate: migrations applied");
