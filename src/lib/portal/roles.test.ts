// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { getUser, clerkClient } = vi.hoisted(() => {
  const getUser = vi.fn();
  return { getUser, clerkClient: vi.fn(async () => ({ users: { getUser } })) };
});
vi.mock("@clerk/nextjs/server", () => ({ clerkClient }));
import { resolveIdentity, roleFromMetadata } from "./roles";
const user = (role: unknown) => ({ publicMetadata: { role, domain: "example.co.uk" }, primaryEmailAddressId: "em_1", emailAddresses: [{ id: "em_1", emailAddress: "jane@example.co.uk", verification: { status: "verified" } }] });
beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, "warn").mockImplementation(() => {}); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe("authoritative identity", () => {
  it("accepts only explicit known metadata roles", () => {
    expect(roleFromMetadata("director")).toBe("director");
    expect(roleFromMetadata("client")).toBe("client");
    expect(roleFromMetadata("admin")).toBeNull();
  });
  it("ignores an old director session when the current account is a client", async () => {
    getUser.mockResolvedValue(user("client"));
    expect(await resolveIdentity("u1", { metadata: { role: "director" } })).toEqual({ userId: "u1", role: "client", domain: "example.co.uk", email: "jane@example.co.uk" });
    expect(getUser).toHaveBeenCalledWith("u1");
  });
  it("observes a revocation on the very next operation", async () => {
    getUser.mockResolvedValueOnce(user("director")).mockResolvedValueOnce(user(null));
    expect((await resolveIdentity("u1")).role).toBe("director");
    expect((await resolveIdentity("u1")).role).toBeNull();
    expect(getUser).toHaveBeenCalledTimes(2);
  });
  it("never replaces a provider failure with a confirmed refusal or cached grant", async () => {
    getUser.mockResolvedValueOnce(user("director")).mockRejectedValueOnce(new Error("private details")).mockResolvedValueOnce(user("client"));
    await resolveIdentity("u1");
    await expect(resolveIdentity("u1")).rejects.toMatchObject({ status: 503, code: "IDENTITY_UNAVAILABLE" });
    expect((await resolveIdentity("u1")).role).toBe("client");
  });
  it("denies a deleted account even when its old session claims staff access", async () => {
    getUser.mockRejectedValue({ status: 404 });
    expect((await resolveIdentity("u1", { metadata: { role: "director" } })).role).toBeNull();
  });
  it("bounds lookup at eight seconds and clears the timer", async () => {
    vi.useFakeTimers(); getUser.mockReturnValue(new Promise(() => {}));
    const pending = expect(resolveIdentity("u1")).rejects.toMatchObject({ status: 503 });
    await vi.advanceTimersByTimeAsync(8000); await pending;
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not present an unverified email address as verified identity", async () => {
    getUser.mockResolvedValue({ ...user("client"), emailAddresses: [{ id: "em_1", emailAddress: "other@example.co.uk", verification: { status: "unverified" } }] });
    expect((await resolveIdentity("u1")).email).toBeNull();
  });
});
