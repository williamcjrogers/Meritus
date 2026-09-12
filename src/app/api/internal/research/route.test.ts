import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@/lib/db", () => ({ requireDb: vi.fn() }));
vi.mock("@/lib/db/research", () => ({ createResearchRepository: vi.fn(), getResearchOperationalStatus: vi.fn() }));
vi.mock("@/lib/research/watchlist-dispatch", () => ({ dispatchDueWatchlists: vi.fn() }));
vi.mock("@/lib/research/intelligence-dispatch", () => ({ refreshResearchIntelligence: vi.fn() }));
vi.mock("@/lib/research/dispatch", () => ({ dispatchDueResearch: vi.fn() }));
vi.mock("@/lib/research/runner", () => ({ runResearchChunk: vi.fn() }));
vi.mock("@/lib/research/evidence", () => ({ stageResearchPage: vi.fn(), cleanResearchStaging: vi.fn(), processResearchInvalidation: vi.fn() }));
vi.mock("@/lib/research/sources/registry", () => ({ getConnector: vi.fn() }));
vi.mock("@/lib/research/sources/prepare", () => ({ prepareSourceJob: vi.fn() }));
vi.mock("@/lib/research/extract/pipeline", () => ({ extractEnvelope: vi.fn() }));
vi.mock("@/lib/research/invalidation", () => ({ invalidateResearchDependants: vi.fn() }));
import { GET } from "./route";
import { validResearchCronAuth } from "@/lib/research/cron-auth";
import { dispatchDueResearch } from "@/lib/research/dispatch";
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("internal research scheduler", () => {
  it("fails closed when the scheduler secret is missing", async () => {
    vi.stubEnv("CRON_SECRET", ""); const response = await GET(new NextRequest("https://example.com/api/internal/research"));
    expect(response.status).toBe(503); expect(dispatchDueResearch).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated requests before dispatching", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret"); const response = await GET(new NextRequest("https://example.com/api/internal/research", { headers: { authorization: "Bearer invalid" } }));
    expect(response.status).toBe(401); expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(dispatchDueResearch).not.toHaveBeenCalled();
  });
  it("compares exact bearer credentials including prefix and length", () => {
    expect(validResearchCronAuth("Bearer test-secret", "test-secret")).toBe(true);
    for (const value of [null, "test-secret", "bearer test-secret", "Bearer test-secret ", "Bearer test-secrex"]) expect(validResearchCronAuth(value, "test-secret")).toBe(false);
  });
});
