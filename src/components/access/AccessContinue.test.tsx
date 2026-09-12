import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccessContinue } from "./AccessContinue";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), user: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), replace: vi.fn(), params: vi.fn() }));
vi.mock("@clerk/nextjs", () => ({ useAuth: mocks.auth, useUser: mocks.user, useClerk: () => ({ signOut: mocks.signOut }) }));
vi.mock("@clerk/nextjs/legacy", () => ({ useSignIn: mocks.signIn }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }), useSearchParams: mocks.params }));
function setup({ signedIn = false, ticket = "abc123", email = "jane@example.co.uk" }: { signedIn?: boolean; ticket?: string | null; email?: string } = {}) {
  mocks.auth.mockReturnValue({ isLoaded: true, isSignedIn: signedIn });
  mocks.user.mockReturnValue({ user: { primaryEmailAddress: { emailAddress: email } } });
  const create = vi.fn().mockResolvedValue({ status: "complete", createdSessionId: "session_1" });
  const setActive = vi.fn().mockResolvedValue(undefined);
  mocks.signIn.mockReturnValue({ isLoaded: true, signIn: { create }, setActive });
  mocks.signOut.mockImplementation(async callback => { await callback?.(); });
  mocks.params.mockReturnValue(new URLSearchParams(ticket ? { ticket, returnTo: "/client?receipt=recent" } : {}));
  window.history.replaceState(null, "", ticket ? `/access/continue?ticket=${ticket}` : "/access/continue");
  return { create, setActive };
}
beforeEach(() => vi.clearAllMocks());
describe("client ticket exchange", () => {
  it("exchanges a new ticket and resolves the authorised client destination", async () => {
    const { create, setActive } = setup(); render(<AccessContinue />);
    await waitFor(() => expect(setActive).toHaveBeenCalledWith({ session: "session_1" }));
    expect(create).toHaveBeenCalledWith({ strategy: "ticket", ticket: "abc123" });
    expect(mocks.replace).toHaveBeenCalledWith("/account?returnTo=%2Fclient%3Freceipt%3Drecent");
    expect(window.location.search).toBe("");
  });
  it.each(["staff@meritusvia.com", "other@different-company.co.uk"])("asks %s explicitly before switching accounts", async email => {
    const { create } = setup({ signedIn: true, email }); render(<AccessContinue />);
    expect(await screen.findByText(email)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled(); expect(mocks.replace).not.toHaveBeenCalled(); expect(mocks.signOut).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Keep current account" })).toHaveAttribute("href", "/account");
    await userEvent.click(screen.getByRole("button", { name: "Sign out and use this link" }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(mocks.signOut).toHaveBeenCalledWith(expect.any(Function));
    expect(mocks.signOut.mock.invocationCallOrder[0]).toBeLessThan(create.mock.invocationCallOrder[0]);
    expect(window.location.search).toBe("");
  });
  it("never silently reuses a signed-in account when the ticket is missing", async () => {
    const { create } = setup({ signedIn: true, ticket: null }); render(<AccessContinue />);
    expect(await screen.findByText(/link is incomplete/i)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled(); expect(mocks.replace).not.toHaveBeenCalled();
  });
  it.each([
    ["sign_in_token_expired", /link has expired/i],
    ["sign_in_token_already_used", /already been used/i],
    ["sign_in_token_invalid", /link is not valid/i],
    ["sign_in_token_revoked_code", /link has been withdrawn/i],
    ["sign_in_token_cannot_be_used_code", /link can no longer be used/i],
    ["sign_in_token_not_in_sign_in_code", /link can no longer be used/i],
    ["sign_in_token_already_used_code", /already been used/i],
  ])("provides distinct recovery for %s", async (code, copy) => {
    const { create } = setup(); create.mockRejectedValue({ errors: [{ code }] }); render(<AccessContinue />);
    expect(await screen.findByText(copy)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Request a new link" })).toHaveAttribute("href", "/access");
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });
  it("retries a provider outage without losing the captured ticket", async () => {
    const { create } = setup(); create.mockRejectedValueOnce(new Error("private provider details")); render(<AccessContinue />);
    expect(await screen.findByText(/could not verify your link/i)).toBeInTheDocument();
    expect(screen.queryByText(/private provider/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    expect(create.mock.calls[1][0].ticket).toBe("abc123");
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
  it("retries activation without spending a single-use ticket twice", async () => {
    const { create, setActive } = setup(); setActive.mockRejectedValueOnce(new Error("offline")); render(<AccessContinue />);
    await userEvent.click(await screen.findByRole("button", { name: "Retry" }));
    await waitFor(() => expect(setActive).toHaveBeenCalledTimes(2));
    expect(create).toHaveBeenCalledTimes(1);
  });
  it("prevents duplicate exchanges while a request is pending", async () => {
    const { create } = setup({ signedIn: true }); create.mockReturnValue(new Promise(() => {})); render(<AccessContinue />);
    await userEvent.dblClick(await screen.findByRole("button", { name: "Sign out and use this link" }));
    expect(create).toHaveBeenCalledTimes(1);
  });
});
