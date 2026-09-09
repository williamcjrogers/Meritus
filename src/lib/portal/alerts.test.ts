// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EnquirySubmission } from "@/lib/db/schema";

const send = vi.hoisted(() => vi.fn());

vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

import { ALERT_TIMEOUT_MS, sendEnquiryAlert, type AlertInput } from "./alerts";

const RECEIVED = new Date("2026-09-09T13:02:00Z");

const base: AlertInput = {
  firm: "Brewster Bye Architects",
  disputeNature: "Technical / defects dispute",
  approximateValue: "£1m – £5m",
  forum: "Litigation",
  receivedAt: RECEIVED,
  pursuitUrl: "https://meritusvia.com/portal/pursuits/p1",
  related: false,
};

const submission: EnquirySubmission = {
  name: "Jane Partner",
  firm: "Brewster Bye Architects",
  email: "jane@bba.co.uk",
  disputeNature: "Technical / defects dispute",
  approximateValue: "£1m – £5m",
  forum: "Litigation",
  description: "Curtain wall defects.",
  receivedAt: RECEIVED.toISOString(),
};

const recipients = ["wr@meritusvia.com", "md@meritusvia.com"];

describe("sendEnquiryAlert", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("ENQUIRY_ALERT_FROM", "");
    send.mockReset();
    send.mockResolvedValue({ data: { id: "email_1" }, error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("is skipped when Resend is not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const outcome = await sendEnquiryAlert(base, recipients);
    expect(outcome).toEqual({ skipped: "not_configured" });
    expect(send).not.toHaveBeenCalled();
  });

  it("sends one plain-text email to every director with the facts and the link, and nothing personal", async () => {
    const outcome = await sendEnquiryAlert(base, recipients);
    expect(outcome).toMatchObject({ recipients: 2 });
    expect("sentAt" in outcome && typeof outcome.sentAt === "string").toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    const [payload, options] = send.mock.calls[0];
    expect(payload.from).toBe("enquiries@meritusvia.com");
    expect(payload.to).toEqual(recipients);
    expect(payload.subject).toBe("New enquiry: Brewster Bye Architects");
    expect(payload.replyTo).toBeUndefined();
    expect(payload.html).toBeUndefined();
    expect(payload.text).toContain("Brewster Bye Architects");
    expect(payload.text).toContain("Technical / defects dispute");
    expect(payload.text).toContain("£1m – £5m");
    expect(payload.text).toContain("Litigation");
    expect(payload.text).toContain("09 Sep 14:02");
    expect(payload.text).toContain("https://meritusvia.com/portal/pursuits/p1");
    expect(payload.text).not.toContain("Jane");
    expect(payload.text).not.toContain("jane@bba.co.uk");
    expect(payload.text).not.toContain("Curtain wall");
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("uses ENQUIRY_ALERT_FROM when it is set", async () => {
    vi.stubEnv("ENQUIRY_ALERT_FROM", "desk@meritusvia.com");
    await sendEnquiryAlert(base, recipients);
    expect(send.mock.calls[0][0].from).toBe("desk@meritusvia.com");
  });

  it("marks a further enquiry in the subject when related pursuits exist", async () => {
    await sendEnquiryAlert({ ...base, related: true }, recipients);
    expect(send.mock.calls[0][0].subject).toBe("Further enquiry: Brewster Bye Architects");
  });

  it("sanitises the firm in the subject", async () => {
    await sendEnquiryAlert({ ...base, firm: "Brewster\r\nBye  Architects" }, recipients);
    expect(send.mock.calls[0][0].subject).toBe("New enquiry: Brewster Bye Architects");
  });

  it("carries the whole submission with the NOT SAVED prefix when the store failed", async () => {
    await sendEnquiryAlert({ ...base, pursuitUrl: null, notSaved: submission }, recipients);
    const payload = send.mock.calls[0][0];
    expect(payload.subject).toContain("NOT SAVED");
    expect(payload.text).toContain("NOT SAVED: create this pursuit by hand");
    expect(payload.text).toContain("Jane Partner");
    expect(payload.text).toContain("jane@bba.co.uk");
    expect(payload.text).toContain("Curtain wall defects.");
    expect(payload.text).not.toContain("https://meritusvia.com/portal/pursuits");
  });

  it("returns the Resend error rather than throwing", async () => {
    send.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "The from address is not verified", statusCode: 403 },
    });
    const outcome = await sendEnquiryAlert(base, recipients);
    expect(outcome).toEqual({ error: "validation_error: The from address is not verified" });
  });

  it("returns an error when the client throws", async () => {
    send.mockRejectedValue(new Error("socket hang up"));
    const outcome = await sendEnquiryAlert(base, recipients);
    expect(outcome).toEqual({ error: "socket hang up" });
  });

  it("returns an error when there is nobody to send to", async () => {
    const outcome = await sendEnquiryAlert(base, []);
    expect(outcome).toMatchObject({ error: expect.stringMatching(/recipients/i) });
    expect(send).not.toHaveBeenCalled();
  });

  it("gives up after the timeout", async () => {
    vi.useFakeTimers();
    send.mockReturnValue(new Promise(() => {}));
    const pending = sendEnquiryAlert(base, recipients);
    await vi.advanceTimersByTimeAsync(ALERT_TIMEOUT_MS + 1);
    const outcome = await pending;
    expect(outcome).toMatchObject({ error: expect.stringMatching(/timed out/i) });
  });

  it("swallows a rejection that arrives after the timeout has been reported", async () => {
    vi.useFakeTimers();
    send.mockReturnValue(
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("The operation was aborted")), ALERT_TIMEOUT_MS + 50);
      })
    );
    const pending = sendEnquiryAlert(base, recipients);
    await vi.advanceTimersByTimeAsync(ALERT_TIMEOUT_MS + 1);
    await expect(pending).resolves.toMatchObject({ error: expect.stringMatching(/timed out/i) });
    // The race keeps a handler on the request, so the late rejection never surfaces as unhandled
    // (Vitest fails the run if one does).
    await vi.advanceTimersByTimeAsync(100);
  });
});
