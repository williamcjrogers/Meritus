// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), identity: vi.fn(), database: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/portal/roles", () => ({ resolveIdentity: mocks.identity }));
vi.mock("@/lib/env", () => ({ isClerkConfigured: () => true, isDatabaseConfigured: () => true, missingRequiredSetup: () => null }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-meritus-page-path": "/portal?scope=mine" }),
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock("@/lib/db/index", () => ({ requireDb: mocks.database }));
vi.mock("@/components/portal/dashboard/HomeDashboard", () => ({ HomeDashboard: () => null }));
import HomePage from "./page";
import { readDashboard } from "@/lib/dashboard/read";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "staff-1" });
  mocks.identity.mockResolvedValue({ userId: "staff-1", role: "director", domain: null, email: null });
});

it.each([503, 401, 403])("runs the actual Home guard and reader, then recovers its later %s access failure", async status => {
  if (status === 503) mocks.identity.mockResolvedValueOnce({ userId: "staff-1", role: "director" }).mockRejectedValueOnce(new Error("provider unavailable"));
  if (status === 401) mocks.auth.mockResolvedValueOnce({ userId: "staff-1" }).mockResolvedValueOnce({ userId: null });
  if (status === 403) mocks.identity.mockResolvedValueOnce({ userId: "staff-1", role: "director" }).mockResolvedValueOnce({ userId: "staff-1", role: "client" });
  const destination = status === 503 ? "/access/unavailable?returnTo=%2Fportal%3Fscope%3Dmine" : status === 401 ? "/sign-in?returnTo=%2Fportal%3Fscope%3Dmine" : "/access/denied";
  await expect(HomePage({ searchParams: Promise.resolve({ scope: "mine" }) })).rejects.toThrow(`redirect:${destination}`);
  expect(mocks.auth).toHaveBeenCalledTimes(2);
  expect(mocks.database).not.toHaveBeenCalled();
});

it("keeps the same backend reader's typed error for non-page callers", async () => {
  mocks.identity.mockRejectedValueOnce(new Error("provider unavailable"));
  await expect(readDashboard("mine", new Date())).rejects.toMatchObject({ name: "ResearchAccessError", status: 503, code: "actor_unavailable" });
});
