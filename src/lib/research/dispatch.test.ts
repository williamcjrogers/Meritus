import { describe, it, expect, vi } from "vitest";
import { dispatchDueResearch, type DispatchDeps } from "./dispatch";
vi.mock("@/lib/db/research", () => ({ dispatchValidatedResearch: vi.fn(), listDueResearchSources: vi.fn(), markResearchSourceUnavailable: vi.fn() }));
const source = { id: "source", provider: "companies-house", status: "ready" as const, credentialRef: "RESEARCH_KEY", hosts: [], selection: {}, backfillStart: "2026-01-01", updatedAt: "2026-09-01", nextDueAt: "2026-09-01" };
function deps(): DispatchDeps { return { due: vi.fn().mockResolvedValue([source]), validate: vi.fn().mockReturnValue({ valid: true }), credential: () => true, unavailable: vi.fn(), dispatch: vi.fn().mockResolvedValue([{ source_id: "source", job_id: "job", enqueued: true }]) }; }
describe("research dispatch validation", () => {
    it("does not enqueue sources with missing credentials", async () => { const d = deps(); d.credential = () => false; await dispatchDueResearch(new Date("2026-09-12"), d); expect(d.unavailable).toHaveBeenCalledWith("source", "credential_missing", source.updatedAt); expect(d.dispatch).toHaveBeenCalledWith(expect.any(Date), []); });
    it("rejects invalid selection before a fake empty run can be created", async () => { const d = deps(); d.validate = () => ({ valid: false }); await dispatchDueResearch(new Date("2026-09-12"), d); expect(d.dispatch).toHaveBeenCalledWith(expect.any(Date), []); });
    it("passes the source revision to the atomic dispatcher", async () => { const d = deps(); const result = await dispatchDueResearch(new Date("2026-09-12"), d); expect(d.dispatch).toHaveBeenCalledWith(expect.any(Date), [{ id: "source", updatedAt: source.updatedAt }]); expect(result.enqueued).toBe(1); });
});
