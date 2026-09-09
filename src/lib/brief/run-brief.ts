/**
 * The research brief run: register facts, web research, one analysis call,
 * then the provenance rules and the store. Every outside call arrives through
 * `BriefDeps` so tests drive the run with stubs; `defaultBriefDeps()` wires the
 * real Companies House client, the research model and the language model.
 */

import { generateText, Output } from "ai";
import { getLanguageModel } from "@/lib/ai/model";
import { addActivity } from "@/lib/db/activity";
import { completeBrief, failBrief } from "@/lib/db/briefs";
import { getPursuit, updatePursuit } from "@/lib/db/pursuits";
import type { BriefAnalysisLine, BriefFacts, BriefOfficer, CompanyCandidate, Pursuit } from "@/lib/db/schema";
import { isCompaniesHouseConfigured } from "@/lib/env";
import {
  fetchCompany,
  fetchOfficers,
  normaliseCompanyNumber,
  registerUrl,
  searchCompanies,
  type CompanyRecord,
} from "@/lib/research/companies-house";
import { searchWeb } from "@/lib/research/search-web";
import { normalizeWebsite } from "@/lib/research/urls";
import {
  acceptWebsite,
  analysisSchema,
  briefPrompt,
  buildFacts,
  exactMatch,
  normaliseAnalysis,
  researchPrompt,
  type AnalysisOutput,
} from "./facts";

export type BriefDeps = {
  getPursuit(id: string): Promise<Pursuit | null>;
  fetchCompany(number: string): Promise<CompanyRecord | null>;
  fetchOfficers(number: string): Promise<BriefOfficer[]>;
  searchCompanies(name: string): Promise<CompanyCandidate[]>;
  research(prompt: string): Promise<{ text: string; sources: string[] }>;
  analyse(prompt: string, timeoutMs?: number): Promise<{ analysis: BriefAnalysisLine[]; summary: string; website: string | null }>;
  completeBrief: typeof completeBrief;
  failBrief: typeof failBrief;
  addActivity: typeof addActivity;
  updatePursuit: typeof updatePursuit;
  companiesHouseConfigured(): boolean;
  now(): Date;
};

const ANALYSIS_TIMEOUT_MS = 90_000;
/** Web research is tolerated when it fails, so a hung call must not consume the run's budget. */
const RESEARCH_TIMEOUT_MS = 45_000;
/** The whole run must finish inside the route's maxDuration (120 s) with room for the writes. */
export const RUN_BUDGET_MS = 105_000;
const MIN_STAGE_MS = 5_000;
const RESEARCH_UNAVAILABLE: BriefAnalysisLine = {
  text: "Web research unavailable",
  kind: "inference",
  source: "reasoning",
  url: null,
};

/** Rejects with `message` when `promise` has not settled within `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export function defaultBriefDeps(): BriefDeps {
  return {
    getPursuit,
    fetchCompany,
    fetchOfficers,
    searchCompanies: (name) => searchCompanies(name, 5),
    research: (prompt) => searchWeb(prompt),
    analyse: async (prompt, timeoutMs = ANALYSIS_TIMEOUT_MS): Promise<AnalysisOutput> => {
      const result = await generateText({
        model: getLanguageModel(),
        prompt,
        output: Output.object({ schema: analysisSchema }),
        timeout: { totalMs: timeoutMs },
      });
      return result.output;
    },
    completeBrief,
    failBrief,
    addActivity,
    updatePursuit,
    companiesHouseConfigured: isCompaniesHouseConfigured,
    now: () => new Date(),
  };
}

function cleanNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const number = normaliseCompanyNumber(value);
  return number || null;
}

/** The organisation the brief is about: the party when set, otherwise the firm. */
export function briefSubject(p: Pursuit): { name: string; number: string | null; isParty: boolean } {
  const party = p.party?.trim();
  if (party) {
    return { name: party, number: cleanNumber(p.partyCompanyNumber), isParty: true };
  }
  return { name: p.firm.trim(), number: cleanNumber(p.companyNumber), isParty: false };
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return (message.trim() || "Brief failed").slice(0, 500);
}

type RegisterStep = {
  facts: BriefFacts | null;
  /** The number the brief worked from, whether supplied or matched. */
  number: string | null;
  /** True when the register returned a record for that number. */
  confirmed: boolean;
  /** Set when the search found the number and it should be stored on the pursuit. */
  matchedNumber: string | null;
};

async function registerStep(
  subject: { name: string; number: string | null },
  deps: BriefDeps,
  now: Date
): Promise<RegisterStep> {
  if (!deps.companiesHouseConfigured()) {
    return { facts: null, number: subject.number, confirmed: false, matchedNumber: null };
  }

  const lookUp = async (number: string, matched: boolean): Promise<RegisterStep> => {
    const company = await deps.fetchCompany(number);
    const officers = company ? await deps.fetchOfficers(number) : [];
    return {
      facts: buildFacts({
        subject: subject.name,
        match: company ? "confirmed" : "none",
        company,
        officers,
        fetchedAt: now,
      }),
      number,
      confirmed: Boolean(company),
      matchedNumber: matched ? number : null,
    };
  };

  if (subject.number) return lookUp(subject.number, false);

  const hits = await deps.searchCompanies(subject.name);
  const exact = exactMatch(hits, subject.name);
  if (exact) return lookUp(normaliseCompanyNumber(exact.number), true);

  return {
    facts: buildFacts({
      subject: subject.name,
      match: hits.length > 0 ? "unconfirmed" : "none",
      candidates: hits,
      fetchedAt: now,
    }),
    number: null,
    confirmed: false,
    matchedNumber: null,
  };
}

async function safeFail(deps: BriefDeps, briefId: string, error: unknown): Promise<void> {
  try {
    await deps.failBrief(briefId, errorMessage(error));
  } catch (failure) {
    console.error("brief could not be marked failed", briefId, failure);
  }
}

export async function runBrief(
  briefId: string,
  pursuitId: string,
  actorId: string,
  deps: BriefDeps
): Promise<void> {
  let pursuit: Pursuit | null;
  try {
    pursuit = await deps.getPursuit(pursuitId);
  } catch (error) {
    await safeFail(deps, briefId, error);
    return;
  }
  if (!pursuit) {
    await safeFail(deps, briefId, new Error("Pursuit not found"));
    return;
  }

  const subject = briefSubject(pursuit);
  const context = {
    nature: pursuit.disputeNature,
    value: pursuit.approximateValue,
    forum: pursuit.forum,
  };

  let website: string | null = null;
  try {
    const now = deps.now();

    const deadline = now.getTime() + RUN_BUDGET_MS;
    const remaining = (ceiling: number) => Math.max(MIN_STAGE_MS, Math.min(ceiling, deadline - Date.now()));

    // 1 and 2: the subject and the register.
    const register = await registerStep(subject, deps, now);
    if (register.matchedNumber) {
      await deps.updatePursuit(
        pursuit.id,
        subject.isParty
          ? { partyCompanyNumber: register.matchedNumber }
          : { companyNumber: register.matchedNumber }
      );
    }

    // 3: web research, tolerated when it fails. The enquiry text never travels here,
    // and the firm's website only describes the firm, so it stays out when the party is the subject.
    let research: { text: string; sources: string[] } | null = null;
    let researchFailure: string | null = null;
    try {
      research = await withTimeout(
        deps.research(
          researchPrompt({
            subject: subject.name,
            companyNumber: register.number,
            website: subject.isParty ? null : normalizeWebsite(pursuit.website),
            ...context,
          })
        ),
        remaining(RESEARCH_TIMEOUT_MS),
        "Web research timed out"
      );
    } catch (error) {
      researchFailure = errorMessage(error);
      console.warn("brief web research failed", pursuitId, researchFailure);
      research = null;
    }

    // 4: one analysis call.
    const output = await deps.analyse(
      briefPrompt({
        subject: subject.name,
        companyNumber: register.number,
        facts: register.facts,
        research: research?.text ?? null,
        sources: research?.sources ?? [],
        enquiry: pursuit.summary,
        ...context,
      }),
      remaining(ANALYSIS_TIMEOUT_MS)
    );

    // 5: provenance rules.
    const registerLink = register.confirmed && register.number ? registerUrl(register.number) : null;
    const allowed = research?.sources ?? [];
    const analysis = normaliseAnalysis(output.analysis, allowed, registerLink);
    if (!research) {
      // The reason travels with the notice so a director (and a log reader) can tell a timeout from an outage.
      analysis.push({ ...RESEARCH_UNAVAILABLE, text: researchFailure ? `${RESEARCH_UNAVAILABLE.text}: ${researchFailure}` : RESEARCH_UNAVAILABLE.text });
    }
    const sources = Array.from(new Set(registerLink ? [...allowed, registerLink] : allowed));
    website = acceptWebsite(output.website, allowed);

    // 6: store.
    await deps.completeBrief(briefId, {
      facts: register.facts,
      analysis,
      summary: output.summary.trim(),
      sources,
    });
  } catch (error) {
    await safeFail(deps, briefId, error);
    return;
  }

  // The brief is complete; nothing after this point may mark it failed.
  try {
    await deps.addActivity({
      pursuitId,
      kind: "brief_generated",
      actorId,
      body: "Brief generated",
      meta: { briefId },
    });
    if (website && !subject.isParty && !pursuit.website?.trim()) {
      await deps.updatePursuit(pursuit.id, { website });
    }
  } catch (error) {
    console.error("brief follow-up failed", briefId, errorMessage(error));
  }
}
