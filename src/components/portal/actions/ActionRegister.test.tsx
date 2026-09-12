import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ActionRow } from "./ActionRow";
import { ActionRegister } from "./ActionRegister";
import { directoryFixture, viewFixture } from "@/lib/actions/view-fixture.test-support";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/actions/server", () => ({ saveDeskAction: vi.fn(), loadDeskActionHistory: vi.fn().mockResolvedValue([]), completeDeskAction: vi.fn(), detachDeskAction: vi.fn(), selectPrimaryAction: vi.fn() }));
afterEach(cleanup);
it("shows assignee separately from related work", () => { render(<ul><ActionRow action={viewFixture()} onEdit={vi.fn()} onComplete={vi.fn()} /></ul>); expect(screen.getByText("Mateo Diaz")).toBeVisible(); expect(screen.getByText("Kubik Construction")).toBeVisible(); });
it("retains failed completion inline and retries the same request", async () => { const user = userEvent.setup(); const complete = vi.fn().mockResolvedValue({ ok: false, code: "unavailable", error: "Try again" }); render(<ul><ActionRow action={viewFixture()} onEdit={vi.fn()} onComplete={complete} /></ul>); await user.click(screen.getByRole("button", { name: "Complete action: Prepare client update" })); expect(screen.getByRole("alert")).toHaveTextContent("Try again"); expect(screen.getByText("Prepare client update")).toBeVisible(); await user.click(screen.getByRole("button", { name: "Complete action: Prepare client update" })); expect(complete.mock.calls[0][1]).toBe(complete.mock.calls[1][1]); });
it("uses the independent total and retains filters in pagination", () => { render(<ActionRegister rows={[viewFixture()]} total={123} query={{ scope: "team", filter: "overdue", ownerId: "director-1", page: 2, pageSize: 50 }} directory={directoryFixture} now="2026-09-12T10:00:00Z" />); expect(screen.getByText("123 actions in this view")).toBeVisible(); expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute("href", "/portal/actions?scope=team&filter=overdue&owner=director-1&page=3"); expect(screen.getByRole("link", { name: "Previous page" })).toHaveAttribute("href", "/portal/actions?scope=team&filter=overdue&owner=director-1"); expect(screen.getByRole("link", { name: "Due today" })).toHaveAttribute("href", "/portal/actions?scope=team&filter=today&owner=director-1"); });
it("opens a directly requested completed action outside the default open list", async () => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  render(<ActionRegister rows={[]} total={0} query={{ scope: "team", filter: "open", page: 1, pageSize: 50 }} directory={directoryFixture} now="2026-09-12T10:00:00Z" initialAction={viewFixture({ title: "Completed commitment on another page", state: "completed" })} />);
  expect(screen.getByText("Completed commitment on another page")).toBeVisible();
  expect(screen.getByRole("button", { name: "Reopen action" })).toBeVisible();
  expect(screen.getByText("0 actions in this view")).toBeVisible();
  expect(await screen.findByText("No history recorded.")).toBeVisible();
});
it("reports an unavailable direct action without inventing content", () => {
  render(<ActionRegister rows={[]} total={0} query={{ scope: "team", filter: "open", page: 1, pageSize: 50 }} directory={directoryFixture} now="2026-09-12T10:00:00Z" initialActionError="Could not open this action. It may be unavailable or you may not have access." />);
  expect(screen.getByRole("alert")).toHaveTextContent("Could not open this action");
  expect(screen.queryByRole("button", { name: "Reopen action" })).not.toBeInTheDocument();
});
