import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

describe("combined dashboard and research deployment migration selection", () => {
  it("loads twelve unique journal entries with strictly increasing indices and timestamps", () => {
    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
      entries: { idx: number; when: number; tag: string }[];
    };
    const migrations = readMigrationFiles({ migrationsFolder: "drizzle" });
    expect(journal.entries).toHaveLength(12);
    expect(migrations).toHaveLength(12);
    expect(new Set(journal.entries.map(entry => entry.tag)).size).toBe(12);
    expect(new Set(journal.entries.map(entry => entry.when)).size).toBe(12);
    for (const [index, entry] of journal.entries.entries()) {
      expect(entry.idx).toBe(index);
      expect(Number.isSafeInteger(entry.when)).toBe(true);
      expect(migrations[index].folderMillis).toBe(entry.when);
      if (index > 0) expect(entry.when).toBeGreaterThan(journal.entries[index - 1].when);
    }
    expect(journal.entries[9].tag).toBe("0009_portal_dashboard_actions");
    expect(journal.entries[10].tag).toBe("0010_qcs_research_quick");
    expect(journal.entries[11].tag).toBe("0011_client_files");
  });

  it("applies dashboard then quick research from 0008, client files from 0010, and nothing once caught up", async () => {
    const dialect = new PgDialect();
    const migrations = readMigrationFiles({ migrationsFolder: "drizzle" });
    const preceding = migrations.slice(0, 9);
    const dashboard = migrations[9];
    const quickResearch = migrations[10];
    const clientFiles = migrations[11];
    expect(dashboard).toBeDefined();
    expect(quickResearch).toBeDefined();
    expect(clientFiles).toBeDefined();
    const latestBefore = Math.max(...preceding.map(migration => migration.folderMillis));
    expect(dashboard.folderMillis).toBeGreaterThan(latestBefore);
    expect(quickResearch.folderMillis).toBeGreaterThan(dashboard.folderMillis);
    expect(clientFiles.folderMillis).toBeGreaterThan(quickResearch.folderMillis);

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

    /** Each pending migration contributes its own statements, then one row recording its hash and timestamp. */
    function expectAppliedSequence(
      applied: { sql: string; params: unknown[] }[],
      pending: { sql: string[]; hash: string; folderMillis: number }[]
    ) {
      expect(applied).toHaveLength(pending.reduce((total, migration) => total + migration.sql.length + 1, 0));
      let offset = 0;
      for (const migration of pending) {
        expect(applied.slice(offset, offset + migration.sql.length).map(statement => statement.sql)).toEqual(migration.sql);
        expect(applied[offset + migration.sql.length].params).toEqual([migration.hash, migration.folderMillis]);
        offset += migration.sql.length + 1;
      }
    }

    expectAppliedSequence(await migrateFrom(latestBefore), [dashboard, quickResearch, clientFiles]);
    expectAppliedSequence(await migrateFrom(dashboard.folderMillis), [quickResearch, clientFiles]);
    expectAppliedSequence(await migrateFrom(quickResearch.folderMillis), [clientFiles]);
    expect(await migrateFrom(clientFiles.folderMillis)).toEqual([]);
  });
});
