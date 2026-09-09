import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextActionField } from "./NextActionField";

describe("NextActionField", () => {
  it("shows the next action with its due date and opens the editor on click", async () => {
    render(<NextActionField text="Call Jane Partner" due="2026-09-11" onSave={vi.fn()} />);
    expect(screen.getByText("Call Jane Partner")).toBeInTheDocument();
    expect(screen.getByText("due Fri 11 Sep")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /next action/i }));
    const input = screen.getByLabelText("Next action");
    expect(input).toHaveValue("Call Jane Partner");
    expect(input).toHaveAttribute("maxlength", "140");
    expect(screen.getByLabelText("Due")).toHaveValue("2026-09-11");
  });

  it("shows a prompt when there is no next action and marks an overdue one", () => {
    const { rerender } = render(<NextActionField text={null} due={null} onSave={vi.fn()} />);
    expect(screen.getByText("Set a next action")).toBeInTheDocument();
    rerender(<NextActionField text="Chase the letter" due="2026-09-01" overdue onSave={vi.fn()} />);
    expect(screen.getByText("overdue")).toBeInTheDocument();
  });

  it("saves on Enter with the text and due date", async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    render(<NextActionField text={null} due={null} onSave={onSave} />);
    await userEvent.click(screen.getByRole("button", { name: /next action/i }));
    await userEvent.type(screen.getByLabelText("Next action"), "Send the fee proposal");
    await userEvent.type(screen.getByLabelText("Due"), "2026-09-12");
    await userEvent.type(screen.getByLabelText("Next action"), "{Enter}");
    expect(onSave).toHaveBeenCalledWith("Send the fee proposal", "2026-09-12");
    await waitFor(() => expect(screen.queryByLabelText("Next action")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /next action/i })).toBeInTheDocument();
  });

  it("saves when focus leaves the editor", async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    render(<NextActionField text="Call Jane" due={null} onSave={onSave} />);
    await userEvent.click(screen.getByRole("button", { name: /next action/i }));
    await userEvent.type(screen.getByLabelText("Next action"), " about the scope");
    await userEvent.click(document.body);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith("Call Jane about the scope", null));
  });

  it("cancels on Escape without saving", async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    render(<NextActionField text="Call Jane" due={null} onSave={onSave} />);
    await userEvent.click(screen.getByRole("button", { name: /next action/i }));
    await userEvent.type(screen.getByLabelText("Next action"), " later{Escape}");
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Next action")).not.toBeInTheDocument();
    expect(screen.getByText("Call Jane")).toBeInTheDocument();
  });

  it("keeps the editor open and shows the error when the save fails", async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: false, error: "Give the due date as a valid date" });
    render(<NextActionField text="Call Jane" due={null} onSave={onSave} />);
    await userEvent.click(screen.getByRole("button", { name: /next action/i }));
    await userEvent.type(screen.getByLabelText("Next action"), " today{Enter}");
    expect(await screen.findByText("Give the due date as a valid date")).toBeInTheDocument();
    expect(screen.getByLabelText("Next action")).toHaveValue("Call Jane today");
  });

  it("closes without saving when nothing has changed", async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    render(<NextActionField text="Call Jane" due={null} onSave={onSave} />);
    await userEvent.click(screen.getByRole("button", { name: /next action/i }));
    await userEvent.type(screen.getByLabelText("Next action"), "{Enter}");
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Next action")).not.toBeInTheDocument();
  });
});
