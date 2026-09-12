// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/research/roles", async original => ({
  ...await original<typeof import("@/lib/research/roles")>(), requireResearchDirector: vi.fn(),
}));
vi.mock("@/lib/env", () => ({ isDatabaseConfigured: vi.fn() }));
vi.mock("@/lib/db/research-quick", () => ({ reviewOpportunity: vi.fn() }));

import { reviewOpportunity } from "@/lib/db/research-quick";
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
  vi.mocked(reviewOpportunity).mockResolvedValue();
});

describe("research opportunity decisions API", () => {
  it.each(["save", "dismiss", "reopen"] as const)("records %s for the authenticated actor", async action => {
    const response = await PATCH(request({ action }), context());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ saved: true });
    expect(reviewOpportunity).toHaveBeenCalledExactlyOnceWith("director-owner", id, action);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it.each([401, 403, 503])("denies access before parsing or recording a decision (%s)", async status => {
    vi.mocked(requireResearchDirector).mockRejectedValue(new ResearchAccessError("access_denied", status));
    const response = await PATCH(new Request("https://example.test", { method: "PATCH", body: "{" }), context("invalid"));
    expect(response.status).toBe(status);
    expect(reviewOpportunity).not.toHaveBeenCalled();
  });

  it("rejects an invalid document identifier before recording a decision", async () => {
    expect((await PATCH(request({ action: "save" }), context("not-a-uuid"))).status).toBe(400);
    expect(reviewOpportunity).not.toHaveBeenCalled();
  });

  it.each([{}, { action: "convert" }, { action: "save", actor: "another-director" }])(
    "rejects invalid or additional decision fields: %j", async body => {
      expect((await PATCH(request(body), context())).status).toBe(400);
      expect(reviewOpportunity).not.toHaveBeenCalled();
    },
  );

  it("rejects malformed JSON before recording a decision", async () => {
    const response = await PATCH(new Request("https://example.test", { method: "PATCH", body: "{" }), context());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_json" });
    expect(reviewOpportunity).not.toHaveBeenCalled();
  });

  it("sanitises an unexpected repository failure", async () => {
    vi.mocked(reviewOpportunity).mockRejectedValue(new Error("private provider credentials"));
    const response = await PATCH(request({ action: "save" }), context());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Research request could not be completed. The saved state is unchanged or available on refresh.",
    });
  });
});
