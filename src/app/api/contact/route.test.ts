// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Activity, Pursuit } from "@/lib/db/schema";

vi.mock("@/lib/db/pursuits", () => ({
  findDoubleSubmissionCandidates: vi.fn(),
  findRelatedPursuits: vi.fn(),
  createPursuitWithEnquiry: vi.fn(),
  touchPursuit: vi.fn(),
}));
vi.mock("@/lib/db/activity", () => ({
  addActivity: vi.fn(),
  updateActivityMeta: vi.fn(),
}));
vi.mock("@/lib/db/throttle", () => ({
  registerEnquiryAttempt: vi.fn(),
  purgeExpiredThrottle: vi.fn(),
}));
vi.mock("@/lib/portal/directors", () => ({
  listDirectors: vi.fn(),
}));
vi.mock("@/lib/portal/alerts", () => ({
  sendEnquiryAlert: vi.fn(),
}));

import { addActivity, updateActivityMeta } from "@/lib/db/activity";
import {
  createPursuitWithEnquiry,
  findDoubleSubmissionCandidates,
  findRelatedPursuits,
  touchPursuit,
} from "@/lib/db/pursuits";
import { purgeExpiredThrottle, registerEnquiryAttempt } from "@/lib/db/throttle";
import { sendEnquiryAlert } from "@/lib/portal/alerts";
import { listDirectors } from "@/lib/portal/directors";
import { POST } from "./route";

const body = {
  name: "Jane Partner",
  firm: "Brewster Bye Architects Ltd.",
  email: "Jane@BBA.co.uk",
  disputeNature: "Technical / defects dispute",
  approximateValue: "£1m – £5m",
  forum: "Litigation",
  description: "Curtain wall defects.",
  company_website: "",
};

function post(payload: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request("http://localhost/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4, 5.6.7.8", ...headers },
      body: typeof payload === "string" ? payload : JSON.stringify(payload),
    })
  );
}

function makePursuit(overrides: Partial<Pursuit> = {}): Pursuit {
  return {
    id: "existing",
    firm: "Brewster Bye Architects",
    contactName: "Jane Partner",
    contactEmail: "jane@bba.co.uk",
    contactPhone: null,
    website: null,
    companyNumber: null,
    party: null,
    partyCompanyNumber: null,
    counterparty: null,
    disputeNature: "Technical / defects dispute",
    approximateValue: null,
    forum: null,
    summary: null,
    source: "site_form",
    sourceDetail: null,
    ownerId: null,
    stage: "enquiry",
    stageChangedAt: new Date(),
    nextAction: null,
    nextActionDue: null,
    createdBy: "site",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "act-1",
    pursuitId: "new-id",
    kind: "enquiry_received",
    actorId: "site",
    body: null,
    meta: null,
    createdAt: new Date(),
    ...overrides,
  };
}

const allowed = { emailAllowed: true, ipAllowed: true, alertAllowed: true };

describe("POST /api/contact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(registerEnquiryAttempt).mockResolvedValue(allowed);
    vi.mocked(purgeExpiredThrottle).mockResolvedValue(undefined);
    vi.mocked(findDoubleSubmissionCandidates).mockResolvedValue([]);
    vi.mocked(findRelatedPursuits).mockResolvedValue([]);
    vi.mocked(createPursuitWithEnquiry).mockImplementation(async (values, entry) => ({
      pursuit: makePursuit({ id: values.id }),
      activity: makeActivity({ pursuitId: values.id, meta: entry.meta ?? null }),
    }));
    vi.mocked(addActivity).mockResolvedValue(makeActivity({ id: "act-2", pursuitId: "existing" }));
    vi.mocked(updateActivityMeta).mockResolvedValue(undefined);
    vi.mocked(touchPursuit).mockResolvedValue(undefined);
    vi.mocked(listDirectors).mockResolvedValue([
      { id: "u1", name: "William Rogers", email: "wr@meritusvia.com", initials: "WR" },
      { id: "u2", name: "Mateo Alvarez", email: "ma@meritusvia.com", initials: "MA" },
    ]);
    vi.mocked(sendEnquiryAlert).mockResolvedValue({ sentAt: "2026-09-09T10:00:01.000Z", recipients: 2 });
  });

  it("stores the pursuit, alerts the directors and records the outcome", async () => {
    const res = await post(body);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });

    expect(registerEnquiryAttempt).toHaveBeenCalledTimes(1);
    const keys = vi.mocked(registerEnquiryAttempt).mock.calls[0][0];
    expect(keys.email).toMatch(/^email:[0-9a-f]{64}$/);
    expect(keys.ip).toMatch(/^ip:[0-9a-f]{64}$/);

    expect(createPursuitWithEnquiry).toHaveBeenCalledTimes(1);
    const [values, entry] = vi.mocked(createPursuitWithEnquiry).mock.calls[0];
    expect(values).toMatchObject({
      firm: "Brewster Bye Architects Ltd.",
      contactEmail: "jane@bba.co.uk",
      source: "site_form",
      createdBy: "site",
      stage: "enquiry",
      ownerId: null,
    });
    expect(entry.kind).toBe("enquiry_received");
    expect(entry.actorId).toBe("site");
    expect(entry.meta?.submission).toMatchObject({ name: "Jane Partner", email: "jane@bba.co.uk" });
    expect(entry.meta?.relatedPursuitIds).toEqual([]);

    expect(sendEnquiryAlert).toHaveBeenCalledTimes(1);
    const [alertInput, recipients] = vi.mocked(sendEnquiryAlert).mock.calls[0];
    expect(alertInput.pursuitUrl).toBe(`https://meritusvia.com/portal/pursuits/${values.id}`);
    expect(alertInput.related).toBe(false);
    expect(alertInput.notSaved).toBeUndefined();
    expect(recipients).toEqual(["wr@meritusvia.com", "ma@meritusvia.com"]);

    expect(updateActivityMeta).toHaveBeenCalledTimes(1);
    const [activityId, meta] = vi.mocked(updateActivityMeta).mock.calls[0];
    expect(activityId).toBe("act-1");
    expect(meta.alert).toEqual({ sentAt: "2026-09-09T10:00:01.000Z", recipients: 2 });
    expect(meta.submission).toBeDefined();
    expect(purgeExpiredThrottle).toHaveBeenCalledTimes(1);
  });

  it("still alerts with the full submission when the store fails, and the visitor sees success", async () => {
    vi.mocked(createPursuitWithEnquiry).mockRejectedValue(new Error("connection refused"));
    const res = await post(body);
    expect(res.status).toBe(200);
    const [alertInput] = vi.mocked(sendEnquiryAlert).mock.calls[0];
    expect(alertInput.pursuitUrl).toBeNull();
    expect(alertInput.notSaved).toMatchObject({ name: "Jane Partner", email: "jane@bba.co.uk", description: "Curtain wall defects." });
    expect(updateActivityMeta).not.toHaveBeenCalled();
  });

  it("records an alert error on the activity and still returns success when the store worked", async () => {
    vi.mocked(sendEnquiryAlert).mockResolvedValue({ error: "validation_error: The from address is not verified" });
    const res = await post(body);
    expect(res.status).toBe(200);
    const [, meta] = vi.mocked(updateActivityMeta).mock.calls[0];
    expect(meta.alert).toEqual({ error: "validation_error: The from address is not verified" });
  });

  it("returns 500 when both the store and the alert fail", async () => {
    vi.mocked(createPursuitWithEnquiry).mockRejectedValue(new Error("connection refused"));
    vi.mocked(sendEnquiryAlert).mockResolvedValue({ error: "timed out" });
    const res = await post(body);
    expect(res.status).toBe(500);
  });

  it("returns 500 when the store fails and alerts are not configured", async () => {
    vi.mocked(createPursuitWithEnquiry).mockRejectedValue(new Error("connection refused"));
    vi.mocked(sendEnquiryAlert).mockResolvedValue({ skipped: "not_configured" });
    const res = await post(body);
    expect(res.status).toBe(500);
  });

  it("returns 200 without storing or alerting when the honeypot is filled", async () => {
    const res = await post({ ...body, company_website: "http://spam.example" });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });
    expect(registerEnquiryAttempt).not.toHaveBeenCalled();
    expect(createPursuitWithEnquiry).not.toHaveBeenCalled();
    expect(sendEnquiryAlert).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid submission", async () => {
    const res = await post({ ...body, firm: "" });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/firm/i);
    expect(registerEnquiryAttempt).not.toHaveBeenCalled();
    expect(createPursuitWithEnquiry).not.toHaveBeenCalled();
  });

  it("returns 400 for a body that is not JSON", async () => {
    const res = await post("not json");
    expect(res.status).toBe(400);
  });

  it("returns 429 when the email cap is reached", async () => {
    vi.mocked(registerEnquiryAttempt).mockResolvedValue({ ...allowed, emailAllowed: false });
    const res = await post(body);
    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toEqual({ error: "Too many enquiries" });
    expect(createPursuitWithEnquiry).not.toHaveBeenCalled();
    expect(sendEnquiryAlert).not.toHaveBeenCalled();
  });

  it("returns 429 when the address cap is reached", async () => {
    vi.mocked(registerEnquiryAttempt).mockResolvedValue({ ...allowed, ipAllowed: false });
    const res = await post(body);
    expect(res.status).toBe(429);
    expect(createPursuitWithEnquiry).not.toHaveBeenCalled();
  });

  it("stores but skips the alert above the global cap, and records that on the activity", async () => {
    vi.mocked(registerEnquiryAttempt).mockResolvedValue({ ...allowed, alertAllowed: false });
    const res = await post(body);
    expect(res.status).toBe(200);
    expect(createPursuitWithEnquiry).toHaveBeenCalledTimes(1);
    expect(sendEnquiryAlert).not.toHaveBeenCalled();
    expect(updateActivityMeta).toHaveBeenCalledTimes(1);
    const [activityId, meta] = vi.mocked(updateActivityMeta).mock.calls[0];
    expect(activityId).toBe("act-1");
    expect(meta.alert).toEqual({ error: expect.stringMatching(/cap/i) });
    expect(meta.submission).toBeDefined();
  });

  it("returns 500 when the store fails and the global cap withholds the alert", async () => {
    vi.mocked(registerEnquiryAttempt).mockResolvedValue({ ...allowed, alertAllowed: false });
    vi.mocked(createPursuitWithEnquiry).mockRejectedValue(new Error("connection refused"));
    const res = await post(body);
    expect(res.status).toBe(500);
    expect(sendEnquiryAlert).not.toHaveBeenCalled();
  });

  it("carries on to store and alert when the throttle itself fails", async () => {
    vi.mocked(registerEnquiryAttempt).mockRejectedValue(new Error("DATABASE_URL is not configured"));
    const res = await post(body);
    expect(res.status).toBe(200);
    expect(sendEnquiryAlert).toHaveBeenCalledTimes(1);
  });

  it("appends a double submission to the existing enquiry instead of creating a pursuit", async () => {
    vi.mocked(findDoubleSubmissionCandidates).mockResolvedValue([makePursuit({ id: "existing" })]);
    const res = await post(body);
    expect(res.status).toBe(200);
    expect(createPursuitWithEnquiry).not.toHaveBeenCalled();
    expect(addActivity).toHaveBeenCalledWith(
      expect.objectContaining({ pursuitId: "existing", kind: "enquiry_received", actorId: "site" })
    );
    expect(touchPursuit).toHaveBeenCalledWith("existing");
    const [alertInput] = vi.mocked(sendEnquiryAlert).mock.calls[0];
    expect(alertInput.pursuitUrl).toBe("https://meritusvia.com/portal/pursuits/existing");
    expect(alertInput.related).toBe(true);
    const [activityId] = vi.mocked(updateActivityMeta).mock.calls[0];
    expect(activityId).toBe("act-2");
  });

  it("treats a double submission as stored even when touching the pursuit fails", async () => {
    vi.mocked(findDoubleSubmissionCandidates).mockResolvedValue([makePursuit({ id: "existing" })]);
    vi.mocked(touchPursuit).mockRejectedValue(new Error("connection reset"));
    const res = await post(body);
    expect(res.status).toBe(200);
    expect(addActivity).toHaveBeenCalledTimes(1);
    expect(createPursuitWithEnquiry).not.toHaveBeenCalled();
    const [alertInput] = vi.mocked(sendEnquiryAlert).mock.calls[0];
    expect(alertInput.pursuitUrl).toBe("https://meritusvia.com/portal/pursuits/existing");
    expect(alertInput.notSaved).toBeUndefined();
    const [activityId, meta] = vi.mocked(updateActivityMeta).mock.calls[0];
    expect(activityId).toBe("act-2");
    expect(meta.alert).toEqual({ sentAt: "2026-09-09T10:00:01.000Z", recipients: 2 });
  });

  it("creates a new pursuit when the candidate is not a double submission", async () => {
    vi.mocked(findDoubleSubmissionCandidates).mockResolvedValue([makePursuit({ id: "existing", firm: "Someone Else LLP" })]);
    await post(body);
    expect(addActivity).not.toHaveBeenCalled();
    expect(createPursuitWithEnquiry).toHaveBeenCalledTimes(1);
  });

  it("records related pursuits and marks the alert as a further enquiry", async () => {
    vi.mocked(findRelatedPursuits).mockResolvedValue([makePursuit({ id: "older", stage: "declined" })]);
    await post(body);
    const [, entry] = vi.mocked(createPursuitWithEnquiry).mock.calls[0];
    expect(entry.meta?.relatedPursuitIds).toEqual(["older"]);
    const [alertInput] = vi.mocked(sendEnquiryAlert).mock.calls[0];
    expect(alertInput.related).toBe(true);
  });

  it("records an error when the director list is unavailable", async () => {
    vi.mocked(listDirectors).mockRejectedValue(new Error("Clerk timed out"));
    const res = await post(body);
    expect(res.status).toBe(200);
    expect(sendEnquiryAlert).not.toHaveBeenCalled();
    const [, meta] = vi.mocked(updateActivityMeta).mock.calls[0];
    expect(meta.alert).toEqual({ error: "Clerk timed out" });
  });

  it("does not fail the response when the throttle purge fails", async () => {
    vi.mocked(purgeExpiredThrottle).mockRejectedValue(new Error("boom"));
    const res = await post(body);
    expect(res.status).toBe(200);
  });
});
