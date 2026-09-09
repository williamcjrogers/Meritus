import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContactForm } from "./ContactForm";

const fetchMock = vi.fn();
const gtagMock = vi.fn();

async function fillRequired() {
  await userEvent.type(screen.getByLabelText("Name"), "Jane Partner");
  await userEvent.type(screen.getByLabelText("Firm"), "Brewster Bye Architects");
  await userEvent.type(screen.getByLabelText("Email"), "jane@bba.co.uk");
  await userEvent.selectOptions(screen.getByLabelText("Nature of dispute"), "Technical / defects dispute");
}

function submit() {
  return userEvent.click(screen.getByRole("button", { name: /request conflict check/i }));
}

describe("ContactForm", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    gtagMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("gtag", gtagMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the thank-you panel when the server accepts the enquiry", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    render(<ContactForm />);
    await fillRequired();
    await submit();
    expect(await screen.findByText(/thank you for your enquiry/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/contact");
    const sent = JSON.parse(init.body);
    expect(sent).toMatchObject({ name: "Jane Partner", firm: "Brewster Bye Architects", email: "jane@bba.co.uk" });
    expect(sent.company_website).toBe("");
  });

  it("fires the GA4 conversion event only on a 2xx and sends no personal data with it", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    render(<ContactForm />);
    await fillRequired();
    await submit();
    await screen.findByText(/thank you for your enquiry/i);
    expect(gtagMock).toHaveBeenCalledTimes(1);
    const [command, , params] = gtagMock.mock.calls[0];
    expect(command).toBe("event");
    expect(params).toEqual({ form: "conflict_check", dispute_nature: "Technical / defects dispute" });
  });

  it("does not fire the GA4 event when the server rejects the enquiry", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    render(<ContactForm />);
    await fillRequired();
    await submit();
    await screen.findByRole("alert");
    expect(gtagMock).not.toHaveBeenCalled();
  });

  it("explains the daily limit on a 429 and keeps the form", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429 });
    render(<ContactForm />);
    await fillRequired();
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You have sent several enquiries today. Please email enquiries@meritusvia.com."
    );
    expect(screen.queryByText(/thank you for your enquiry/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Jane Partner");
  });

  it("shows the could-not-send copy on a server error and keeps the typed values", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    render(<ContactForm />);
    await fillRequired();
    await userEvent.type(screen.getByLabelText("Brief summary"), "Curtain wall defects.");
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We could not send your enquiry. Please email enquiries@meritusvia.com."
    );
    expect(screen.getByLabelText("Name")).toHaveValue("Jane Partner");
    expect(screen.getByLabelText("Firm")).toHaveValue("Brewster Bye Architects");
    expect(screen.getByLabelText("Email")).toHaveValue("jane@bba.co.uk");
    expect(screen.getByLabelText("Brief summary")).toHaveValue("Curtain wall defects.");
  });

  it("shows the could-not-send copy when the request throws", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<ContactForm />);
    await fillRequired();
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not send your enquiry/i);
    expect(screen.getByLabelText("Name")).toHaveValue("Jane Partner");
  });

  it("does not submit until the required fields are filled", async () => {
    render(<ContactForm />);
    await submit();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getAllByText("Required").length).toBeGreaterThan(0);
  });

  it("renders an empty honeypot that is out of the tab order and hidden from assistive technology", () => {
    const { container } = render(<ContactForm />);
    const honeypot = container.querySelector('input[name="company_website"]');
    expect(honeypot).not.toBeNull();
    expect(honeypot).toHaveValue("");
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot).toHaveAttribute("aria-hidden", "true");
    expect(honeypot).toHaveAttribute("autocomplete", "off");
    expect(honeypot).toHaveAttribute("type", "text");
  });
});
