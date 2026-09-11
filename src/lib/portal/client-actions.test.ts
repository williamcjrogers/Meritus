// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireActionUser,
  findClientDomain,
  createClientDomain,
  deleteClientDomain,
  tryAllowlistClientDomain,
  resetDirectors,
  createInvitation,
} = vi.hoisted(() => ({
  requireActionUser: vi.fn(),
  findClientDomain: vi.fn(),
  createClientDomain: vi.fn(),
  deleteClientDomain: vi.fn(),
  tryAllowlistClientDomain: vi.fn(),
  resetDirectors: vi.fn(),
  createInvitation: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./auth", () => ({ requireActionUser }));
vi.mock("./directors", () => ({ __resetDirectorsCache: resetDirectors }));
vi.mock("./clerk-allowlist", async () => {
  const actual = await vi.importActual<typeof import("./clerk-allowlist")>("./clerk-allowlist");
  return { ...actual, tryAllowlistClientDomain };
});
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(async () => ({ invitations: { createInvitation } })),
}));
vi.mock("@/lib/db/client-domains", () => ({
  findClientDomain,
  createClientDomain,
  deleteClientDomain,
}));

import { revalidatePath } from "next/cache";
import {
  addClientDomainAction,
  inviteClient,
  removeClientDomain,
  removeClientDomainAction,
} from "./client-actions";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  requireActionUser.mockReset();
  findClientDomain.mockReset();
  createClientDomain.mockReset();
  deleteClientDomain.mockReset();
  tryAllowlistClientDomain.mockReset();
  resetDirectors.mockReset();
  createInvitation.mockReset();
  requireActionUser.mockResolvedValue({ ok: true, userId: "user_wr" });
  findClientDomain.mockResolvedValue(null);
  createClientDomain.mockResolvedValue({ id: "cd_1", domain: "bree.co.uk" });
  tryAllowlistClientDomain.mockResolvedValue({ status: "unavailable", reason: "402" });
  createInvitation.mockResolvedValue({ id: "inv_1" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("addClientDomainAction", () => {
  it("stores a normalised company domain and tries a Clerk allowlist identifier", async () => {
    const result = await addClientDomainAction(null, form({ domain: "@BREE.co.uk" }));
    expect(result).toMatchObject({
      ok: true,
      allowlist: { status: "unavailable" },
    });
    expect(createClientDomain).toHaveBeenCalledWith({
      domain: "bree.co.uk",
      createdBy: "user_wr",
      vericaseWorkspaceId: null,
      vericaseWorkspaceName: null,
    });
    expect(tryAllowlistClientDomain).toHaveBeenCalledWith("bree.co.uk");
    expect(resetDirectors).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/portal/clients");
  });

  it("stores optional VeriCase workspace labels", async () => {
    await addClientDomainAction(
      null,
      form({
        domain: "bree.co.uk",
        vericaseWorkspaceId: " ws_verbier ",
        vericaseWorkspaceName: " Verbier ",
      })
    );
    expect(createClientDomain).toHaveBeenCalledWith({
      domain: "bree.co.uk",
      createdBy: "user_wr",
      vericaseWorkspaceId: "ws_verbier",
      vericaseWorkspaceName: "Verbier",
    });
  });

  it("refuses public mailbox and meritusvia.com domains", async () => {
    await expect(addClientDomainAction(null, form({ domain: "gmail.com" }))).resolves.toEqual({
      ok: false,
      error: "Public mailbox domains cannot be added",
    });
    await expect(addClientDomainAction(null, form({ domain: "meritusvia.com" }))).resolves.toEqual({
      ok: false,
      error: "meritusvia.com is reserved for directors",
    });
    expect(createClientDomain).not.toHaveBeenCalled();
  });

  it("refuses a domain that is already listed", async () => {
    findClientDomain.mockResolvedValue({ id: "cd_1", domain: "bree.co.uk" });
    await expect(addClientDomainAction(null, form({ domain: "bree.co.uk" }))).resolves.toEqual({
      ok: false,
      error: "That domain is already listed",
    });
  });

  it("is a director-only action", async () => {
    requireActionUser.mockResolvedValue({ ok: false, error: "This area is for directors only" });
    await expect(addClientDomainAction(null, form({ domain: "bree.co.uk" }))).resolves.toEqual({
      ok: false,
      error: "This area is for directors only",
    });
  });
});

describe("removeClientDomain", () => {
  it("deletes a listed domain", async () => {
    deleteClientDomain.mockResolvedValue(true);
    await expect(removeClientDomain("cd_1")).resolves.toEqual({ ok: true });
    expect(deleteClientDomain).toHaveBeenCalledWith("cd_1");
    expect(removeClientDomainAction).toBeTypeOf("function");
  });
});

describe("inviteClient", () => {
  it("sends a Clerk invitation with role=client", async () => {
    await expect(inviteClient({ email: " Jane@BREE.co.uk " })).resolves.toEqual({ ok: true });
    expect(createInvitation).toHaveBeenCalledWith({
      emailAddress: "jane@bree.co.uk",
      publicMetadata: { role: "client" },
      notify: true,
      redirectUrl: "https://meritusvia.com/client/sign-up",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/portal/clients");
  });

  it("treats a duplicate Clerk invite as success", async () => {
    createInvitation.mockRejectedValue(new Error("Invitation already exists"));
    await expect(inviteClient({ email: "jane@bree.co.uk" })).resolves.toEqual({ ok: true });
  });

  it("is a director-only action", async () => {
    requireActionUser.mockResolvedValue({ ok: false, error: "This area is for directors only" });
    await expect(inviteClient({ email: "jane@bree.co.uk" })).resolves.toEqual({
      ok: false,
      error: "This area is for directors only",
    });
    expect(createInvitation).not.toHaveBeenCalled();
  });

  it("refuses a public mailbox", async () => {
    await expect(inviteClient({ email: "jane@gmail.com" })).resolves.toEqual({
      ok: false,
      error: "Public mailbox addresses cannot be invited.",
    });
  });
});
