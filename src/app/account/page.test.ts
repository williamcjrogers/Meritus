// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const identity = vi.hoisted(() => vi.fn());
vi.mock("@/lib/portal/auth", () => ({ requirePageIdentity: identity }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
import AccountPage from "./page";
beforeEach(() => vi.resetAllMocks());
it.each([
  ["client", "/portal/research", "/client"],
  ["director", "/portal/actions?scope=mine", "/portal/actions?scope=mine"],
  [null, "/portal", "/access/denied"],
  ["client", "https://example.com", "/client"],
])("resolves role %s to its own authorised experience", async (role, returnTo, expected) => {
  identity.mockResolvedValue({ role });
  await expect(AccountPage({ searchParams: Promise.resolve({ returnTo }) })).rejects.toThrow(`redirect:${expected}`);
});
