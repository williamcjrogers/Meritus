import Link from "next/link";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Header } from "./Header";
vi.mock("next/navigation", () => ({ usePathname: () => "/services" }));
vi.mock("./HeaderAuth", () => ({
  HeaderAuth: () => <Link href="/sign-in">Staff sign in</Link>,
}));
vi.mock("./MobileAuth", () => ({
  MobileAuth: ({ onNavigate }: { onNavigate: () => void }) => (
    <Link href="/sign-in" onClick={onNavigate}>
      Staff sign in
    </Link>
  ),
}));

describe("public navigation", () => {
  it("offers client access separately from the staff session entry", () => {
    render(<Header />);
    expect(screen.getByRole("link", { name: "Client access" })).toHaveAttribute(
      "href",
      "/access",
    );
    expect(screen.getByRole("link", { name: "Staff sign in" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute(
      "href",
      "/contact",
    );
    expect(screen.getByRole("link", { name: "Expertise" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
  it("opens the mobile navigation at its first link and restores focus on Escape", async () => {
    const user = userEvent.setup();
    render(<Header />);
    const toggle = screen.getByRole("button", { name: "Menu" });
    await user.click(toggle);
    const mobile = screen.getByRole("navigation", {
      name: "Mobile navigation",
    });
    expect(
      within(mobile).getByRole("link", { name: "Expertise" }),
    ).toHaveFocus();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("navigation", { name: "Mobile navigation" }),
    ).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
  it("closes the mobile disclosure when a destination is chosen", async () => {
    const user = userEvent.setup();
    render(<Header />);
    await user.click(screen.getByRole("button", { name: "Menu" }));
    await user.click(
      within(
        screen.getByRole("navigation", { name: "Mobile navigation" }),
      ).getByRole("link", { name: "Contact" }),
    );
    expect(
      screen.queryByRole("navigation", { name: "Mobile navigation" }),
    ).not.toBeInTheDocument();
  });
  it("dismisses the non-modal disclosure when keyboard focus leaves the header", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Header />
        <button type="button">Next page action</button>
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Menu" }));
    const mobile = document.getElementById("public-mobile-navigation")!;
    within(mobile).getByRole("link", { name: "Staff sign in" }).focus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Next page action" }),
    ).toHaveFocus();
    expect(
      screen.queryByRole("navigation", { name: "Mobile navigation" }),
    ).not.toBeInTheDocument();
  });
});
