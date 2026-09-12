// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.hoisted(() => vi.fn());
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

import { ALERT_TIMEOUT_MS } from "@/lib/portal/alerts";
import { accessMailSubject, accessMailText, sendAccessLink } from "./mail";

const url = "https://meritusvia.com/access/continue?ticket=abc";

beforeEach(() => {
  send.mockReset();
  send.mockResolvedValue({ data: { id: "email_1" }, error: null });
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("ENQUIRY_ALERT_FROM", "enquiries@meritusvia.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("accessMailText", () => {
  it("carries the link, the 30-minute rule and the re-request address", () => {
    const text = accessMailText(url);
    expect(text).toContain(url);
    expect(text).toMatch(/30 minutes/);
    expect(text).toContain("https://meritusvia.com/access");
  });
  it("has the agreed subject", () => {
    expect(accessMailSubject()).toBe("Your Meritus file link");
  });
});

describe("sendAccessLink", () => {
  it("sends plain text from the enquiry sender with a timeout signal", async () => {
    const outcome = await sendAccessLink({ to: "jane@example-firm.co.uk", url });
    expect(send).toHaveBeenCalledTimes(1);
    const [payload, options] = send.mock.calls[0];
    expect(payload).toEqual({ from: "enquiries@meritusvia.com", to: ["jane@example-firm.co.uk"], subject: "Your Meritus file link", text: accessMailText(url) });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(outcome).toHaveProperty("sentAt");
  });
  it("reports the Resend error", async () => {
    send.mockResolvedValue({ data: null, error: { name: "validation_error", message: "bad", statusCode: 422 } });
    expect(await sendAccessLink({ to: "jane@example-firm.co.uk", url })).toEqual({ error: "validation_error: bad" });
  });
  it("fails clearly when Resend is not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect(await sendAccessLink({ to: "jane@example-firm.co.uk", url })).toEqual({ error: "Resend is not configured" });
    expect(send).not.toHaveBeenCalled();
  });
  it("times out", async () => {
    vi.useFakeTimers();
    send.mockReturnValue(new Promise(() => {}));
    const pending = sendAccessLink({ to: "jane@example-firm.co.uk", url });
    await vi.advanceTimersByTimeAsync(ALERT_TIMEOUT_MS + 1);
    expect(await pending).toEqual({ error: `Timed out after ${ALERT_TIMEOUT_MS / 1000} seconds` });
  });
});
