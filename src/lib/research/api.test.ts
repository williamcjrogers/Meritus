import { beforeEach, it, expect, vi } from "vitest";
vi.mock("@/lib/research/roles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./roles")>()),
  requireResearchDirector: vi.fn(),
}));
vi.mock("@/lib/env", () => ({
  isDatabaseConfigured: vi.fn().mockReturnValue(true),
}));
import { researchApi, requestJson } from "./api";
import { requireResearchDirector, ResearchAccessError } from "./roles";
import { isDatabaseConfigured } from "@/lib/env";
beforeEach(() => {
  vi.mocked(requireResearchDirector).mockResolvedValue("director");
  vi.mocked(isDatabaseConfigured).mockReturnValue(true);
});
it.each([401, 403, 503])(
  "denies unavailable or non-director access before handlers execute (%s)",
  async (status) => {
    vi.mocked(requireResearchDirector).mockRejectedValue(
      new ResearchAccessError("access_denied", status),
    );
    const handler = vi.fn();
    const response = await researchApi(handler);
    expect(response.status).toBe(status);
    expect(handler).not.toHaveBeenCalled();
  },
);
it("returns an explicit setup state without a database", async () => {
  vi.mocked(isDatabaseConfigured).mockReturnValue(false);
  const handler = vi.fn();
  expect((await researchApi(handler)).status).toBe(503);
  expect(handler).not.toHaveBeenCalled();
});
it("applies private and robot headers to both JSON and export responses", async () => {
  for (const result of [{ ok: true }, new Response("private export")]) {
    const response = await researchApi(async () => result);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  }
});
it("rejects announced and streamed oversized bodies before parsing", async () => {
  await expect(
    requestJson(
      new Request("https://example.test", {
        method: "POST",
        headers: { "content-length": "1048577" },
        body: "{}",
      }),
    ),
  ).rejects.toMatchObject({ status: 413 });
  const body = new ReadableStream({
    start(c) {
      c.enqueue(new Uint8Array(700000));
      c.enqueue(new Uint8Array(400000));
      c.close();
    },
  });
  const request = new Request("https://example.test", {
    method: "POST",
    body,
    duplex: "half",
  } as RequestInit);
  await expect(requestJson(request)).rejects.toMatchObject({ status: 413 });
});
it("parses bounded JSON and returns a specific validation error for malformed input", async () => {
  expect(
    await requestJson(
      new Request("https://example.test", {
        method: "POST",
        body: '{"question":"Test"}',
      }),
    ),
  ).toEqual({ question: "Test" });
  await expect(
    requestJson(
      new Request("https://example.test", { method: "POST", body: "{" }),
    ),
  ).rejects.toMatchObject({ code: "invalid_json" });
});
