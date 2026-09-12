import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
import { Field, SearchField } from "./Field";
import { ToastProvider, useToast } from "./Toast";

describe("shared workspace controls", () => {
  it("prevents another submit while saving and preserves its accessible label", async () => {
    const submit = vi.fn();
    render(<Button type="submit" busy onClick={submit}>Save action</Button>);
    const button = screen.getByRole("button", { name: "Save action" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(submit).not.toHaveBeenCalled();
  });
  it("connects field errors and help to a real input label", () => {
    render(<Field label="Work email" help="Use your organisation email." error="Enter a valid email address." type="email" />);
    const input = screen.getByLabelText("Work email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Use your organisation email. Enter a valid email address.");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address.");
  });
  it("clears search and restores the input focus", async () => {
    const clear = vi.fn();
    render(<SearchField label="Companies" value="Example" onClear={clear} readOnly />);
    await userEvent.click(screen.getByRole("button", { name: "Clear companies" }));
    expect(clear).toHaveBeenCalledOnce();
    expect(screen.getByRole("searchbox")).toHaveFocus();
  });
  it("announces a deduplicated acknowledgement in the shared region", async () => {
    function Save() { const notify = useToast(); return <button onClick={() => notify("Action saved")}>Save</button>; }
    render(<ToastProvider><Save /></ToastProvider>);
    await userEvent.dblClick(screen.getByRole("button", { name: "Save" }));
    expect(screen.getAllByText("Action saved")).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(screen.queryByText("Action saved")).not.toBeInTheDocument();
  });
});
it("renders a primary navigation action as an anchor with the same semantic variant as a button", () => {
  render(<><Button href="/contact">Discuss your matter</Button><Button>Save changes</Button></>);
  const link = screen.getByRole("link", { name: "Discuss your matter" });
  expect(link).toHaveAttribute("href", "/contact");
  expect(link).toHaveClass("app-button", "app-button--primary", "app-button--brand");
  expect(screen.getByRole("button", { name: "Save changes" })).toHaveClass("app-button", "app-button--primary", "app-button--brand");
});
