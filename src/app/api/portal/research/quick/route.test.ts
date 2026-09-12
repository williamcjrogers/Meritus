// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/research/roles", async original => ({
  ...await original<typeof import("@/lib/research/roles")>(),
  requireResearchDirector: vi.fn(),
}));
vi.mock("@/lib/env", () => ({ isDatabaseConfigured: vi.fn() }));
vi.mock("@/lib/db/research-quick", () => ({
  enqueueQuickQuestion: vi.fn(),
  listResearchDesk: vi.fn(),
}));

import { enqueueQuickQuestion, listResearchDesk } from "@/lib/db/research-quick";
import { isDatabaseConfigured } from "@/lib/env";
import { requireResearchDirector, ResearchAccessError } from "@/lib/research/roles";
import { GET, POST } from "./route";

const id = "10000000-0000-4000-8000-000000000001";
const input = { requestId: id, question: "What changed in construction payment?", monitoring: true };
const desk = { questions: [], opportunities: [], collection: { enabledSources: 3, lastCollectedAt: null, needsAttention: 1 } };
const request = (body: unknown = input) => new NextRequest("https://example.test/api/portal/research/quick", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireResearchDirector).mockResolvedValue("director-owner");
  vi.mocked(isDatabaseConfigured).mockReturnValue(true);
  vi.mocked(listResearchDesk).mockResolvedValue(desk);
  vi.mocked(enqueueQuickQuestion).mockResolvedValue({ id, status: "queued" });
});

describe("quick research collection API", () => {
  it.each([401, 403, 503])("denies access before either repository operation (%s)", async status => {
    vi.mocked(requireResearchDirector).mockRejectedValue(new ResearchAccessError("access_denied", status));
    for (const response of [await GET(new NextRequest("https://example.test")), await POST(request())]) {
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error: "access_denied" });
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
    expect(listResearchDesk).not.toHaveBeenCalled();
    expect(enqueueQuickQuestion).not.toHaveBeenCalled();
  });

  it("does not use the repository when the database is unconfigured", async () => {
    vi.mocked(isDatabaseConfigured).mockReturnValue(false);
    expect((await GET(new NextRequest("https://example.test"))).status).toBe(503);
    expect((await POST(request())).status).toBe(503);
    expect(listResearchDesk).not.toHaveBeenCalled();
    expect(enqueueQuickQuestion).not.toHaveBeenCalled();
  });

  it.each([["", "new"], ["?view=saved", "saved"], ["?view=another-director", "new"]])(
    "loads the requested desk view using the authenticated actor (%s)", async (query, view) => {
      const response = await GET(new NextRequest("https://example.test/api/portal/research/quick" + query));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(desk);
      expect(listResearchDesk).toHaveBeenCalledExactlyOnceWith("director-owner", view);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    },
  );

  it("queues a trimmed question with the client's retry ID and explicit monitoring choice", async () => {
    const response = await POST(request({ ...input, question: "  Find new payment opportunities  ", monitoring: false }));
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ id, status: "queued" });
    expect(enqueueQuickQuestion).toHaveBeenCalledExactlyOnceWith("director-owner", {
      requestId: id, question: "Find new payment opportunities", monitoring: false,
    });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it.each([
    ["invalid request ID", { ...input, requestId: "not-a-uuid" }],
    ["short trimmed question", { ...input, question: "  abc  " }],
    ["oversized question", { ...input, question: "a".repeat(2001) }],
    ["missing monitoring choice", { requestId: id, question: input.question }],
    ["string monitoring choice", { ...input, monitoring: "false" }],
    ["caller-supplied actor", { ...input, actor: "another-director" }],
    ["caller-supplied budget", { ...input, maxCostPence: 100000 }],
  ])("rejects %s before enqueueing", async (_name, body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(enqueueQuickQuestion).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON before enqueueing", async () => {
    const response = await POST(new NextRequest("https://example.test", { method: "POST", body: "{" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_json" });
    expect(enqueueQuickQuestion).not.toHaveBeenCalled();
  });

  it("rejects an oversized request before enqueueing", async () => {
    const response = await POST(new NextRequest("https://example.test", {
      method: "POST", headers: { "content-length": "1048577" }, body: "{}",
    }));
    expect(response.status).toBe(413);
    expect(enqueueQuickQuestion).not.toHaveBeenCalled();
  });

  it("sanitises unexpected errors from both repository operations", async () => {
    const error = new Error("private database host and provider credential");
    vi.mocked(listResearchDesk).mockRejectedValue(error);
    vi.mocked(enqueueQuickQuestion).mockRejectedValue(error);
    for (const response of [await GET(new NextRequest("https://example.test")), await POST(request())]) {
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        error: "Research request could not be completed. The saved state is unchanged or available on refresh.",
      });
    }
  });
});
