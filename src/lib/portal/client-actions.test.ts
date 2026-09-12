// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import {
  findClientDomainByName,
  insertClientDomain,
  reactivateClientDomain,
  removeClientDomain,
  setClientDomainPursuit,
} from "@/lib/db/client-domains";
import { getPursuit } from "@/lib/db/pursuits";
import { requireActionUser } from "./auth";
import { addClientDomainAction, linkClientDomainAction, removeClientDomainAction } from "./client-actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./auth", () => ({ requireActionUser: vi.fn() }));
vi.mock("@/lib/db/client-domains", () => ({
  findClientDomainByName: vi.fn(),
  insertClientDomain: vi.fn(),
  reactivateClientDomain: vi.fn(),
  removeClientDomain: vi.fn(),
  setClientDomainPursuit: vi.fn(),
}));
vi.mock("@/lib/db/pursuits", () => ({ getPursuit: vi.fn() }));

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const removed = { id: "cd_old", domain: "example-firm.co.uk", firm: "Old name", pursuitId: null, createdBy: "user_wr", createdAt: new Date(), removedAt: new Date() };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireActionUser).mockResolvedValue({ ok: true, userId: "user_wr" });
  vi.mocked(findClientDomainByName).mockResolvedValue(null);
  vi.mocked(getPursuit).mockResolvedValue({ id: "p1" } as never);
  vi.mocked(insertClientDomain).mockImplementation(async (values) => ({ ...removed, ...values, removedAt: null }) as never);
  vi.mocked(removeClientDomain).mockResolvedValue(true);
  vi.mocked(setClientDomainPursuit).mockResolvedValue({ ...removed, removedAt: null, pursuitId: "p1" });
});

describe("addClientDomainAction", () => {
  it("lists a domain with its firm and pursuit", async () => {
    const result = await addClientDomainAction(null, form({ domain: "Jane@Example-Firm.co.uk", firm: " Example Firm LLP ", pursuitId: "p1" }));
    expect(result).toEqual({ ok: true, domain: "example-firm.co.uk" });
    expect(insertClientDomain).toHaveBeenCalledWith(expect.objectContaining({ domain: "example-firm.co.uk", firm: "Example Firm LLP", pursuitId: "p1", createdBy: "user_wr" }));
    expect(revalidatePath).toHaveBeenCalledWith("/portal", "layout");
  });
  it("refuses public mailboxes, the firm's own domain, a missing firm name and a dead pursuit", async () => {
    expect(await addClientDomainAction(null, form({ domain: "gmail.com", firm: "X" }))).toEqual({ ok: false, error: "Public mailbox domains cannot be added" });
    expect(await addClientDomainAction(null, form({ domain: "meritusvia.com", firm: "X" }))).toEqual({ ok: false, error: "meritusvia.com is reserved for directors" });
    expect(await addClientDomainAction(null, form({ domain: "example-firm.co.uk", firm: " " }))).toEqual({ ok: false, error: "Enter the firm's name" });
    vi.mocked(getPursuit).mockResolvedValue(null);
    expect(await addClientDomainAction(null, form({ domain: "example-firm.co.uk", firm: "X", pursuitId: "gone" }))).toEqual({ ok: false, error: "That pursuit no longer exists" });
    expect(insertClientDomain).not.toHaveBeenCalled();
  });
  it("refuses a domain that is already listed and re-lists a removed one", async () => {
    vi.mocked(findClientDomainByName).mockResolvedValue({ ...removed, removedAt: null });
    expect(await addClientDomainAction(null, form({ domain: "example-firm.co.uk", firm: "X" }))).toEqual({ ok: false, error: "That domain is already listed" });
    vi.mocked(findClientDomainByName).mockResolvedValue(removed);
    expect(await addClientDomainAction(null, form({ domain: "example-firm.co.uk", firm: "New name" }))).toEqual({ ok: true, domain: "example-firm.co.uk" });
    expect(reactivateClientDomain).toHaveBeenCalledWith("cd_old", { firm: "New name", pursuitId: null });
    expect(insertClientDomain).not.toHaveBeenCalled();
  });
  it("refuses anyone who is not a director", async () => {
    vi.mocked(requireActionUser).mockResolvedValue({ ok: false, error: "Directors only" });
    expect(await addClientDomainAction(null, form({ domain: "example-firm.co.uk", firm: "X" }))).toEqual({ ok: false, error: "Directors only" });
  });
});

describe("removeClientDomainAction and linkClientDomainAction", () => {
  it("removes and links", async () => {
    expect(await removeClientDomainAction("cd_old")).toEqual({ ok: true });
    expect(removeClientDomain).toHaveBeenCalledWith("cd_old");
    expect(await linkClientDomainAction("cd_old", "p1")).toEqual({ ok: true });
    expect(setClientDomainPursuit).toHaveBeenCalledWith("cd_old", "p1");
    expect(await linkClientDomainAction("cd_old", null)).toEqual({ ok: true });
  });
  it("reports a domain that is no longer listed", async () => {
    vi.mocked(removeClientDomain).mockResolvedValue(false);
    expect(await removeClientDomainAction("cd_old")).toEqual({ ok: false, error: "That domain is no longer listed" });
    vi.mocked(setClientDomainPursuit).mockResolvedValue(null);
    expect(await linkClientDomainAction("cd_old", "p1")).toEqual({ ok: false, error: "That domain is no longer listed" });
  });
});
