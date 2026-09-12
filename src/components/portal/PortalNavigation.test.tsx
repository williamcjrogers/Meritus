import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PortalNavigation } from "./PortalNavigation";

const pathnameMock = vi.fn();

vi.mock("next/navigation", () => ({ usePathname: () => pathnameMock() }));
vi.mock("next/link", () => ({
  default: ({ children, onClick, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      {...props}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    >
      {children}
    </a>
  ),
}));

beforeEach(() => {
  pathnameMock.mockReturnValue("/portal");
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.setAttribute("open", ""); });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) { this.removeAttribute("open"); });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 0; });
});

describe("PortalNavigation", () => {
  it("offers Intelligence in the Work group and selects its nested pages", () => {
    pathnameMock.mockReturnValue("/portal/intelligence/sources");
    render(<PortalNavigation />);
    const intelligence = screen.getByRole("link", { name: "Intelligence" });
    expect(intelligence).toHaveAttribute("href", "/portal/intelligence");
    expect(intelligence).toHaveAttribute("aria-current", "page");
    expect(intelligence.closest(".workspace-nav-group")).toHaveTextContent("Work");
  });

  it("selects only Home at the portal root", () => {
    render(<PortalNavigation />);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Pursuits" })).not.toHaveAttribute("aria-current");
  });

  it.each(["/portal/pursuits", "/portal/pursuits/p1"])("selects Pursuits at %s", (path) => {
    pathnameMock.mockReturnValue(path);
    render(<PortalNavigation />);
    expect(screen.getByRole("link", { name: "Pursuits" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });

  it("opens the mobile menu and closes it after a selection", async () => {
    render(<PortalNavigation />);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    const dialog = screen.getByRole("dialog", { name: "Navigation" });
    await userEvent.click(within(dialog).getByRole("link", { name: "Pursuits" }));
    expect(dialog).not.toHaveAttribute("open");
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    render(<PortalNavigation />);
    const trigger = screen.getByRole("button", { name: "Menu" });
    await userEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Navigation" });
    within(dialog).getByRole("button", { name: "Close" }).focus();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(dialog).not.toHaveAttribute("open"));
    expect(trigger).toHaveFocus();
  });
});
