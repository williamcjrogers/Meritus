import { describe, it, expect, vi } from "vitest";
import { runResearchChunk, type RunnerDeps } from "./runner";
import type { Lease } from "./contracts";
vi.mock("@/lib/db/research", () => ({ withResearchRun: (_id: string, work: () => unknown) => work() }));
const lease: Lease = { id: "job", sourceId: "source", scopeKey: "test", runId: "run", payload: { window: { from: "2026-01-01", to: "2026-02-01" } }, cursor: null, leaseToken: 1, revision: 0, attempts: 1 };
function deps(): RunnerDeps {
    return { lease: vi.fn().mockResolvedValue(lease), source: vi.fn().mockResolvedValue({ id: "source", provider: "fixture", status: "ready", hosts: [], credentialRef: null }), prepare: vi.fn().mockImplementation(input => Promise.resolve(input.payload)), connector: vi.fn().mockReturnValue({ provider: "fixture", fetchPage: vi.fn().mockResolvedValue({ records: [], nextCursor: null, coverage: { complete: true, notes: [] } }) }), extract: vi.fn(), stage: vi.fn().mockResolvedValue([]), commit: vi.fn().mockResolvedValue(true), fail: vi.fn().mockResolvedValue(undefined), cancelled: vi.fn().mockResolvedValue(false) };
}
describe("research runner", () => {
    it("commits one bounded page with the leased revision", async () => {
        const d = deps();
        expect(await runResearchChunk(d, new AbortController().signal)).toEqual({ status: "committed" });
        expect(d.commit).toHaveBeenCalledWith(expect.objectContaining({ leaseToken: 1, expectedRevision: 0 }));
    });
    it("never commits after extraction fails", async () => {
        const d = deps();
        vi.mocked(d.stage).mockRejectedValue(new Error("parse_incomplete"));
        expect(await runResearchChunk(d, new AbortController().signal)).toEqual({ status: "failed" });
        expect(d.commit).not.toHaveBeenCalled();
        expect(d.fail).toHaveBeenCalledOnce();
    });
    it("checks cancellation before preparation and again before commit", async () => {
        const d = deps();
        vi.mocked(d.cancelled).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
        await runResearchChunk(d, new AbortController().signal);
        expect(d.commit).not.toHaveBeenCalled();
        expect(d.fail).toHaveBeenCalledWith(lease, expect.objectContaining({ message: "cancelled" }));
    });
    it("aborts a pending connector on shutdown without a false success", async () => {
        const d = deps();
        const parent = new AbortController();
        d.connector = () => ({ provider: "fixture", fetchPage: ({ signal }) => new Promise((_, reject) => { signal.addEventListener("abort", () => reject(signal.reason), { once: true }); parent.abort(); }) });
        expect(await runResearchChunk(d, parent.signal)).toEqual({ status: "failed" });
        expect(d.commit).not.toHaveBeenCalled();
    });
    it("does not lease work after shutdown", async () => {
        const d = deps();
        await expect(runResearchChunk(d, AbortSignal.abort())).rejects.toThrow();
        expect(d.lease).not.toHaveBeenCalled();
    });
    it("rejects malformed or reversed windows before connector calls", async () => {
        const d = deps();
        vi.mocked(d.lease).mockResolvedValue({ ...lease, payload: { window: { from: "2026-03-01", to: "2026-02-01" } } });
        await runResearchChunk(d, new AbortController().signal);
        expect(d.connector).not.toHaveBeenCalled();
        expect(d.commit).not.toHaveBeenCalled();
    });
});
