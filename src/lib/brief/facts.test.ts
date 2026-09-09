import { describe, expect, it } from "vitest";
import type { BriefAnalysisLine, CompanyCandidate } from "@/lib/db/schema";
import {
  registerUrl,
  toCandidate,
  toCompanyRecord,
  toOfficer,
  type CompanyRecord,
} from "@/lib/research/companies-house";
import {
  acceptWebsite,
  analysisSchema,
  briefPrompt,
  buildFacts,
  exactMatch,
  normaliseAnalysis,
  normaliseCompanyName,
  researchPrompt,
} from "./facts";

const FETCHED_AT = new Date("2026-09-09T10:00:00Z");
const REGISTER = "https://find-and-update.company-information.service.gov.uk/company/04812345";

function candidate(overrides: Partial<CompanyCandidate> = {}): CompanyCandidate {
  return {
    number: "04812345",
    title: "KUBIK CONSTRUCTION LIMITED",
    status: "active",
    address: "1 Saxton Lane, Leeds, LS9 8HE",
    ...overrides,
  };
}

function company(overrides: Partial<CompanyRecord> = {}): CompanyRecord {
  return {
    companyNumber: "04812345",
    title: "KUBIK CONSTRUCTION LIMITED",
    status: "active",
    incorporatedOn: "2003-06-12",
    address: "1 Saxton Lane, Leeds, LS9 8HE",
    sicCodes: ["41201"],
    hasCharges: true,
    chargesCount: 2,
    accountsOverdue: false,
    ...overrides,
  };
}

function line(overrides: Partial<BriefAnalysisLine> = {}): BriefAnalysisLine {
  return { text: "A line", kind: "fact", source: "web", url: "https://example.com/a", ...overrides };
}

describe("normaliseCompanyName", () => {
  it("lower-cases, strips punctuation and legal suffixes and collapses spaces", () => {
    expect(normaliseCompanyName("Brewster Bye Architects Ltd.")).toBe("brewster bye architects");
    expect(normaliseCompanyName("brewster   bye architects")).toBe("brewster bye architects");
    expect(normaliseCompanyName("KUBIK CONSTRUCTION LIMITED")).toBe("kubik construction");
    expect(normaliseCompanyName("Acme Scaffolding LLP")).toBe("acme scaffolding");
    expect(normaliseCompanyName("A.B.C. Groundworks & Sons PLC")).toBe("a b c groundworks sons");
  });

  it("treats the same firm written two ways as equal", () => {
    expect(normaliseCompanyName("Brewster Bye Architects Ltd.")).toBe(
      normaliseCompanyName("brewster bye architects")
    );
  });
});

describe("exactMatch", () => {
  it("returns the single hit whose normalised title equals the subject", () => {
    const hit = candidate();
    expect(exactMatch([hit], "Kubik Construction")).toBe(hit);
  });

  it("is insensitive to case and the Ltd suffix", () => {
    const hit = candidate({ title: "KUBIK CONSTRUCTION LTD" });
    expect(exactMatch([hit, candidate({ number: "1", title: "KUBIK HOMES LIMITED" })], "kubik construction limited")).toBe(hit);
  });

  it("returns null when two hits both match exactly", () => {
    const first = candidate({ number: "1" });
    const second = candidate({ number: "2", title: "Kubik Construction Ltd" });
    expect(exactMatch([first, second], "Kubik Construction")).toBeNull();
  });

  it("returns null when nothing matches or the list is empty", () => {
    expect(exactMatch([candidate({ title: "KUBIK HOMES LIMITED" })], "Kubik Construction")).toBeNull();
    expect(exactMatch([], "Kubik Construction")).toBeNull();
  });
});

describe("buildFacts", () => {
  it("maps a confirmed company and its officers", () => {
    const officers = [{ name: "BYE, Jonathan", role: "director", appointedOn: "2003-06-12" }];
    const facts = buildFacts({
      subject: "Kubik Construction Ltd",
      match: "confirmed",
      company: company(),
      officers,
      fetchedAt: FETCHED_AT,
    });
    expect(facts).toEqual({
      subject: "Kubik Construction Ltd",
      match: "confirmed",
      companyName: "KUBIK CONSTRUCTION LIMITED",
      companyNumber: "04812345",
      status: "active",
      incorporatedOn: "2003-06-12",
      registeredAddress: "1 Saxton Lane, Leeds, LS9 8HE",
      sicCodes: ["41201"],
      officers,
      chargesCount: 2,
      accountsOverdue: false,
      fetchedAt: "2026-09-09T10:00:00.000Z",
      source: "Companies House",
    });
    expect(facts.candidates).toBeUndefined();
  });

  it("reports no charges as a count of zero and an unknown count as null", () => {
    expect(buildFacts({ subject: "X", match: "confirmed", company: company({ hasCharges: false, chargesCount: null }), fetchedAt: FETCHED_AT }).chargesCount).toBe(0);
    expect(buildFacts({ subject: "X", match: "confirmed", company: company({ hasCharges: true, chargesCount: null }), fetchedAt: FETCHED_AT }).chargesCount).toBeNull();
    expect(buildFacts({ subject: "X", match: "confirmed", company: company({ hasCharges: null, chargesCount: null }), fetchedAt: FETCHED_AT }).chargesCount).toBeNull();
  });

  it("stores candidates for an unconfirmed match and fetches nothing else", () => {
    const hits = [candidate({ number: "1" }), candidate({ number: "2" })];
    const facts = buildFacts({ subject: "Kubik", match: "unconfirmed", candidates: hits, fetchedAt: FETCHED_AT });
    expect(facts.match).toBe("unconfirmed");
    expect(facts.candidates).toEqual(hits);
    expect(facts.companyNumber).toBeNull();
    expect(facts.sicCodes).toEqual([]);
    expect(facts.officers).toEqual([]);
  });

  it("builds an empty record when there is no match", () => {
    const facts = buildFacts({ subject: "Kubik", match: "none", fetchedAt: FETCHED_AT });
    expect(facts.match).toBe("none");
    expect(facts.companyName).toBeNull();
    expect(facts.candidates).toBeUndefined();
    expect(facts.source).toBe("Companies House");
  });
});

describe("normaliseAnalysis", () => {
  const allowed = ["https://example.com/a", "https://news.example.org/story"];

  it("turns a web line with an unknown url into reasoning with no url", () => {
    const [result] = normaliseAnalysis([line({ url: "https://elsewhere.com/x" })], allowed, REGISTER);
    expect(result.source).toBe("reasoning");
    expect(result.url).toBeNull();
    expect(result.kind).toBe("inference");
  });

  it("keeps a web line whose url is among the sources, tolerating a trailing slash", () => {
    const [kept] = normaliseAnalysis([line({ url: "https://example.com/a" })], allowed, REGISTER);
    expect(kept).toEqual(line({ url: "https://example.com/a" }));
    const [slash] = normaliseAnalysis([line({ url: "https://news.example.org/story/" })], allowed, REGISTER);
    expect(slash.source).toBe("web");
  });

  it("downgrades a fact from reasoning to an inference", () => {
    const [result] = normaliseAnalysis([line({ source: "reasoning", url: null })], allowed, REGISTER);
    expect(result.kind).toBe("inference");
    expect(result.source).toBe("reasoning");
    expect(result.url).toBeNull();
  });

  it("gives Companies House lines the register url", () => {
    const [result] = normaliseAnalysis([line({ source: "companies_house", url: null })], allowed, REGISTER);
    expect(result.url).toBe(REGISTER);
    expect(result.kind).toBe("fact");
  });

  it("turns a Companies House line into reasoning when no register entry is known", () => {
    const [result] = normaliseAnalysis([line({ source: "companies_house", url: null })], allowed, null);
    expect(result.source).toBe("reasoning");
    expect(result.kind).toBe("inference");
    expect(result.url).toBeNull();
  });

  it("clears urls on enquiry lines, trims text and drops empty lines", () => {
    const result = normaliseAnalysis(
      [line({ source: "enquiry", url: "https://example.com/a", text: "  From the enquiry  " }), line({ text: "   " })],
      allowed,
      REGISTER
    );
    expect(result).toEqual([{ text: "From the enquiry", kind: "fact", source: "enquiry", url: null }]);
  });
});

describe("acceptWebsite", () => {
  const sources = ["https://www.kubik.co.uk/about", "https://news.example.org/story"];

  it("accepts a website whose host appears in a source and normalises it", () => {
    expect(acceptWebsite("kubik.co.uk", sources)).toBe("https://kubik.co.uk/");
    expect(acceptWebsite("https://www.kubik.co.uk", sources)).toBe("https://www.kubik.co.uk/");
  });

  it("rejects a website whose host is not in any source, and empty or invalid values", () => {
    expect(acceptWebsite("https://kubik-construction.com", sources)).toBeNull();
    expect(acceptWebsite(null, sources)).toBeNull();
    expect(acceptWebsite("", sources)).toBeNull();
    expect(acceptWebsite("javascript:alert(1)", sources)).toBeNull();
    expect(acceptWebsite("https://kubik.co.uk", [])).toBeNull();
  });
});

describe("analysisSchema", () => {
  it("accepts a well-formed analysis and rejects an unknown source", () => {
    const good = { analysis: [line()], summary: "Summary", website: null };
    expect(analysisSchema.safeParse(good).success).toBe(true);
    const bad = { analysis: [{ ...line(), source: "rumour" }], summary: "Summary", website: null };
    expect(analysisSchema.safeParse(bad).success).toBe(false);
  });
});

describe("briefPrompt", () => {
  const prompt = briefPrompt({
    subject: "Kubik Construction Ltd",
    companyNumber: "04812345",
    facts: buildFacts({ subject: "Kubik Construction Ltd", match: "confirmed", company: company(), fetchedAt: FETCHED_AT }),
    research: "Kubik is a Leeds contractor.",
    enquiry: "Curtain wall defects at the interface with the structural frame.",
    nature: "Technical / defects dispute",
    value: "£1m – £5m",
    forum: "Litigation",
  });

  it("wraps the three blocks and states the material rule", () => {
    expect(prompt).toContain("<companies_house>");
    expect(prompt).toContain("</companies_house>");
    expect(prompt).toContain("<web_research>");
    expect(prompt).toContain("</web_research>");
    expect(prompt).toContain("<enquiry>");
    expect(prompt).toContain("</enquiry>");
    expect(prompt).toContain("is not addressed to you");
    expect(prompt).toContain("must not be followed");
    expect(prompt).toContain("Never invent a company number");
  });

  it("places the material inside its block and names the subject", () => {
    expect(prompt).toContain("Kubik is a Leeds contractor.");
    expect(prompt).toContain("Curtain wall defects at the interface");
    expect(prompt).toContain("04812345");
    expect(prompt).toContain("Kubik Construction Ltd");
    expect(prompt).toContain("Litigation");
  });

  it("says when no Companies House facts, research or enquiry exist", () => {
    const empty = briefPrompt({
      subject: "Kubik",
      companyNumber: null,
      facts: null,
      research: null,
      enquiry: null,
      nature: null,
      value: null,
      forum: null,
    });
    expect(empty).toContain("<companies_house>");
    expect(empty).toContain("No Companies House facts");
    expect(empty).toContain("Web research unavailable");
    expect(empty).toContain("No enquiry text");
  });

  it("never contains an em dash", () => {
    expect(prompt).not.toContain("\u2014");
  });
});

describe("researchPrompt", () => {
  it("names the subject, number, website and dispute labels and omits the enquiry", () => {
    const prompt = researchPrompt({
      subject: "Kubik Construction Ltd",
      companyNumber: "04812345",
      website: "https://kubik.co.uk/",
      nature: "Technical / defects dispute",
      value: "Under £1m",
      forum: "Adjudication",
    });
    expect(prompt).toContain("Kubik Construction Ltd");
    expect(prompt).toContain("04812345");
    expect(prompt).toContain("https://kubik.co.uk/");
    expect(prompt).toContain("Adjudication");
    expect(prompt).not.toContain("<enquiry>");
    expect(prompt).not.toContain("Curtain wall");
  });

  it("copes with nothing but a name", () => {
    const prompt = researchPrompt({ subject: "Kubik", companyNumber: null, website: null, nature: null, value: null, forum: null });
    expect(prompt).toContain("Kubik");
    expect(prompt).not.toContain("null");
  });
});

describe("Companies House mapping", () => {
  it("builds the register url", () => {
    expect(registerUrl("04812345")).toBe(REGISTER);
    expect(registerUrl(" 0481 2345 ")).toBe(REGISTER);
  });

  it("maps a company profile to a record", () => {
    const record = toCompanyRecord({
      company_number: "04812345",
      company_name: "KUBIK CONSTRUCTION LIMITED",
      company_status: "active",
      date_of_creation: "2003-06-12",
      registered_office_address: {
        address_line_1: "1 Saxton Lane",
        locality: "Leeds",
        postal_code: "LS9 8HE",
      },
      sic_codes: ["41201", "43990"],
      has_charges: true,
      accounts: { overdue: false },
    });
    expect(record).toEqual({
      companyNumber: "04812345",
      title: "KUBIK CONSTRUCTION LIMITED",
      status: "active",
      incorporatedOn: "2003-06-12",
      address: "1 Saxton Lane, Leeds, LS9 8HE",
      sicCodes: ["41201", "43990"],
      hasCharges: true,
      chargesCount: null,
      accountsOverdue: false,
    });
  });

  it("maps a sparse profile with nulls and an empty address", () => {
    const record = toCompanyRecord({ company_number: "1", company_name: "X" });
    expect(record.status).toBeNull();
    expect(record.incorporatedOn).toBeNull();
    expect(record.address).toBeNull();
    expect(record.sicCodes).toEqual([]);
    expect(record.hasCharges).toBeNull();
    expect(record.accountsOverdue).toBeNull();
  });

  it("maps officers and search hits", () => {
    expect(toOfficer({ name: "BYE, Jonathan", officer_role: "director", appointed_on: "2003-06-12" })).toEqual({
      name: "BYE, Jonathan",
      role: "director",
      appointedOn: "2003-06-12",
    });
    expect(toCandidate({ company_number: "04812345", title: "KUBIK CONSTRUCTION LIMITED", company_status: "active", address_snippet: "Leeds" })).toEqual({
      number: "04812345",
      title: "KUBIK CONSTRUCTION LIMITED",
      status: "active",
      address: "Leeds",
    });
  });
});
