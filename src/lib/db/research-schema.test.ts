import { describe, it, expect } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "./research-schema";
describe("research database schema", () => {
    it("scopes every research table to the QCS workspace", () => {
        for (const table of Object.values(schema)) {
            expect(getTableConfig(table).columns.map(column => column.name)).toContain("workspace_id");
        }
    });
    it("separates evidence from client uploads and enforces one active scope", () => {
        expect(getTableConfig(schema.researchDocuments).name).toBe("research_documents");
        expect(getTableConfig(schema.researchJobs).indexes.map(index => index.config.name)).toContain("research_one_active_scope");
    });
    it("has source budget checks and staged object provenance", () => {
        expect(getTableConfig(schema.researchSources).checks.map(check => check.name)).toContain("research_source_limits");
        expect(getTableConfig(schema.researchStagedObjects).columns.map(column => column.name)).toEqual(expect.arrayContaining(["source_id", "size", "sha256", "claimed_at"]));
    });
});
