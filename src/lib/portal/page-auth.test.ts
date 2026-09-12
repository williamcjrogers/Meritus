// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), identity: vi.fn(), headers: vi.fn(), configured: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
  clerkMiddleware: (handler: (auth: typeof mocks.auth, request: NextRequest) => unknown) =>
    (request: NextRequest) => handler(mocks.auth, request),
}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock("@/lib/portal/roles", () => ({ resolveIdentity: mocks.identity }));
vi.mock("@/lib/env", () => ({ isClerkConfigured: mocks.configured, isDatabaseConfigured: () => true }));
import middleware from "@/middleware";
import { requirePageIdentity, requireWorkspacePage } from "./auth";
import { PAGE_PATH_HEADER, pageRequestHeaders, requestedPagePath } from "./request-path";

const director = { userId: "staff-1", role: "director", domain: null, email: "staff@meritusvia.com" };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.configured.mockReturnValue(true);
  mocks.auth.mockResolvedValue({ userId: "staff-1", sessionClaims: { metadata: { role: "director" } } });
  mocks.identity.mockResolvedValue(director);
  mocks.headers.mockResolvedValue(new Headers());
});

async function passMiddleware(path: string, suppliedPath = "/portal/spoofed") {
  const request = new NextRequest(`https://meritusvia.com${path}`, { headers: { [PAGE_PATH_HEADER]: suppliedPath } });
  const response = await middleware(request, {})!;
  if (!response) throw new Error("Expected middleware response");
  expect(response.headers.get("x-middleware-next")).toBe("1");
  const forwarded = response.headers.get(`x-middleware-request-${PAGE_PATH_HEADER}`);
  mocks.headers.mockResolvedValue(new Headers(forwarded ? { [PAGE_PATH_HEADER]: forwarded } : {}));
  return forwarded;
}

describe("page recovery after successful middleware verification", () => {
  it("keeps the actual deep link and query when the next backend lookup fails", async () => {
    const path = "/portal/actions?scope=mine&edit=record-1";
    expect(await passMiddleware(path)).toBe(path);
    mocks.identity.mockRejectedValueOnce(new Error("provider unavailable"));
    await expect(requireWorkspacePage("/portal")).rejects.toThrow(`redirect:/access/unavailable?returnTo=${encodeURIComponent(path)}`);
    expect(mocks.identity).toHaveBeenCalledTimes(2);
  });
  it.each([
    ["client", "/client"],
    [null, "/access/denied"],
  ])("observes a later role change to %s instead of reusing middleware authority", async (role, destination) => {
    await passMiddleware("/portal/research/runs?view=recent");
    mocks.identity.mockResolvedValueOnce({ ...director, role });
    await expect(requireWorkspacePage("/portal/research")).rejects.toThrow(`redirect:${destination}`);
    expect(mocks.identity).toHaveBeenCalledTimes(2);
  });
  it("preserves the deep link when the session expires between the checks", async () => {
    const path = "/portal/research/investigations/123?tab=evidence";
    await passMiddleware(path);
    mocks.auth.mockResolvedValueOnce({ userId: null });
    await expect(requireWorkspacePage("/portal")).rejects.toThrow(`redirect:/sign-in?returnTo=${encodeURIComponent(path)}`);
  });
  it("preserves client queries for direct page verification recovery", async () => {
    mocks.identity.mockResolvedValueOnce({ ...director, role: "client", domain: "example.co.uk" });
    const path = "/client?receipt=recent";
    await passMiddleware(path);
    mocks.identity.mockRejectedValueOnce(new Error("provider unavailable"));
    await expect(requirePageIdentity("/client")).rejects.toThrow(`redirect:/access/unavailable?returnTo=${encodeURIComponent(path)}`);
  });
  it("rejects protected rendering in an unconfigured installation", async () => {
    mocks.configured.mockReturnValue(false);
    await expect(requireWorkspacePage("/portal/actions")).rejects.toThrow("redirect:/access/unavailable?returnTo=%2Fportal%2Factions");
    expect(mocks.identity).not.toHaveBeenCalled();
  });
});

describe("request-path header boundary", () => {
  it("overwrites even a plausible caller-supplied path using the real URL", () => {
    const headers = pageRequestHeaders({ headers: new Headers({ [PAGE_PATH_HEADER]: "/portal/other?scope=team", "x-request-id": "id1" }), nextUrl: { pathname: "/portal/actions", search: "?scope=mine" } });
    expect(headers.get(PAGE_PATH_HEADER)).toBe("/portal/actions?scope=mine");
    expect(headers.get("x-request-id")).toBe("id1");
  });
  it("removes a spoofed header on public and account-resolution routes", async () => {
    expect(await passMiddleware("/account?returnTo=%2Fclient", "https://evil.example")).toBeNull();
  });
  it.each(["https://evil.example", "//evil.example", "/api/portal", "/portalish", "/portal/../../api", "/portal/%5cevil", "/client?tab=other"])("ignores unsafe or other-experience header %s", value => {
    expect(requestedPagePath("/portal/actions?scope=mine", value)).toBe("/portal/actions?scope=mine");
  });
});
