import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AskDrawer } from "./AskDrawer";

vi.mock("@ai-sdk/react", () => ({ useChat: () => ({ messages: [{ id: "q1", role: "user", parts: [{ type: "text", text: "What does the evidence show?" }] }], sendMessage: vi.fn(), status: "ready", error: null, setMessages: vi.fn() }) }));
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.setAttribute("open", ""); });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) { this.removeAttribute("open"); });
  Element.prototype.scrollTo = vi.fn();
});
it("settles a rejected clear and leaves the thread and confirmation recoverable", async () => {
  const clear = vi.fn().mockRejectedValue(new Error("offline"));
  render(<AskDrawer pursuitId="p1" initialMessages={[]} open onClose={vi.fn()} onSaveNote={vi.fn()} onClear={clear} />);
  await userEvent.click(screen.getByRole("button", { name: "Clear" }));
  const dialog = screen.getByRole("dialog", { name: "Clear this thread?" });
  await userEvent.click(within(dialog).getByRole("button", { name: "Clear" }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("could not be cleared");
  expect(within(dialog).getByRole("button", { name: "Clear" })).toBeEnabled();
  expect(screen.getByText("What does the evidence show?")).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(dialog).not.toHaveAttribute("open");
});
