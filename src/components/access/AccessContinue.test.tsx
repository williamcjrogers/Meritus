import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "@clerk/nextjs";
import { useSignIn } from "@clerk/nextjs/legacy";
import { useRouter, useSearchParams } from "next/navigation";
import { AccessContinue } from "./AccessContinue";

vi.mock("@clerk/nextjs", () => ({ useAuth: vi.fn() }));
vi.mock("@clerk/nextjs/legacy", () => ({ useSignIn: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: vi.fn(), useSearchParams: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseSignIn = vi.mocked(useSignIn);
const mockedUseRouter = vi.mocked(useRouter);
const mockedUseSearchParams = vi.mocked(useSearchParams);

const replace = vi.fn();

function setup({
  isSignedIn = false,
  ticket = null,
  create = vi.fn(),
  setActive = vi.fn(),
}: {
  isSignedIn?: boolean;
  ticket?: string | null;
  create?: ReturnType<typeof vi.fn>;
  setActive?: ReturnType<typeof vi.fn>;
} = {}) {
  mockedUseAuth.mockReturnValue({ isSignedIn } as unknown as ReturnType<typeof useAuth>);
  mockedUseSignIn.mockReturnValue({
    isLoaded: true,
    signIn: { create },
    setActive,
  } as unknown as ReturnType<typeof useSignIn>);
  mockedUseRouter.mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);
  const params = new URLSearchParams();
  if (ticket) params.set("ticket", ticket);
  mockedUseSearchParams.mockReturnValue(params as unknown as ReturnType<typeof useSearchParams>);
  return { create, setActive };
}

beforeEach(() => {
  replace.mockReset();
});

describe("AccessContinue", () => {
  it("sends an already signed-in visitor straight to the client desk", async () => {
    const { create } = setup({ isSignedIn: true });
    render(<AccessContinue />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/client"));
    expect(create).not.toHaveBeenCalled();
  });

  it("shows a way back in when the link has no ticket", async () => {
    setup({ isSignedIn: false, ticket: null });
    render(<AccessContinue />);
    expect(await screen.findByText(/missing its ticket/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /request a new link/i })).toHaveAttribute("href", "/access");
  });

  it("exchanges a valid ticket for a session and moves on", async () => {
    const create = vi.fn().mockResolvedValue({ status: "complete", createdSessionId: "sess_1" });
    const setActive = vi.fn().mockResolvedValue(undefined);
    setup({ isSignedIn: false, ticket: "abc123", create, setActive });
    render(<AccessContinue />);
    await waitFor(() => expect(setActive).toHaveBeenCalledWith({ session: "sess_1" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/client"));
  });

  it("shows the expired copy when the exchange fails", async () => {
    const create = vi.fn().mockRejectedValue(new Error("ticket already used"));
    setup({ isSignedIn: false, ticket: "abc123", create });
    render(<AccessContinue />);
    expect(await screen.findByText(/expired or was already used/i)).toBeInTheDocument();
  });
});
