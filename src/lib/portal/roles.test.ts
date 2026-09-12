// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, clerkClient } = vi.hoisted(() => {
  const getUser = vi.fn();
  const clerkClient = vi.fn(async () => ({ users: { getUser } }));
  return { getUser, clerkClient };
});

vi.mock("@clerk/nextjs/server", () => ({ clerkClient }));

import { __resetIdentityCache, identityFromClaims, resolveIdentity, roleFromMetadata } from "./roles";

beforeEach(() => {
  __resetIdentityCache();
  getUser.mockReset();
  clerkClient.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("roleFromMetadata", () => {
  it("accepts only the two roles", () => {
    expect(roleFromMetadata("director")).toBe("director");
    expect(roleFromMetadata("client")).toBe("client");
    expect(roleFromMetadata("admin")).toBeNull();
    expect(roleFromMetadata(undefined)).toBeNull();
  });
});

describe("identityFromClaims", () => {
  it("reads the metadata claim", () => {
    expect(
      identityFromClaims("user_1", { metadata: { role: "client", domain: "example-firm.co.uk", email: "jane@example-firm.co.uk" } })
    ).toEqual({ userId: "user_1", role: "client", domain: "example-firm.co.uk", email: "jane@example-firm.co.uk" });
  });
  it("is null without a metadata claim", () => {
    expect(identityFromClaims("user_1", { sub: "user_1" })).toBeNull();
    expect(identityFromClaims("user_1", null)).toBeNull();
  });
});

describe("resolveIdentity", () => {
  it("uses the claim and never calls Clerk when the claim carries a role", async () => {
    const identity = await resolveIdentity("user_1", { metadata: { role: "director" } });
    expect(identity).toEqual({ userId: "user_1", role: "director", domain: null, email: null });
    expect(clerkClient).not.toHaveBeenCalled();
  });

  it("falls back to the Backend API, reads public metadata and the primary email, and caches", async () => {
    getUser.mockResolvedValue({
      id: "user_2",
      publicMetadata: { role: "client", domain: "example-firm.co.uk" },
      primaryEmailAddressId: "em_1",
      emailAddresses: [
        { id: "em_0", emailAddress: "old@example-firm.co.uk" },
        { id: "em_1", emailAddress: "jane@example-firm.co.uk" },
      ],
    });
    const first = await resolveIdentity("user_2", { sub: "user_2" });
    const second = await resolveIdentity("user_2", undefined);
    expect(first).toEqual({ userId: "user_2", role: "client", domain: "example-firm.co.uk", email: "jane@example-firm.co.uk" });
    expect(second).toEqual(first);
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it("expires the cache after five minutes", async () => {
    vi.useFakeTimers();
    getUser.mockResolvedValue({ id: "user_3", publicMetadata: { role: "director" }, primaryEmailAddressId: null, emailAddresses: [] });
    await resolveIdentity("user_3", null);
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await resolveIdentity("user_3", null);
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it("returns no role when Clerk fails, and does not cache the failure", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    getUser.mockRejectedValueOnce(new Error("down"));
    expect(await resolveIdentity("user_4", null)).toEqual({ userId: "user_4", role: null, domain: null, email: null });
    getUser.mockResolvedValueOnce({ id: "user_4", publicMetadata: { role: "director" }, primaryEmailAddressId: null, emailAddresses: [] });
    expect((await resolveIdentity("user_4", null)).role).toBe("director");
  });

  it("denies a user whose metadata has no role", async () => {
    getUser.mockResolvedValue({ id: "user_5", publicMetadata: {}, primaryEmailAddressId: null, emailAddresses: [] });
    expect((await resolveIdentity("user_5", null)).role).toBeNull();
  });
});
