import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ requireDb: vi.fn() }));
import { dispatchDueWatchlists, prepareWatchlistMember, type DueWatchlistMember } from "./watchlist-dispatch";
const member: DueWatchlistMember = { id: "member", watchlistId: "watch", revision: 1, updatedAt: "2026-01-01", entityId: "entity", entityUpdatedAt: "2026-01-01", subject: "Confirmed Construction Limited", jurisdiction: "England and Wales", companyNumber: "SC000123", sources: [{ id: "source", provider: "companies-house", selection: { companyNumber: "99999999" }, credentialRef: "RESEARCH_CH_KEY", status: "ready", updatedAt: "2026-01-01", backfillStart: "2026-01-01", watermarkAt: "2026-09-10T12:00:00Z" }] };
const now = new Date("2026-09-12T10:00:00Z");
describe("watchlist dispatcher", () => {
  it("uses the verified entity number instead of a different configured source company", () => {
    const result = prepareWatchlistMember(member, now, () => true);
    expect(result.sources[0].payload?.selection).toEqual({ companyNumber: "SC000123" });
    expect(result.sources[0].payload?.window).toEqual({ from: "2026-09-10T11:00:00.000Z", to: now.toISOString() });
  });
  it("does not query a configured unrelated company when the member lacks a verified identifier", () => {
    const result = prepareWatchlistMember({ ...member, companyNumber: null }, now, () => true);
    expect(result.sources[0].payload).toBeNull(); expect(result.sources[0].error).toBe("verified_company_number_required");
  });
  it("records missing credentials and invalid provider selection without inventing empty results", () => {
    expect(prepareWatchlistMember(member, now, () => false).sources[0].error).toBe("credential_missing");
    expect(prepareWatchlistMember({ ...member, sources: [{ ...member.sources[0], provider: "gazette", selection: {} }] }, now, () => true).sources[0].error).toBe("selection_invalid");
  });
  it("keeps procurement selection native rather than appending an unsupported subject query", () => {
    const result = prepareWatchlistMember({ ...member, sources: [{ ...member.sources[0], provider: "find-a-tender", selection: {} }] }, now, () => true);
    expect(result.sources[0].payload?.selection).toEqual({});
  });
  it("hands revision-checked candidates to one atomic database operation", async () => {
    const dispatch = vi.fn().mockResolvedValue({ enqueued: 1, active: 0, unavailable: 0 });
    expect(await dispatchDueWatchlists(now, { due: async () => [member], credential: () => true, dispatch })).toEqual({ enqueued: 1, active: 0, unavailable: 0 });
    expect(dispatch).toHaveBeenCalledOnce(); expect(dispatch.mock.calls[0][1][0].revision).toBe(1);
  });
});
