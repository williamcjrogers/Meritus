import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

describe("combined dashboard and research deployment migration selection", () => {
  it("loads eleven unique journal entries with strictly increasing indices and timestamps", () => {
    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
      entries: { idx: number; when: number; tag: string }[];
    };
    const migrations = readMigrationFiles({ migrationsFolder: "drizzle" });
    expect(journal.entries).toHaveLength(11);
    expect(migrations).toHaveLength(11);
    expect(new Set(journal.entries.map(entry => entry.tag)).size).toBe(11);
    expect(new Set(journal.entries.map(entry => entry.when)).size).toBe(11);
    for (const [index, entry] of journal.entries.entries()) {
      expect(entry.idx).toBe(index);
      expect(Number.isSafeInteger(entry.when)).toBe(true);
      expect(migrations[index].folderMillis).toBe(entry.when);
      if (index > 0) expect(entry.when).toBeGreaterThan(journal.entries[index - 1].when);
    }
    expect(journal.entries[9].tag).toBe("0009_portal_dashboard_actions");
    expect(journal.entries[10].tag).toBe("0010_qcs_research_quick");
  });

  it("applies dashboard then quick research from 0008, only research from 0009 and nothing from 0010", async () => {
    const dialect = new PgDialect();
    const migrations = readMigrationFiles({ migrationsFolder: "drizzle" });
    const preceding = migrations.slice(0, 9);
    const dashboard = migrations[9];
    const quickResearch = migrations[10];
    expect(dashboard).toBeDefined();
    expect(quickResearch).toBeDefined();
    const latestBefore = Math.max(...preceding.map(migration => migration.folderMillis));
    expect(dashboard.folderMillis).toBeGreaterThan(latestBefore);
    expect(quickResearch.folderMillis).toBeGreaterThan(dashboard.folderMillis);

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
    expect(applied).toHaveLength(dashboard.sql.length + quickResearch.sql.length + 2);
    expect(applied.slice(0, dashboard.sql.length).map(statement => statement.sql)).toEqual(dashboard.sql);
    expect(applied[dashboard.sql.length].params).toEqual([dashboard.hash, dashboard.folderMillis]);
    expect(applied.slice(dashboard.sql.length + 1, -1).map(statement => statement.sql)).toEqual(quickResearch.sql);
    expect(applied.at(-1)?.params).toEqual([quickResearch.hash, quickResearch.folderMillis]);

    const afterDashboard = await migrateFrom(dashboard.folderMillis);
    expect(afterDashboard).toHaveLength(quickResearch.sql.length + 1);
    expect(afterDashboard.slice(0, -1).map(statement => statement.sql)).toEqual(quickResearch.sql);
    expect(afterDashboard.at(-1)?.params).toEqual([quickResearch.hash, quickResearch.folderMillis]);
    expect(await migrateFrom(quickResearch.folderMillis)).toEqual([]);
  });
});
