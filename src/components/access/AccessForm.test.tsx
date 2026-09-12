import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccessForm } from "./AccessForm";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("AccessForm", () => {
  it("posts the address and shows the generic confirmation", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<AccessForm />);
    await userEvent.type(screen.getByLabelText(/work email/i), "jane@example-firm.co.uk");
    await userEvent.click(screen.getByRole("button", { name: /send my link/i }));
    expect(await screen.findByText(/if that organisation has been given access/i)).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/access");
    expect(JSON.parse(init.body)).toEqual({ email: "jane@example-firm.co.uk", company_website: "" });
  });

  it("shows the server's error and keeps the address", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "Too many requests. Try again in an hour." }), { status: 429 }));
    render(<AccessForm />);
    await userEvent.type(screen.getByLabelText(/work email/i), "jane@example-firm.co.uk");
    await userEvent.click(screen.getByRole("button", { name: /send my link/i }));
    expect(await screen.findByText(/too many requests/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/work email/i)).toHaveValue("jane@example-firm.co.uk");
  });

  it("carries an empty honeypot the visitor cannot see", () => {
    render(<AccessForm />);
    const trap = document.querySelector('input[name="company_website"]') as HTMLInputElement;
    expect(trap).not.toBeNull();
    expect(trap.tabIndex).toBe(-1);
    expect(trap.value).toBe("");
  });
});
