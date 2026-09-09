import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MoveToMenu } from "./MoveToMenu";

describe("MoveToMenu", () => {
  it("lists the five other stages and moves at once for an active stage", async () => {
    const onMove = vi.fn().mockResolvedValue({ ok: true });
    render(<MoveToMenu current="enquiry" onMove={onMove} />);
    await userEvent.click(screen.getByRole("button", { name: /move to/i }));
    const items = screen.getAllByRole("menuitem");
    expect(items.map((item) => item.textContent?.replace(/reason/i, "").trim())).toEqual([
      "Scoping",
      "Proposal",
      "Instructed",
      "Declined",
      "Dormant",
    ]);
    await userEvent.click(screen.getByRole("menuitem", { name: /scoping/i }));
    expect(onMove).toHaveBeenCalledWith("scoping", undefined, undefined);
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("asks for a reason before declining and disables confirm under three characters", async () => {
    const onMove = vi.fn().mockResolvedValue({ ok: true });
    render(<MoveToMenu current="proposal" onMove={onMove} />);
    await userEvent.click(screen.getByRole("button", { name: /move to/i }));
    await userEvent.click(screen.getByRole("menuitem", { name: /declined/i }));
    const confirm = screen.getByRole("button", { name: /confirm/i });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Reason"), "No");
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Reason"), " budget");
    expect(confirm).toBeEnabled();
    expect(screen.queryByLabelText("Revisit date")).not.toBeInTheDocument();
    await userEvent.click(confirm);
    expect(onMove).toHaveBeenCalledWith("declined", "No budget", undefined);
  });

  it("offers a revisit date for dormant and passes it through", async () => {
    const onMove = vi.fn().mockResolvedValue({ ok: true });
    render(<MoveToMenu current="scoping" onMove={onMove} />);
    await userEvent.click(screen.getByRole("button", { name: /move to/i }));
    await userEvent.click(screen.getByRole("menuitem", { name: /dormant/i }));
    await userEvent.type(screen.getByLabelText("Reason"), "Awaiting adjudicator");
    fireEvent.change(screen.getByLabelText("Revisit date"), { target: { value: "2026-10-01" } });
    await userEvent.click(screen.getByRole("button", { name: /confirm/i }));
    expect(onMove).toHaveBeenCalledWith("dormant", "Awaiting adjudicator", "2026-10-01");
  });

  it("shows the action's error and stays open", async () => {
    const onMove = vi.fn().mockResolvedValue({ ok: false, error: "Already at Scoping" });
    render(<MoveToMenu current="enquiry" onMove={onMove} />);
    await userEvent.click(screen.getByRole("button", { name: /move to/i }));
    await userEvent.click(screen.getByRole("menuitem", { name: /scoping/i }));
    expect(await screen.findByText("Already at Scoping")).toBeInTheDocument();
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    render(<MoveToMenu current="enquiry" onMove={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: /move to/i });
    await userEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
