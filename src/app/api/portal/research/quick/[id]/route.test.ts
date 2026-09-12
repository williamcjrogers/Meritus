// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/research/roles", async original => ({
  ...await original<typeof import("@/lib/research/roles")>(), requireResearchDirector: vi.fn(),
}));
vi.mock("@/lib/env", () => ({ isDatabaseConfigured: vi.fn() }));
vi.mock("@/lib/db/research-quick", () => ({ setQuickMonitoring: vi.fn() }));

import { setQuickMonitoring } from "@/lib/db/research-quick";
import { isDatabaseConfigured } from "@/lib/env";
import { requireResearchDirector, ResearchAccessError } from "@/lib/research/roles";
import { PATCH } from "./route";

const id = "10000000-0000-4000-8000-000000000001";
const context = (value = id) => ({ params: Promise.resolve({ id: value }) });
const request = (body: unknown) => new Request("https://example.test", { method: "PATCH", body: JSON.stringify(body) });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireResearchDirector).mockResolvedValue("director-owner");
  vi.mocked(isDatabaseConfigured).mockReturnValue(true);
  vi.mocked(setQuickMonitoring).mockResolvedValue();
});

describe("quick research monitoring API", () => {
  it.each([true, false])("sets monitoring to %s for the authenticated actor", async monitoring => {
    const response = await PATCH(request({ monitoring }), context());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ saved: true });
    expect(setQuickMonitoring).toHaveBeenCalledExactlyOnceWith("director-owner", id, monitoring);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it.each([401, 403, 503])("denies access before parsing or changing monitoring (%s)", async status => {
    vi.mocked(requireResearchDirector).mockRejectedValue(new ResearchAccessError("access_denied", status));
    const response = await PATCH(new Request("https://example.test", { method: "PATCH", body: "{" }), context("invalid"));
    expect(response.status).toBe(status);
    expect(setQuickMonitoring).not.toHaveBeenCalled();
  });

  it("rejects invalid question identifiers before changing monitoring", async () => {
    expect((await PATCH(request({ monitoring: true }), context("not-a-uuid"))).status).toBe(400);
    expect(setQuickMonitoring).not.toHaveBeenCalled();
  });

  it.each([{}, { monitoring: "false" }, { monitoring: true, owner: "another-director" }])(
    "rejects invalid or additional monitoring fields: %j", async body => {
      expect((await PATCH(request(body), context())).status).toBe(400);
      expect(setQuickMonitoring).not.toHaveBeenCalled();
    },
  );

  it("rejects malformed JSON before changing monitoring", async () => {
    const response = await PATCH(new Request("https://example.test", { method: "PATCH", body: "{" }), context());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_json" });
    expect(setQuickMonitoring).not.toHaveBeenCalled();
  });

  it("sanitises an unexpected repository failure", async () => {
    vi.mocked(setQuickMonitoring).mockRejectedValue(new Error("private database connection details"));
    const response = await PATCH(request({ monitoring: false }), context());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Research request could not be completed. The saved state is unchanged or available on refresh.",
    });
  });
});
