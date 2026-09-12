// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), getUser: vi.fn(), configured: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth, clerkClient: async () => ({ users: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/env", () => ({ isClerkConfigured: mocks.configured }));
import { readResearchActor, requireResearchDirector } from "./roles";
beforeEach(() => { vi.resetAllMocks(); mocks.configured.mockReturnValue(true); mocks.auth.mockResolvedValue({ userId: "director-1" }); });
afterEach(() => vi.useRealTimers());
it("accepts only an explicit director role", async () => {
  for (const role of ["client", undefined, "admin"]) {
    mocks.getUser.mockResolvedValue({ publicMetadata: { role } });
    await expect(requireResearchDirector()).rejects.toMatchObject({ status: 403 });
  }
  mocks.getUser.mockResolvedValue({ publicMetadata: { role: "director" } });
  await expect(requireResearchDirector()).resolves.toBe("director-1");
});
it("rejects anonymous users before a metadata lookup", async () => {
  mocks.auth.mockResolvedValue({ userId: null });
  await expect(requireResearchDirector()).rejects.toMatchObject({ status: 401 });
  expect(mocks.getUser).not.toHaveBeenCalled();
});
it("fails closed during an outage or an unconfigured installation", async () => {
  mocks.getUser.mockRejectedValue(new Error("private provider details"));
  await expect(requireResearchDirector()).rejects.toMatchObject({ message: "actor_unavailable", status: 503 });
  mocks.configured.mockReturnValue(false);
  await expect(requireResearchDirector()).rejects.toMatchObject({ status: 503 });
});
it("bounds a stalled backend lookup", async () => {
  vi.useFakeTimers(); mocks.getUser.mockReturnValue(new Promise(() => {}));
  const pending = expect(readResearchActor("director-1")).rejects.toMatchObject({ status: 503 });
  await vi.advanceTimersByTimeAsync(8000); await pending;
});
