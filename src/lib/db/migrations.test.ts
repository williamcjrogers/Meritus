// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLIENT_UPLOAD_STATUSES, documentScopeEnum } from "./schema";

const root = join(process.cwd(), "drizzle");
const journal = JSON.parse(readFileSync(join(root, "meta", "_journal.json"), "utf8")) as {
  entries: { idx: number; when: number; tag: string; breakpoints: boolean }[];
};

describe("migration journal", () => {
  it("has a file for every entry, in ascending order", () => {
    let lastWhen = 0;
    journal.entries.forEach((entry, index) => {
      expect(entry.idx).toBe(index);
      expect(entry.when).toBeGreaterThan(lastWhen);
      expect(existsSync(join(root, `${entry.tag}.sql`))).toBe(true);
      lastWhen = entry.when;
    });
  });

  it("includes 0011_client_files with the client tables and the wider size column", () => {
    const entry = journal.entries.find((e) => e.tag === "0011_client_files");
    expect(entry).toBeDefined();
    const sql = readFileSync(join(root, "0011_client_files.sql"), "utf8");
    expect(sql).toMatch(/ALTER TYPE "document_scope" ADD VALUE IF NOT EXISTS 'client'/);
    expect(sql).toMatch(/CREATE TABLE "client_domains"/);
    expect(sql).toMatch(/CREATE TABLE "client_uploads"/);
    expect(sql).toMatch(/ALTER TABLE "documents" ALTER COLUMN "size" TYPE bigint/);
    expect(sql).toMatch(/ADD COLUMN "client_domain_id"/);
    expect(sql).toMatch(/ADD COLUMN "uploader_email"/);
  });
});

describe("schema", () => {
  it("knows the client scope and the upload statuses", () => {
    expect(documentScopeEnum.enumValues).toEqual(["pursuit", "library", "client"]);
    expect(CLIENT_UPLOAD_STATUSES).toEqual(["pending", "complete", "aborted"]);
  });
});
