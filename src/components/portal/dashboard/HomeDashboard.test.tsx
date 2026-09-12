import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dashboardFixture } from "@/lib/dashboard/fixtures.test-support";
import { HomeDashboard } from "./HomeDashboard";

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn(), complete: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }) }));
vi.mock("@/lib/actions/server", () => ({ completeDeskAction: mocks.complete }));
vi.mock("@/components/portal/actions/ActionEditor", () => ({ ActionEditor: ({ link }: { link: { kind: string } }) => <div role="dialog">New {link.kind} action</div> }));
vi.mock("@/components/portal/actions/ActionRow", () => ({ ActionRow: ({ action }: { action: { title: string } }) => <li>{action.title}</li> }));

describe("Home dashboard", () => {
  beforeEach(() => { vi.clearAllMocks(); window.history.replaceState({}, "", "/portal"); });
  it("prioritises real commitments and links complete counts to their filters", () => {
    render(<HomeDashboard view={dashboardFixture()} />);
    expect(screen.getByRole("heading", { name: "Home", level: 1 })).toBeVisible();
    expect(screen.getByText("Call Matt Bruce about the curtain wall scope")).toBeVisible();
    expect(screen.getByText(/L&Q needs a next action/)).toBeVisible();
    expect(screen.getByRole("link", { name: "17 overdue actions" })).toHaveAttribute("href", "/portal/actions?scope=team&filter=overdue");
    expect(screen.getByRole("link", { name: "Open live leads" })).toHaveAttribute("href", "/portal/pursuits");
    expect(screen.getByRole("link", { name: "0 dormant" })).toHaveAttribute("href", "/portal/pursuits?stage=dormant");
  });
  it("keeps accountability team-wide while personal links remain personal", () => {
    render(<HomeDashboard view={dashboardFixture({ scope: "mine" })} />);
    expect(screen.getByRole("heading", { name: "Team accountability" })).toBeVisible();
    expect(screen.getByRole("link", { name: /Team-wide unassigned actions/ })).toHaveAttribute("href", "/portal/actions?scope=team&filter=unassigned");
    expect(screen.getByRole("link", { name: "17 overdue actions" })).toHaveAttribute("href", "/portal/actions?scope=mine&filter=overdue");
    expect(screen.getByRole("link", { name: "William Rogers: 17 overdue actions" })).toHaveAttribute("href", "/portal/actions?scope=team&filter=overdue&owner=director-1");
  });
  it("shows section failure and retries without manufacturing a successful zero", () => {
    render(<HomeDashboard view={dashboardFixture({ programmes: { ok: false, error: "Could not load programme analysis" } })} />);
    const section = screen.getByRole("region", { name: "Programme analysis" });
    expect(within(section).getByText("Could not load programme analysis")).toBeVisible();
    expect(within(section).queryByText(/analysed of/)).not.toBeInTheDocument();
    fireEvent.click(within(section).getByRole("button", { name: "Retry" }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(screen.getByText("Call Matt Bruce about the curtain wall scope")).toBeVisible();
  });
  it("offers a new action and persists an independent Home preference", () => {
    render(<HomeDashboard view={dashboardFixture()} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add action" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("New general action");
    fireEvent.click(screen.getByRole("button", { name: "My work" }));
    expect(mocks.push).toHaveBeenCalledWith("/portal?scope=mine");
    expect(document.cookie).toContain("home_scope=mine");
  });
  it("labels research dates separately and retains their qualification", () => {
    render(<HomeDashboard view={dashboardFixture({ agenda: { ok: true, data: { entries: [{ id: "date-1", date: "2026-09-14", title: "Recorded meeting date", kind: "research", href: "/portal/research/calendar", ownerName: null, qualification: "Source: meeting minutes. Date awaiting client confirmation." }], warnings: ["Lead review dates could not be loaded"] } } })} />);
    expect(screen.getByText("Reviewed research date")).toBeVisible();
    expect(screen.getByText("Lead review dates could not be loaded")).toBeVisible();
    fireEvent.click(screen.getByText("Source and assumptions"));
    expect(screen.getByText(/Source: meeting minutes/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Add action for this date" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("New calendar action");
  });
  it("describes an empty attention window without implying all work is complete", () => {
    const view = dashboardFixture();
    if (view.actions.ok) view.actions.data.rows = [];
    render(<HomeDashboard view={view} />);
    expect(screen.getByText("No dated actions require attention in this window.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Review 24 open actions" })).toBeVisible();
  });
});
