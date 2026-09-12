import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionEditor } from "./ActionEditor";
import { viewFixture, directoryFixture } from "@/lib/actions/view-fixture.test-support";
const mocks = vi.hoisted(() => ({ save: vi.fn(), history: vi.fn(), refresh: vi.fn(), detach: vi.fn(), primary: vi.fn() }));
vi.mock("@/lib/actions/server", () => ({ saveDeskAction: mocks.save, loadDeskActionHistory: mocks.history, detachDeskAction: mocks.detach, selectPrimaryAction: mocks.primary }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
beforeEach(() => { vi.clearAllMocks(); mocks.history.mockResolvedValue([]); HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); }; HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); }; });
afterEach(cleanup);
function editor(action = viewFixture()) { return render(<ActionEditor action={action} link={action.link} directory={directoryFixture} onClose={vi.fn()} onSaved={vi.fn()} />); }
describe("ActionEditor", () => {
  it("keeps drafts on conflict and only applies against a reviewed version", async () => { const user = userEvent.setup(); mocks.save.mockResolvedValueOnce({ ok: false, code: "conflict", error: "Another director updated this action", current: viewFixture({ version: 3 }) }).mockResolvedValue({ ok: true, action: viewFixture({ version: 4 }) }); editor(); await user.clear(screen.getByLabelText("Action")); await user.type(screen.getByLabelText("Action"), "Call Matt about the revised scope"); await user.click(screen.getByRole("button", { name: "Save action" })); expect(screen.getByLabelText("Action")).toHaveValue("Call Matt about the revised scope"); expect(screen.getByRole("alert")).toHaveTextContent("Another director updated"); expect(screen.queryByRole("button", { name: "Apply my changes" })).not.toBeInTheDocument(); await user.click(screen.getByRole("button", { name: "Review current record" })); await user.click(screen.getByRole("button", { name: "Apply my changes" })); expect(mocks.save.mock.calls[1][0].expectedVersion).toBe(3); expect(mocks.save.mock.calls[1][0].requestId).not.toBe(mocks.save.mock.calls[0][0].requestId); });
  it("retains request identity on an uncertain save and changes it after an edit", async () => { const user = userEvent.setup(); mocks.save.mockRejectedValue(new Error("timeout")); editor(); await user.click(screen.getByRole("button", { name: "Save action" })); await user.click(screen.getByRole("button", { name: "Save action" })); expect(mocks.save.mock.calls[0][0].requestId).toBe(mocks.save.mock.calls[1][0].requestId); await user.type(screen.getByLabelText("Action"), " revised"); await user.click(screen.getByRole("button", { name: "Save action" })); expect(mocks.save.mock.calls[2][0].requestId).not.toBe(mocks.save.mock.calls[1][0].requestId); expect(screen.getByLabelText("Action")).toHaveValue("Prepare client update revised"); });
  it("requires an explicit unassigned save", async () => { const user = userEvent.setup(); mocks.save.mockResolvedValue({ ok: true, action: viewFixture() }); editor(viewFixture({ ownerId: null, dueDate: null })); await user.click(screen.getByRole("button", { name: "Save action" })); expect(mocks.save).not.toHaveBeenCalled(); await user.click(screen.getByRole("button", { name: "Save as unassigned" })); expect(mocks.save.mock.calls[0][0].draft.saveUnassigned).toBe(true); });
  it("requires a deadline change reason", async () => { const user = userEvent.setup(); editor(); fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-09-18" } }); await user.click(screen.getByRole("button", { name: "Save action" })); expect(screen.getByRole("alert")).toHaveTextContent("Explain why"); expect(mocks.save).not.toHaveBeenCalled(); });
  it("retains unresolved owners and disables unavailable directory assignment", () => { render(<ActionEditor action={viewFixture({ ownerId: "unknown" })} link={{ kind: "general" }} directory={{ available: false, directors: [] }} onClose={vi.fn()} onSaved={vi.fn()} />); expect(screen.getByLabelText("Assignee")).toHaveValue("unknown"); expect(screen.getByLabelText("Assignee")).toBeDisabled(); expect(screen.getByRole("option", { name: "Assigned, name unavailable" })).toBeInTheDocument(); });
  it("reopens closed records before permitting edits", async () => { const user = userEvent.setup(); mocks.save.mockResolvedValue({ ok: true, action: viewFixture({ version: 2, state: "todo" }) }); editor(viewFixture({ state: "completed", completedAt: "2026-09-12T10:00:00Z", completedBy: "director-1" })); expect(screen.queryByLabelText("Action")).not.toBeInTheDocument(); await user.click(screen.getByRole("button", { name: "Reopen action" })); await waitFor(() => expect(screen.getByLabelText("Action")).toBeVisible()); expect(mocks.save.mock.calls[0][0].draft.state).toBe("todo"); });
  it("restores focus to the opening control on close", () => { const trigger = document.createElement("button"); document.body.append(trigger); trigger.focus(); const view = editor(); view.unmount(); expect(document.activeElement).toBe(trigger); trigger.remove(); });
  it.each(["primary", "detach"] as const)("retries the reviewed %s operation without overwriting concurrent edits", async kind => {
    const user = userEvent.setup();
    const original = viewFixture({ link: { kind: "pursuit", id: "lead-1" } });
    const current = viewFixture({ ...original, version: 3, title: "Concurrent director's revised commitment", description: "Keep the concurrent description", state: kind === "detach" ? "completed" : "todo" });
    const mutation = mocks[kind];
    const committed = new Map<string, typeof current>();
    let writes = 0;
    mutation.mockResolvedValueOnce({ ok: false, code: "conflict", error: "Another director updated this action", current });
    mutation.mockImplementation(async (_id: string, _version: number, requestId: string) => {
      if (committed.has(requestId)) return { ok: true, action: committed.get(requestId) };
      writes += 1;
      committed.set(requestId, { ...current, version: 4 });
      throw new Error("Response lost after commit");
    });
    editor(original);
    await user.type(screen.getByLabelText("Action"), " unsaved draft");
    if (kind === "primary") await user.click(screen.getByRole("button", { name: "Make next action" }));
    else { await user.click(screen.getByRole("button", { name: "Retain as standalone" })); await user.click(screen.getByRole("button", { name: "Confirm retain as standalone" })); }
    await user.click(screen.getByRole("button", { name: "Review current record" }));
    expect(screen.getByText(current.title)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Apply my changes" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Could not update");
    await user.click(screen.getByRole("button", { name: "Apply my changes" }));
    expect(mutation.mock.calls[1][1]).toBe(3);
    expect(mutation.mock.calls[1]).toHaveLength(3);
    expect(mutation.mock.calls[2]).toEqual(mutation.mock.calls[1]);
    expect(mutation.mock.calls[1][2]).not.toBe(mutation.mock.calls[0][2]);
    expect(writes).toBe(1);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Action")).toHaveValue(`${original.title} unsaved draft`);
  });
  it("reuses a reviewed save request after a committed write loses its response", async () => {
    const user = userEvent.setup();
    const current = viewFixture({ version: 3 });
    const committed = new Map<string, ReturnType<typeof viewFixture>>();
    let writes = 0;
    mocks.save.mockResolvedValueOnce({ ok: false, code: "conflict", error: "Concurrent update", current });
    mocks.save.mockImplementation(async input => {
      if (committed.has(input.requestId)) return { ok: true, action: committed.get(input.requestId) };
      writes += 1;
      committed.set(input.requestId, viewFixture({ version: 4, title: input.draft.title }));
      throw new Error("Response lost after commit");
    });
    editor();
    await user.type(screen.getByLabelText("Action"), " revised");
    await user.click(screen.getByRole("button", { name: "Save action" }));
    await user.click(screen.getByRole("button", { name: "Review current record" }));
    await user.click(screen.getByRole("button", { name: "Apply my changes" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Your changes have been kept");
    await user.click(screen.getByRole("button", { name: "Apply my changes" }));
    expect(mocks.save.mock.calls[1][0].expectedVersion).toBe(3);
    expect(mocks.save.mock.calls[2][0]).toEqual(mocks.save.mock.calls[1][0]);
    expect(writes).toBe(1);
  });

});
