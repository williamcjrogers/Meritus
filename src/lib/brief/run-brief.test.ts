import { afterEach, describe, expect, it, vi } from "vitest";
import type { BriefAnalysisLine, CompanyCandidate, Pursuit } from "@/lib/db/schema";
import type { CompanyRecord } from "@/lib/research/companies-house";
import { briefSubject, runBrief, withTimeout, type BriefDeps } from "./run-brief";

const NOW = new Date("2026-09-09T10:00:00Z");
const REGISTER = "https://find-and-update.company-information.service.gov.uk/company/04812345";

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
    approximateValue: "£1m – £5m",
    forum: "Litigation",
    summary: "Curtain wall defects at the interface with the structural frame.",
    source: "site_form",
    sourceDetail: null,
    ownerId: "user_wr",
    stage: "scoping",
    stageChangedAt: NOW,
    nextAction: null,
    nextActionDue: null,
    createdBy: "site",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const company: CompanyRecord = {
  companyNumber: "04812345",
  title: "KUBIK CONSTRUCTION LIMITED",
  status: "active",
  incorporatedOn: "2003-06-12",
  address: "1 Saxton Lane, Leeds, LS9 8HE",
  sicCodes: ["41201"],
  hasCharges: false,
  chargesCount: null,
  accountsOverdue: false,
};

const hit = (overrides: Partial<CompanyCandidate> = {}): CompanyCandidate => ({
  number: "04812345",
  title: "KUBIK CONSTRUCTION LIMITED",
  status: "active",
  address: "Leeds",
  ...overrides,
});

const analysisLines: BriefAnalysisLine[] = [
  { text: "Registered in Leeds", kind: "fact", source: "companies_house", url: null },
  { text: "Probably the architect on Saxton Lane", kind: "inference", source: "web", url: "https://news.example.org/story" },
  { text: "Trading well", kind: "fact", source: "reasoning", url: null },
];

function makeDeps(pursuit: Pursuit | null, overrides: Partial<BriefDeps> = {}): BriefDeps {
  return {
    getPursuit: vi.fn(async () => pursuit),
    fetchCompany: vi.fn(async () => company),
    fetchOfficers: vi.fn(async () => [{ name: "BYE, Jonathan", role: "director", appointedOn: "2003-06-12" }]),
    searchCompanies: vi.fn(async () => [] as CompanyCandidate[]),
    research: vi.fn(async () => ({
      text: "Kubik is a Leeds contractor whose site is kubik.co.uk.",
      sources: ["https://news.example.org/story", "https://www.kubik.co.uk/about"],
    })),
    analyse: vi.fn(async () => ({ analysis: analysisLines, summary: "A Leeds contractor.", website: "kubik.co.uk" })),
    completeBrief: vi.fn(async () => undefined),
    failBrief: vi.fn(async () => undefined),
    addActivity: vi.fn(async () => ({}) as never),
    updatePursuit: vi.fn(async () => null),
    companiesHouseConfigured: () => true,
    now: () => NOW,
    ...overrides,
  };
}

const completed = (deps: BriefDeps) => vi.mocked(deps.completeBrief).mock.calls[0]?.[1];

describe("briefSubject", () => {
  it("is the firm and its number when no party is set", () => {
    expect(briefSubject(makePursuit({ companyNumber: "01234567" }))).toEqual({
      name: "Brewster Bye Architects",
      number: "01234567",
      isParty: false,
    });
  });

  it("is the party and its number when a party is set", () => {
    const pursuit = makePursuit({ party: "Kubik Construction Ltd", partyCompanyNumber: "04812345", companyNumber: "01234567" });
    expect(briefSubject(pursuit)).toEqual({ name: "Kubik Construction Ltd", number: "04812345", isParty: true });
  });

  it("normalises the number and treats a blank party as unset", () => {
    expect(briefSubject(makePursuit({ companyNumber: " 0481 2345 " })).number).toBe("04812345");
    expect(briefSubject(makePursuit({ party: "   " })).isParty).toBe(false);
    expect(briefSubject(makePursuit({ companyNumber: "  " })).number).toBeNull();
  });
});

describe("runBrief", () => {
  it("fetches the company when the number is known and completes with a confirmed match", async () => {
    const deps = makeDeps(makePursuit({ companyNumber: "04812345" }));
    await runBrief("b1", "p1", "user_wr", deps);

    expect(deps.fetchCompany).toHaveBeenCalledWith("04812345");
    expect(deps.fetchOfficers).toHaveBeenCalledWith("04812345");
    expect(deps.searchCompanies).not.toHaveBeenCalled();
    expect(deps.failBrief).not.toHaveBeenCalled();
    expect(deps.completeBrief).toHaveBeenCalledWith("b1", expect.anything());

    const values = completed(deps)!;
    expect(values.facts?.match).toBe("confirmed");
    expect(values.facts?.companyNumber).toBe("04812345");
    expect(values.facts?.officers).toHaveLength(1);
    expect(values.summary).toBe("A Leeds contractor.");
    expect(values.sources).toEqual(["https://news.example.org/story", "https://www.kubik.co.uk/about", REGISTER]);
    expect(values.analysis).toEqual([
      { text: "Registered in Leeds", kind: "fact", source: "companies_house", url: REGISTER },
      { text: "Probably the architect on Saxton Lane", kind: "inference", source: "web", url: "https://news.example.org/story" },
      { text: "Trading well", kind: "inference", source: "reasoning", url: null },
    ]);
    expect(deps.addActivity).toHaveBeenCalledWith({
      pursuitId: "p1",
      kind: "brief_generated",
      actorId: "user_wr",
      body: "Brief generated",
      meta: { briefId: "b1" },
    });
  });

  it("stores the number on the pursuit when the search finds exactly one exact hit", async () => {
    const deps = makeDeps(makePursuit(), { searchCompanies: vi.fn(async () => [hit({ title: "BREWSTER BYE ARCHITECTS LTD" }), hit({ number: "2", title: "BREWSTER HOMES LIMITED" })]) });
    await runBrief("b1", "p1", "user_wr", deps);

    expect(deps.searchCompanies).toHaveBeenCalledWith("Brewster Bye Architects");
    expect(deps.updatePursuit).toHaveBeenCalledWith("p1", { companyNumber: "04812345" });
    expect(deps.fetchCompany).toHaveBeenCalledWith("04812345");
    expect(completed(deps)?.facts?.match).toBe("confirmed");
    expect(completed(deps)?.sources).toContain(REGISTER);
  });

  it("stores the candidates and fetches nothing else when several hits could be the subject", async () => {
    const hits = [hit({ number: "1", title: "BREWSTER BYE ARCHITECTS LTD" }), hit({ number: "2", title: "BREWSTER BYE ARCHITECTS LIMITED" })];
    const deps = makeDeps(makePursuit(), { searchCompanies: vi.fn(async () => hits) });
    await runBrief("b1", "p1", "user_wr", deps);

    expect(deps.fetchCompany).not.toHaveBeenCalled();
    expect(deps.fetchOfficers).not.toHaveBeenCalled();
    expect(deps.updatePursuit).not.toHaveBeenCalledWith("p1", expect.objectContaining({ companyNumber: expect.anything() }));
    const values = completed(deps)!;
    expect(values.facts?.match).toBe("unconfirmed");
    expect(values.facts?.candidates).toEqual(hits);
    expect(values.sources).not.toContain(REGISTER);
    expect(values.analysis[0]).toEqual({ text: "Registered in Leeds", kind: "inference", source: "reasoning", url: null });
  });

  it("records no match when the search returns nothing", async () => {
    const deps = makeDeps(makePursuit());
    await runBrief("b1", "p1", "user_wr", deps);
    expect(completed(deps)?.facts?.match).toBe("none");
    expect(completed(deps)?.facts?.candidates).toBeUndefined();
  });

  it("carries no Companies House facts when the key is not configured", async () => {
    const deps = makeDeps(makePursuit({ companyNumber: "04812345" }), { companiesHouseConfigured: () => false });
    await runBrief("b1", "p1", "user_wr", deps);
    expect(deps.fetchCompany).not.toHaveBeenCalled();
    expect(deps.searchCompanies).not.toHaveBeenCalled();
    expect(completed(deps)?.facts).toBeNull();
    expect(completed(deps)?.sources).not.toContain(REGISTER);
  });

  it("still completes when the web research throws, noting that research was unavailable", async () => {
    const deps = makeDeps(makePursuit({ companyNumber: "04812345" }), { research: vi.fn(async () => { throw new Error("gateway down"); }) });
    await runBrief("b1", "p1", "user_wr", deps);

    expect(deps.failBrief).not.toHaveBeenCalled();
    const values = completed(deps)!;
    expect(values.analysis).toContainEqual({ text: "Web research unavailable", kind: "fact", source: "reasoning", url: null });
    expect(values.analysis.find((line) => line.text === "Probably the architect on Saxton Lane")).toMatchObject({ source: "reasoning", url: null });
    expect(values.sources).toEqual([REGISTER]);
    const prompt = vi.mocked(deps.analyse).mock.calls[0][0];
    expect(prompt).toContain("Web research unavailable");
  });

  it("fails the run and never completes when the analysis throws", async () => {
    const deps = makeDeps(makePursuit({ companyNumber: "04812345" }), { analyse: vi.fn(async () => { throw new Error("model timed out"); }) });
    await runBrief("b1", "p1", "user_wr", deps);

    expect(deps.failBrief).toHaveBeenCalledWith("b1", "model timed out");
    expect(deps.completeBrief).not.toHaveBeenCalled();
    expect(deps.addActivity).not.toHaveBeenCalled();
  });

  it("fails the run when the pursuit is missing", async () => {
    const deps = makeDeps(null);
    await runBrief("b1", "p1", "user_wr", deps);
    expect(deps.failBrief).toHaveBeenCalledWith("b1", "Pursuit not found");
    expect(deps.completeBrief).not.toHaveBeenCalled();
  });

  it("researches the party, stores its number as the party number, and does not touch the firm's website", async () => {
    const pursuit = makePursuit({ party: "Kubik Construction Ltd", website: null });
    const deps = makeDeps(pursuit, { searchCompanies: vi.fn(async () => [hit()]) });
    await runBrief("b1", "p1", "user_wr", deps);

    expect(deps.searchCompanies).toHaveBeenCalledWith("Kubik Construction Ltd");
    expect(deps.updatePursuit).toHaveBeenCalledWith("p1", { partyCompanyNumber: "04812345" });
    expect(deps.updatePursuit).not.toHaveBeenCalledWith("p1", expect.objectContaining({ website: expect.anything() }));
    expect(completed(deps)?.facts?.subject).toBe("Kubik Construction Ltd");
    const researchPrompt = vi.mocked(deps.research).mock.calls[0][0];
    expect(researchPrompt).toContain("Kubik Construction Ltd");
    expect(researchPrompt).not.toContain("Curtain wall");
  });

  it("fills the firm's empty website when the model names one whose host the research cited", async () => {
    const deps = makeDeps(makePursuit({ companyNumber: "04812345", website: null }));
    await runBrief("b1", "p1", "user_wr", deps);
    expect(deps.updatePursuit).toHaveBeenCalledWith("p1", { website: "https://kubik.co.uk/" });
  });

  it("leaves an existing website alone and rejects a website the research did not cite", async () => {
    const existing = makeDeps(makePursuit({ companyNumber: "04812345", website: "https://bba.co.uk/" }));
    await runBrief("b1", "p1", "user_wr", existing);
    expect(existing.updatePursuit).not.toHaveBeenCalled();

    const uncited = makeDeps(makePursuit({ companyNumber: "04812345" }), {
      analyse: vi.fn(async () => ({ analysis: [], summary: "S", website: "https://elsewhere.com" })),
    });
    await runBrief("b1", "p1", "user_wr", uncited);
    expect(uncited.updatePursuit).not.toHaveBeenCalled();
  });

  it("passes the firm's normalised website to the research prompt and keeps the enquiry out of it", async () => {
    const deps = makeDeps(makePursuit({ companyNumber: "04812345", website: "bba.co.uk" }));
    await runBrief("b1", "p1", "user_wr", deps);
    const prompt = vi.mocked(deps.research).mock.calls[0][0];
    expect(prompt).toContain("https://bba.co.uk/");
    expect(prompt).toContain("04812345");
    expect(prompt).not.toContain("Curtain wall");
    const analysisPrompt = vi.mocked(deps.analyse).mock.calls[0][0];
    expect(analysisPrompt).toContain("Curtain wall");
  });
});

describe("withTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("passes a value that arrives in time and an error that arrives in time", async () => {
    await expect(withTimeout(Promise.resolve("done"), 1_000, "late")).resolves.toBe("done");
    await expect(withTimeout(Promise.reject(new Error("gateway down")), 1_000, "late")).rejects.toThrow("gateway down");
  });

  it("rejects with the given message when the promise has not settled in time", async () => {
    vi.useFakeTimers();
    const pending = withTimeout(new Promise<string>(() => undefined), 45_000, "Web research timed out");
    const outcome = expect(pending).rejects.toThrow("Web research timed out");
    await vi.advanceTimersByTimeAsync(45_000);
    await outcome;
  });
});
