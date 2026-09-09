// Applies pending Drizzle migrations at build time, each migration file inside one transaction,
// so a failed statement leaves the database as it was. Skips when no database is configured.
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("migrate: DATABASE_URL is not set, skipping migrations");
  process.exit(0);
}

if (typeof WebSocket === "undefined") {
  const ws = await import("ws");
  neonConfig.webSocketConstructor = ws.default;
}

const pool = new Pool({ connectionString: url });
try {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  console.log("migrate: migrations applied");
} finally {
  await pool.end();
}
