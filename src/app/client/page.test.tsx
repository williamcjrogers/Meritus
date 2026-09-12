import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ identity: vi.fn(), domain: vi.fn(), files: vi.fn() }));
vi.mock("@/lib/portal/auth", () => ({ requirePageIdentity: mocks.identity }));
vi.mock("@/lib/db/client-domains", () => ({ findActiveClientDomain: mocks.domain }));
vi.mock("@/lib/db/documents", () => ({ listClientDocuments: mocks.files }));
vi.mock("@/lib/env", () => ({ isDatabaseConfigured: () => true, isStorageConfigured: () => true }));
vi.mock("@clerk/nextjs", () => ({ SignOutButton: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); }, useRouter: () => ({ refresh: vi.fn() }) }));
import ClientPage from "./page";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.identity.mockResolvedValue({ userId: "u1", role: "client", domain: "example.co.uk", email: "jane@example.co.uk" });
  mocks.domain.mockResolvedValue({ id: "d1", firm: "Example Construction" }); mocks.files.mockResolvedValue([]);
});
it("checks current identity directly before company data and describes existing sharing", async () => {
  render(await ClientPage());
  expect(mocks.identity).toHaveBeenCalledWith("/client"); expect(mocks.domain).toHaveBeenCalledWith("example.co.uk"); expect(mocks.files).toHaveBeenCalledWith("d1");
  expect(screen.getByText("jane@example.co.uk")).toBeInTheDocument();
  expect(screen.getByText(/colleagues with access for your organisation can see the submission details/i)).toBeInTheDocument();
});
it("sends staff directly to internal client documents without loading a company", async () => {
  mocks.identity.mockResolvedValue({ role: "director" });
  await expect(ClientPage()).rejects.toThrow("redirect:/portal/clients"); expect(mocks.domain).not.toHaveBeenCalled();
});
it.each([{ role: null, domain: "example.co.uk" }, { role: "client", domain: null }])("denies an unentitled identity before accessing company data", async identity => {
  mocks.identity.mockResolvedValue(identity); await expect(ClientPage()).rejects.toThrow("redirect:/access/denied"); expect(mocks.domain).not.toHaveBeenCalled();
});
it("distinguishes removed organisation access from an empty receipt list", async () => {
  mocks.domain.mockResolvedValue(null); render(await ClientPage());
  expect(screen.getByRole("heading", { name: /access has ended/ })).toBeInTheDocument(); expect(mocks.files).not.toHaveBeenCalled();
});
it("does not load data after an identity-provider failure", async () => {
  mocks.identity.mockRejectedValue(new Error("redirect:/access/unavailable"));
  await expect(ClientPage()).rejects.toThrow("redirect:/access/unavailable"); expect(mocks.domain).not.toHaveBeenCalled();
});
