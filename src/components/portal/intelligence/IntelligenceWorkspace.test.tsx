import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { IntelligenceWorkspace } from "./IntelligenceWorkspace";

describe("Intelligence workspace", () => {
  it("explains the missing service connection without displaying a pretend desk", () => {
    render(<IntelligenceWorkspace configured={false} />);
    expect(screen.getByRole("heading", { name: "Intelligence", level: 1 })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("The analyst desk is not connected yet");
    expect(screen.queryByTitle("Meritus Intelligence analyst desk")).not.toBeInTheDocument();
  });
  it("embeds only a same-origin route and explains partial coverage", async () => {
    render(<IntelligenceWorkspace configured />);
    const frame = screen.getByTitle("Meritus Intelligence analyst desk");
    expect(frame).toHaveAttribute("src", "/api/portal/intelligence/desk/");
    expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(screen.getByText(/Collection is partial/)).toBeVisible();
    const fullScreen = screen.getByRole("link", { name: "Open full screen in a new tab" });
    expect(fullScreen).toHaveAttribute("href", "/api/portal/intelligence/desk/");
    expect(fullScreen).toHaveAttribute("rel", "noopener noreferrer");
    await userEvent.click(screen.getByRole("button", { name: "Refresh desk" }));
    expect(screen.getByTitle("Meritus Intelligence analyst desk")).not.toBe(frame);
  });
});
