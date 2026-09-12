import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), signOut: vi.fn() }));
vi.mock("@clerk/nextjs", () => ({
  useAuth: mocks.auth,
  useUser: () => ({ user: { primaryEmailAddress: { emailAddress: "existing@example.co.uk" } } }),
  useClerk: () => ({ signOut: mocks.signOut }),
  SignUp: () => <div>Provider invitation form</div>,
}));
import { InvitationAcceptance } from "./InvitationAcceptance";
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockReturnValue({ isLoaded: true, isSignedIn: true }); });
it("keeps an existing account explicit before accepting an invitation", async () => {
  render(<InvitationAcceptance />);
  expect(screen.getByText("existing@example.co.uk")).toBeInTheDocument();
  expect(screen.queryByText("Provider invitation form")).not.toBeInTheDocument();
  expect(mocks.signOut).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Sign out and accept invitation" }));
  expect(mocks.signOut).toHaveBeenCalledWith(expect.any(Function));
});
it("renders the provider invitation flow for a signed-out visitor", () => {
  mocks.auth.mockReturnValue({ isLoaded: true, isSignedIn: false });
  render(<InvitationAcceptance />); expect(screen.getByText("Provider invitation form")).toBeInTheDocument();
});
it("retains an account choice if sign-out fails", async () => {
  mocks.signOut.mockRejectedValueOnce(new Error("private details")); render(<InvitationAcceptance />);
  await userEvent.click(screen.getByRole("button", { name: "Sign out and accept invitation" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("We could not sign out. Please try again.");
});
