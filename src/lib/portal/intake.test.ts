import { describe, expect, it } from "vitest";
import type { Pursuit } from "@/lib/db/schema";
import {
  firstHop,
  hashKey,
  isDoubleSubmission,
  isHoneypotFilled,
  normaliseFirm,
  parseEnquiry,
  sanitiseSubject,
  toPursuitValues,
  toSubmission,
  type EnquiryInput,
} from "./intake";

const NOW = new Date("2026-09-09T10:00:00Z");

const validBody = {
  name: "  Jane Partner ",
  firm: "Brewster Bye Architects Ltd.",
  email: "Jane@BBA.co.uk",
  disputeNature: "Technical / defects dispute",
  approximateValue: "£1m – £5m",
  forum: "",
  description: "Curtain wall defects.",
};

function makePursuit(overrides: Partial<Pursuit> = {}): Pursuit {
  return {
    id: "p1",
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
    stageChangedAt: new Date("2026-09-09T08:00:00Z"),
    nextAction: null,
    nextActionDue: null,
    createdBy: "site",
    createdAt: new Date("2026-09-09T08:00:00Z"),
    updatedAt: new Date("2026-09-09T08:00:00Z"),
    ...overrides,
  };
}

const input: EnquiryInput = {
  name: "Jane Partner",
  firm: "Brewster Bye Architects Ltd.",
  email: "jane@bba.co.uk",
  disputeNature: "Technical / defects dispute",
  approximateValue: "£1m – £5m",
  forum: null,
  description: "Curtain wall defects.",
};

describe("parseEnquiry", () => {
  it("accepts a valid submission, trims text, lower-cases the email and turns an empty select into null", () => {
    const result = parseEnquiry(validBody);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({
      name: "Jane Partner",
      firm: "Brewster Bye Architects Ltd.",
      email: "jane@bba.co.uk",
      disputeNature: "Technical / defects dispute",
      approximateValue: "£1m – £5m",
      forum: null,
      description: "Curtain wall defects.",
    });
  });

  it("treats a missing optional select and an empty description as null", () => {
    const result = parseEnquiry({ ...validBody, approximateValue: undefined, forum: undefined, description: "   " });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.approximateValue).toBeNull();
    expect(result.data.forum).toBeNull();
    expect(result.data.description).toBeNull();
  });

  it("rejects a missing firm", () => {
    const result = parseEnquiry({ ...validBody, firm: "  " });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/firm/i);
  });

  it("rejects a nature of dispute that is not in the list", () => {
    const result = parseEnquiry({ ...validBody, disputeNature: "Something else" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/nature/i);
  });

  it("rejects a forum that is not in the list", () => {
    const result = parseEnquiry({ ...validBody, forum: "Pistols at dawn" });
    expect(result.ok).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = parseEnquiry({ ...validBody, email: "not-an-email" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/email/i);
  });

  it("rejects a description over 4,000 characters", () => {
    const result = parseEnquiry({ ...validBody, description: "x".repeat(4001) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/summary|description/i);
  });

  it("rejects a body that is not an object", () => {
    expect(parseEnquiry(null).ok).toBe(false);
    expect(parseEnquiry("hello").ok).toBe(false);
  });
});

describe("isHoneypotFilled", () => {
  it("is true only when company_website carries text", () => {
    expect(isHoneypotFilled({ ...validBody, company_website: "http://spam.example" })).toBe(true);
    expect(isHoneypotFilled({ ...validBody, company_website: "" })).toBe(false);
    expect(isHoneypotFilled({ ...validBody, company_website: "   " })).toBe(false);
    expect(isHoneypotFilled(validBody)).toBe(false);
    expect(isHoneypotFilled(null)).toBe(false);
  });
});

describe("normaliseFirm", () => {
  it("lower-cases, strips punctuation and legal suffixes and collapses spaces", () => {
    expect(normaliseFirm("Brewster Bye Architects Ltd.")).toBe("brewster bye architects");
    expect(normaliseFirm("brewster   bye architects")).toBe("brewster bye architects");
    expect(normaliseFirm("Brewster Bye Architects Ltd.")).toBe(normaliseFirm("brewster bye architects"));
    expect(normaliseFirm("BREWSTER BYE ARCHITECTS LIMITED")).toBe("brewster bye architects");
    expect(normaliseFirm("Smith & Jones LLP")).toBe("smith jones");
    expect(normaliseFirm("Acme Holdings PLC")).toBe("acme holdings");
  });
});

describe("isDoubleSubmission", () => {
  it("is true for the same email and firm on an unowned enquiry created within 24 hours", () => {
    expect(isDoubleSubmission(makePursuit(), input, NOW)).toBe(true);
  });

  it("is true when the email differs only by case", () => {
    expect(isDoubleSubmission(makePursuit({ contactEmail: "Jane@BBA.co.uk" }), input, NOW)).toBe(true);
  });

  it("is false for a different firm", () => {
    expect(isDoubleSubmission(makePursuit({ firm: "Other Partners LLP" }), input, NOW)).toBe(false);
  });

  it("is false when the pursuit is owned", () => {
    expect(isDoubleSubmission(makePursuit({ ownerId: "user_1" }), input, NOW)).toBe(false);
  });

  it("is false when the pursuit has moved past enquiry", () => {
    expect(isDoubleSubmission(makePursuit({ stage: "scoping" }), input, NOW)).toBe(false);
  });

  it("is false when the pursuit is 25 hours old", () => {
    const old = makePursuit({ createdAt: new Date(NOW.getTime() - 25 * 60 * 60 * 1000) });
    expect(isDoubleSubmission(old, input, NOW)).toBe(false);
  });
});

describe("toPursuitValues", () => {
  it("maps the submission on to a new site-form pursuit at enquiry with no owner", () => {
    const values = toPursuitValues(input, "id-1", NOW);
    expect(values).toMatchObject({
      id: "id-1",
      firm: "Brewster Bye Architects Ltd.",
      contactName: "Jane Partner",
      contactEmail: "jane@bba.co.uk",
      disputeNature: "Technical / defects dispute",
      approximateValue: "£1m – £5m",
      forum: null,
      summary: "Curtain wall defects.",
      source: "site_form",
      ownerId: null,
      stage: "enquiry",
      createdBy: "site",
    });
    expect(values.stageChangedAt).toEqual(NOW);
    expect(values.createdAt).toEqual(NOW);
    expect(values.updatedAt).toEqual(NOW);
  });
});

describe("toSubmission", () => {
  it("records the submission with the time received", () => {
    expect(toSubmission(input, NOW)).toEqual({
      name: "Jane Partner",
      firm: "Brewster Bye Architects Ltd.",
      email: "jane@bba.co.uk",
      disputeNature: "Technical / defects dispute",
      approximateValue: "£1m – £5m",
      forum: null,
      description: "Curtain wall defects.",
      receivedAt: "2026-09-09T10:00:00.000Z",
    });
  });
});

describe("sanitiseSubject", () => {
  it("strips control characters and line breaks and collapses spaces", () => {
    expect(sanitiseSubject("Brewster\r\nBye\tArchitects ")).toBe("Brewster Bye Architects");
  });

  it("truncates to 80 characters", () => {
    const long = "A".repeat(100);
    expect(sanitiseSubject(long)).toHaveLength(80);
  });
});

describe("hashKey", () => {
  it("is deterministic, prefixed and insensitive to case and surrounding space", () => {
    const a = hashKey("email", "Jane@BBA.co.uk ");
    const b = hashKey("email", "jane@bba.co.uk");
    expect(a).toBe(b);
    expect(a).toMatch(/^email:[0-9a-f]{64}$/);
    expect(hashKey("ip", "1.2.3.4")).toMatch(/^ip:[0-9a-f]{64}$/);
    expect(hashKey("ip", "1.2.3.4")).not.toBe(hashKey("ip", "1.2.3.5"));
    expect(a).not.toContain("jane");
  });
});

describe("firstHop", () => {
  it("takes the first comma-separated address or falls back to unknown", () => {
    expect(firstHop("1.2.3.4, 5.6.7.8")).toBe("1.2.3.4");
    expect(firstHop(" 9.9.9.9 ")).toBe("9.9.9.9");
    expect(firstHop(null)).toBe("unknown");
    expect(firstHop("")).toBe("unknown");
  });
});
