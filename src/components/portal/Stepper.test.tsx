import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Stepper } from "./Stepper";

describe("Stepper", () => {
  it("lists the four active stages in order and marks the current one", () => {
    render(<Stepper current="scoping" onMove={vi.fn()} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Move to Enquiry",
      "Scoping, current stage",
      "Move to Proposal",
      "Move to Instructed",
    ]);
    expect(buttons[1]).toHaveAttribute("aria-current", "step");
    expect(buttons[0]).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("list", { name: "Stage" })).toBeInTheDocument();
  });

  it("commits a move on click", async () => {
    const onMove = vi.fn().mockResolvedValue({ ok: true });
    render(<Stepper current="enquiry" onMove={onMove} />);
    await userEvent.click(screen.getByRole("button", { name: "Move to Proposal" }));
    expect(onMove).toHaveBeenCalledWith("proposal");
  });

  it("moves focus with the arrow keys without committing, and commits on Space", async () => {
    const onMove = vi.fn().mockResolvedValue({ ok: true });
    render(<Stepper current="enquiry" onMove={onMove} />);
    const scoping = screen.getByRole("button", { name: "Move to Scoping" });
    scoping.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onMove).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Move to Proposal" })).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(scoping).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith("scoping");
  });

  it("commits on Enter", async () => {
    const onMove = vi.fn().mockResolvedValue({ ok: true });
    render(<Stepper current="enquiry" onMove={onMove} />);
    screen.getByRole("button", { name: "Move to Instructed" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(onMove).toHaveBeenCalledWith("instructed");
  });

  it("shows the action's error beneath the steps", async () => {
    const onMove = vi.fn().mockResolvedValue({ ok: false, error: "This pursuit no longer exists" });
    render(<Stepper current="enquiry" onMove={onMove} />);
    await userEvent.click(screen.getByRole("button", { name: "Move to Scoping" }));
    expect(await screen.findByText("This pursuit no longer exists")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Move to Scoping" })).toBeEnabled());
  });
});
