import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccessForm } from "./AccessForm";
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("AccessForm", () => {
  it("posts the address and shows the generic acknowledgement with that address", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<AccessForm />);
    await userEvent.type(screen.getByLabelText(/work email/i), "jane@example-firm.co.uk");
    await userEvent.click(screen.getByRole("button", { name: "Send me a link" }));
    expect(await screen.findByText(/if that organisation has been given access/i)).toBeInTheDocument();
    expect(screen.getByText("jane@example-firm.co.uk")).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: "jane@example-firm.co.uk", company_website: "" });
    expect(screen.getByRole("button", { name: /resend in 60s/i })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Change email" }));
    expect(screen.getByLabelText(/work email/i)).toHaveValue("jane@example-firm.co.uk");
    expect(screen.getByLabelText(/work email/i)).toHaveFocus();
  });
  it("validates locally and focuses the invalid field", async () => {
    render(<AccessForm />); await userEvent.click(screen.getByRole("button", { name: "Send me a link" }));
    expect(screen.getByLabelText(/work email/i)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/work email/i)).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter your work email address");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([429, 503])("keeps the address on a %s response", async status => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "private details" }), { status })); render(<AccessForm />);
    await userEvent.type(screen.getByLabelText(/work email/i), "jane@example-firm.co.uk");
    await userEvent.click(screen.getByRole("button", { name: "Send me a link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(status === 429 ? /too many requests/i : /could not request/i);
    expect(screen.getByLabelText(/work email/i)).toHaveValue("jane@example-firm.co.uk");
    expect(screen.queryByText("private details")).not.toBeInTheDocument();
  });
  it("allows resend only after 60 seconds", async () => {
    vi.useFakeTimers(); fetchMock.mockResolvedValue(new Response("{}", { status: 200 })); render(<AccessForm />);
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: "jane@example.co.uk" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Send me a link" })); });
    expect(screen.getByRole("button", { name: /Resend in/ })).toBeDisabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(screen.getByRole("button", { name: "Resend link" })).toBeEnabled();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Resend link" })); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("does not submit twice while pending", async () => {
    fetchMock.mockReturnValue(new Promise(() => {})); render(<AccessForm />);
    await userEvent.type(screen.getByLabelText(/work email/i), "jane@example.co.uk");
    await userEvent.dblClick(screen.getByRole("button", { name: "Send me a link" })); expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Send me a link" })).toHaveAttribute("aria-busy", "true");
  });
  it("carries an empty honeypot outside the keyboard sequence", () => {
    render(<AccessForm />); const trap = document.querySelector('input[name="company_website"]') as HTMLInputElement;
    expect(trap.tabIndex).toBe(-1); expect(trap.value).toBe("");
  });
});
