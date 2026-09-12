// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** A Clerk user whose primary, verified address is `email`; the shape the Backend API returns. */
function existingUser(publicMetadata: Record<string, unknown>, email = "jane@example-firm.co.uk") {
  return {
    id: "user_old",
    publicMetadata,
    primaryEmailAddressId: "em_1",
    emailAddresses: [{ id: "em_1", emailAddress: email, verification: { status: "verified" } }],
  };
}

const clerk = vi.hoisted(() => {
  const getUserList = vi.fn();
  const createUser = vi.fn();
  const updateUserMetadata = vi.fn();
  const createSignInToken = vi.fn();
  const clerkClient = vi.fn(async () => ({
    users: { getUserList, createUser, updateUserMetadata },
    signInTokens: { createSignInToken },
  }));
  return { getUserList, createUser, updateUserMetadata, createSignInToken, clerkClient };
});

vi.mock("@clerk/nextjs/server", () => ({ clerkClient: clerk.clerkClient }));

import { ACCESS_LINK_TTL_SECONDS, accessLinkOrigin, continueUrl, issueAccessLink, randomPassword } from "./link";

beforeEach(() => {
  vi.clearAllMocks();
  clerk.getUserList.mockResolvedValue({ data: [], totalCount: 0 });
  clerk.createUser.mockResolvedValue({ id: "user_new" });
  clerk.updateUserMetadata.mockResolvedValue({ id: "user_old" });
  clerk.createSignInToken.mockResolvedValue({ id: "sit_1", token: "tok.abc/=", status: "pending", url: "https://clerk.example/x" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("accessLinkOrigin and continueUrl", () => {
  it("defaults to the site url and honours ACCESS_LINK_ORIGIN without a trailing slash", () => {
    expect(accessLinkOrigin()).toBe("https://meritusvia.com");
    vi.stubEnv("ACCESS_LINK_ORIGIN", "https://preview.example.com/");
    expect(accessLinkOrigin()).toBe("https://preview.example.com");
  });
  it("encodes the ticket", () => {
    expect(continueUrl("https://meritusvia.com", "tok.abc/=")).toBe("https://meritusvia.com/access/continue?ticket=tok.abc%2F%3D");
  });
});

describe("randomPassword", () => {
  it("is long and never repeats", () => {
    const a = randomPassword();
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(a).not.toBe(randomPassword());
  });
});

describe("issueAccessLink", () => {
  it("creates a client user with the role, domain and address, then mints a 30-minute token", async () => {
    const result = await issueAccessLink({ email: "Jane@Example-Firm.co.uk", domain: "example-firm.co.uk" });
    expect(clerk.getUserList).toHaveBeenCalledWith({ emailAddress: ["jane@example-firm.co.uk"], limit: 1 });
    expect(clerk.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        emailAddress: ["jane@example-firm.co.uk"],
        skipPasswordChecks: true,
        publicMetadata: { role: "client", domain: "example-firm.co.uk", email: "jane@example-firm.co.uk" },
      })
    );
    expect(clerk.createUser.mock.calls[0][0].password.length).toBeGreaterThanOrEqual(40);
    expect(clerk.createSignInToken).toHaveBeenCalledWith({ userId: "user_new", expiresInSeconds: ACCESS_LINK_TTL_SECONDS });
    expect(result).toEqual({ ok: true, url: "https://meritusvia.com/access/continue?ticket=tok.abc%2F%3D", userId: "user_new" });
  });

  it("reuses an existing client user without touching their metadata", async () => {
    clerk.getUserList.mockResolvedValue({
      data: [existingUser({ role: "client", domain: "example-firm.co.uk" })],
      totalCount: 1,
    });
    const result = await issueAccessLink({ email: "jane@example-firm.co.uk", domain: "example-firm.co.uk" });
    expect(clerk.createUser).not.toHaveBeenCalled();
    expect(clerk.updateUserMetadata).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, userId: "user_old" });
  });

  it("stamps the client role on an existing user who has none", async () => {
    clerk.getUserList.mockResolvedValue({ data: [existingUser({})], totalCount: 1 });
    await issueAccessLink({ email: "jane@example-firm.co.uk", domain: "example-firm.co.uk" });
    expect(clerk.updateUserMetadata).toHaveBeenCalledWith("user_old", {
      publicMetadata: { role: "client", domain: "example-firm.co.uk", email: "jane@example-firm.co.uk" },
    });
  });

  it("refuses an account whose primary verified address is not the one typed", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const other = existingUser({ role: "client", domain: "other.co.uk" }, "jane@other.co.uk");
    other.emailAddresses.push({ id: "em_added", emailAddress: "jane@example-firm.co.uk", verification: { status: "unverified" } });
    clerk.getUserList.mockResolvedValue({ data: [other], totalCount: 1 });
    expect(await issueAccessLink({ email: "jane@example-firm.co.uk", domain: "example-firm.co.uk" })).toEqual({ ok: false, reason: "unmatched" });
    expect(clerk.updateUserMetadata).not.toHaveBeenCalled();
    expect(clerk.createSignInToken).not.toHaveBeenCalled();
  });

  it("never issues a client link to a director", async () => {
    clerk.getUserList.mockResolvedValue({ data: [{ id: "user_wr", publicMetadata: { role: "director" } }], totalCount: 1 });
    expect(await issueAccessLink({ email: "w@example-firm.co.uk", domain: "example-firm.co.uk" })).toEqual({ ok: false, reason: "director" });
    expect(clerk.createSignInToken).not.toHaveBeenCalled();
  });

  it("reports a Clerk failure without throwing", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    clerk.createSignInToken.mockRejectedValue(new Error("boom"));
    expect(await issueAccessLink({ email: "jane@example-firm.co.uk", domain: "example-firm.co.uk" })).toEqual({ ok: false, reason: "clerk_error" });
  });
});
