import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { pursuitFixture } from "@/lib/portal/live-lead-fixtures.test-support";
import { PursuitShell } from "./PursuitShell";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/lib/portal/actions", () => ({ addNote: vi.fn(), clearQuestions: vi.fn(), deletePursuit: vi.fn(), movePursuit: vi.fn(), reopenPursuit: vi.fn(), saveAnswerAsNote: vi.fn(), setCompanyNumber: vi.fn(), setOwner: vi.fn(), updatePursuit: vi.fn() }));
vi.mock("./AskDrawer", () => ({ AskDrawer: () => null }));
vi.mock("./BriefPanel", () => ({ BriefPanel: () => <section aria-label="Brief">Brief contents</section> }));
vi.mock("./ProgrammePanel", () => ({ ProgrammePanel: () => null }));
vi.mock("./actions/RelatedActions", () => ({ RelatedActions: () => <section aria-label="Related actions">Actions</section> }));
vi.mock("./FileList", () => ({ FileList: () => null }));

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.setAttribute("open", ""); });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) { this.removeAttribute("open"); });
});
function renderPursuit() {
  render(<PursuitShell pursuit={pursuitFixture()} directors={[]} userId="director" related={[]} latestChange={null} activity={[]} documents={[]} briefState={{ brief: null, latestRun: null }} questions={[]} programmes={[]} actions={[]} nextAction={null} directoryAvailable now="2026-09-12T10:00:00Z" />);
}
it("returns focus to More actions when its unmounted Edit details menu item opened the drawer", async () => {
  renderPursuit();
  const trigger = screen.getByRole("button", { name: "More actions" });
  await userEvent.click(trigger);
  await userEvent.click(screen.getByRole("menuitem", { name: "Edit details" }));
  const dialog = screen.getByRole("dialog", { name: "Edit details" });
  expect(screen.queryByRole("menuitem", { name: "Edit details" })).not.toBeInTheDocument();
  within(dialog).getByRole("button", { name: "Close" }).focus();
  fireEvent(dialog, new Event("cancel", { bubbles: true, cancelable: true }));
  await waitFor(() => expect(dialog).not.toHaveAttribute("open"));
  expect(trigger).toHaveFocus();
});
it("places the brief before related actions and exposes every pursuit section", () => {
  renderPursuit();
  const brief = screen.getByRole("region", { name: "Brief" });
  const actions = screen.getByRole("region", { name: "Related actions" });
  expect(brief.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  const navigation = screen.getByRole("navigation", { name: "Pursuit sections" });
  expect(within(navigation).getByRole("button", { name: "Questions" })).toBeInTheDocument();
  for (const label of ["Brief", "Documents", "Activity", "Actions"]) expect(within(navigation).getByRole("link", { name: label })).toBeInTheDocument();
});
it("settles a rejected delete and keeps the named confirmation available for retry or cancel", async () => {
  const { deletePursuit } = await import("@/lib/portal/actions");
  vi.mocked(deletePursuit).mockRejectedValue(new Error("offline"));
  renderPursuit();
  await userEvent.click(screen.getByRole("button", { name: "More actions" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Delete live lead" }));
  const dialog = screen.getByRole("dialog", { name: /^Delete / });
  await userEvent.click(within(dialog).getByRole("button", { name: "Delete live lead" }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("could not be deleted");
  expect(within(dialog).getByRole("button", { name: "Delete live lead" })).toBeEnabled();
  await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(dialog).not.toHaveAttribute("open");
  expect(screen.getByRole("button", { name: "More actions" })).toHaveFocus();
});
