import { describe, expect, it } from "vitest";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

describe("dashboard deployment migration selection", () => {
  it("upgrades a database through 0008 and does not repeat 0009", async () => {
    const dialect = new PgDialect();
    const migrations = readMigrationFiles({ migrationsFolder: "drizzle" });
    const preceding = migrations.slice(0, 9);
    const dashboard = migrations[9];
    expect(dashboard).toBeDefined();
    const latestBefore = Math.max(...preceding.map(migration => migration.folderMillis));
    expect(dashboard.folderMillis).toBeGreaterThan(latestBefore);

    async function migrateFrom(timestamp: number) {
      const statements: { sql: string; params: unknown[] }[] = [];
      const transaction = { execute: async (query: SQL) => { statements.push(dialect.sqlToQuery(query)); } };
      const session = {
        execute: async () => undefined,
        all: async () => [{ id: 9, hash: "already-applied", created_at: timestamp }],
        transaction: async (run: (tx: typeof transaction) => Promise<void>) => run(transaction),
      };
      await dialect.migrate(migrations, session as unknown as Parameters<PgDialect["migrate"]>[1], { migrationsFolder: "drizzle" });
      return statements;
    }

    const applied = await migrateFrom(latestBefore);
    expect(applied).toHaveLength(dashboard.sql.length + 1);
    expect(applied.slice(0, -1).map(statement => statement.sql)).toEqual(dashboard.sql);
    expect(applied.at(-1)?.params).toEqual([dashboard.hash, dashboard.folderMillis]);
    expect(await migrateFrom(dashboard.folderMillis)).toEqual([]);
  });
});
