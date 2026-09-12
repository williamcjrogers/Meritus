// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/research/quick-worker", () => ({ runQuickResearchQuestion: vi.fn() }));
import { runQuickResearchQuestion } from "@/lib/research/quick-worker";
import { GET } from "./route";

const request = (authorization?: string) => new NextRequest("https://example.test/api/internal/research-answers", {
  headers: authorization === undefined ? {} : { authorization },
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CRON_SECRET", "local-test-secret");
  vi.mocked(runQuickResearchQuestion).mockResolvedValue({ status: "complete" });
});
afterEach(() => vi.unstubAllEnvs());

describe("automatic research answers scheduler", () => {
  it("fails closed when the scheduler secret is missing", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const response = await GET(request("Bearer local-test-secret"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "scheduler_unconfigured" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(runQuickResearchQuestion).not.toHaveBeenCalled();
  });

  it.each([undefined, "local-test-secret", "bearer local-test-secret", "Bearer wrong-secret", "Bearer local-test-secrex"])(
    "rejects invalid scheduler authentication before running work (%s)", async authorization => {
      const response = await GET(request(authorization));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "unauthorised" });
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
      expect(runQuickResearchQuestion).not.toHaveBeenCalled();
    },
  );

  it.each(["idle", "complete", "unchanged", "failed", "lease_lost"] as const)(
    "returns the worker's %s result with private headers", async status => {
      vi.mocked(runQuickResearchQuestion).mockResolvedValue({ status });
      const incoming = request("Bearer local-test-secret");
      const response = await GET(incoming);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status });
      expect(runQuickResearchQuestion).toHaveBeenCalledExactlyOnceWith(incoming.signal);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    },
  );

  it("sanitises thrown worker errors without returning credentials or evidence", async () => {
    vi.mocked(runQuickResearchQuestion).mockRejectedValue(new Error("provider credential and private source passage"));
    const response = await GET(request("Bearer local-test-secret"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "research_answer_worker_failed" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});
