import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileList } from "./FileList";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.setAttribute("open", ""); });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) { this.removeAttribute("open"); });
});
it("requires a named confirmation before deletion and retains a failed delete for retry", async () => {
  const fetcher = vi.fn().mockRejectedValue(new Error("offline")); vi.stubGlobal("fetch", fetcher);
  render(<FileList uploadUrl="/api/portal/library" documents={[{ id: "f1", title: "Evidence.pdf", size: 1024, hasText: true, createdAt: new Date("2026-09-12") }]} />);
  await userEvent.click(screen.getByRole("button", { name: "Delete Evidence.pdf" }));
  expect(fetcher).not.toHaveBeenCalled();
  const dialog = screen.getByRole("dialog", { name: "Delete Evidence.pdf?" });
  await userEvent.click(within(dialog).getByRole("button", { name: "Delete file" }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("could not be deleted");
  expect(within(dialog).getByRole("button", { name: "Delete file" })).toBeEnabled();
});
it("settles failed uploads and makes retry guidance visible", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<FileList uploadUrl="/api/portal/library" documents={[]} />);
  const input = screen.getByLabelText("Upload file");
  fireEvent.change(input, { target: { files: [new File(["evidence"], "Evidence.txt", { type: "text/plain" })] } });
  expect(await screen.findByRole("alert")).toHaveTextContent("select the file again to retry");
  await waitFor(() => expect(input).toBeEnabled());
});
