# QCS Director Research Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give QCS directors an evidence-backed investigation, monitoring, case-law and commercial decision workflow, with reviewed conversion into pursuits.

**Architecture:** Build on the evidence repositories, source adapters and durable jobs delivered by the foundation and source plans. Keep scoring and review logic in small pure modules, with authenticated route handlers and server-rendered pages. Reports and conversations reference source versions and passages so corrections can propagate.

**Tech Stack:** Existing Next.js 15, React 19, TypeScript 5.9, Clerk, Drizzle/Neon Postgres, Zod, AI SDK, S3 and Vitest.

**Spec:** `docs/superpowers/specs/2026-09-12-qcs-research-design.md`, especially R01 and R14 to R21.

**Status:** Approved on 12 September 2026 and executed in `codex/qcs-research`. The original checklist below records intended steps. See [implementation and acceptance](../../reviews/2026-09-12-qcs-research-delivery.md) for the current implementation, consolidated tests and explicitly separate live deployment acceptance.

## Global Constraints

- QCS owns and operates the research service; QCS is the holder of the supplied Find Case Law licence.
- Use British English, DD Month YYYY for displayed dates, GBP by default and no em dashes.
- Preserve the current uncommitted client-domain schema work and other contributors' changes.
- Keep client-deposited files static; research processes public records, licensed records and material deliberately added to a research investigation.
- Do not send outreach, publish a digest externally, buy a subscription, push or deploy as a side effect of research.
- Require a director role at every portal page, route and server action; a signed-in client is not a director.
- Keep credentials server-side; store secret references rather than secret values in research configuration.
- Every factual assertion must link to an available source record and a supporting passage or structured field. Model citations alone do not verify a claim.
- Every provider failure, incomplete page, omitted population and stale source must remain visible in coverage.
- Do not apply migrations to production during tests. The existing build command runs migrations.

## Execution and interfaces

All paths are relative to `/Users/williamrogers/Projects/Meritus`. Keep source-plan parser types and foundation types in `src/lib/research/contracts.ts`. Do not create another fetcher, queue or evidence store.

Foundation provides `QCS_WORKSPACE_ID`, `createInvestigation`, `enqueueResearchJob`, `cancelResearchRun`, `searchResearchPassages` and the `research_invalidations` outbox. Read their exact definitions in the completed foundation implementation before writing consumers. The source plan provides `extractEnvelope`, entity resolution and case-law operations. Tests should use synthetic records and stub providers, not confidential documents or live paid accounts.

The workflow owns `src/lib/db/research-workflow-schema.ts` and `src/lib/db/research-workflow.ts`; re-export the schema from `src/lib/db/schema.ts`. Its tables reference foundation tables. Foundation retains ownership of documents, versions, passages, investigations, runs, jobs, rights and sources.

Use this explicit test command, replacing the final path with each task's test file:

```sh
corepack pnpm --config.verify-deps-before-run=false exec node node_modules/vitest/vitest.mjs run src/lib/research/scoring.test.ts
```

For each task, first add its specified failing test, run it to establish the missing behaviour, implement the described change, then run the focused test and relevant existing regressions. Use a fresh reviewer before committing the task's enumerated files. Do not stage the whole working tree.

## Task 1: Commission investigations and maintain watchlists

**Files:**

- Create `src/lib/research/workflow-types.ts`, `src/lib/research/commission.ts`, `src/lib/research/commission.test.ts`.
- Create `src/lib/db/research-workflow-schema.ts`, `src/lib/db/research-workflow.ts`.
- Create `src/app/api/portal/research/investigations/route.ts`, `src/app/api/portal/research/watchlists/route.ts` and adjacent route tests.
- Modify `src/lib/db/schema.ts` only to re-export the workflow schema.
- Generate the next unused Drizzle migration with name `research_workflow`; never assume `0003` remains available.

**Interfaces:**

```ts
export type ResearchScope = {
  kind: "organisation" | "project" | "legal_issue" | "sector" | "referral";
  subject: string;
  entityId: string | null;
  jurisdiction: string;
  from: string | null;
  to: string | null;
  sources: string[];
};
export type ResearchBudget = {
  maxRequests: number;
  maxTokens: number;
  maxCostPence: number;
};
export type InvestigationRequest = {
  requestId: string;
  question: string;
  scope: ResearchScope;
  budget: ResearchBudget;
};
export function publicSearchQuery(scope: ResearchScope): string;
```

- [ ] Add a test that ensures only explicit public scope enters web discovery:

```ts
import { expect, it } from "vitest";
import { publicSearchQuery } from "./commission";

it("builds a search query only from the selected public subject", () => {
  const query = publicSearchQuery({
    kind: "organisation", subject: "Example Civil Engineering Limited",
    entityId: null, jurisdiction: "England and Wales", from: null,
    to: null, sources: ["companies-house"],
  });
  expect(query).toBe('"Example Civil Engineering Limited" England and Wales');
});
```

- [ ] Add Zod validation: `requestId` UUID, question 1 to 4,000 characters, subject 1 to 300, source count 1 to 20, valid ISO dates with `from <= to`, positive integer limits, maximum values taken from server configuration. The server selects the workspace and actor; ignore client-supplied ownership. `publicSearchQuery` strips control characters and embedded double quotes, then returns the quoted subject followed by jurisdiction. Never append a pursuit summary, contract sum, counterparty confidential allegation or client document.
- [ ] Create `research_watchlists` and `research_watchlist_members` with unique `(watchlist_id, entity_id)`; store cadence, timezone `Europe/London`, source/signal choices and next due time. A watchlist has an owner, label and enabled flag. Require a confirmed entity for automated monitoring; allow an unresolved investigation for manual research.
- [ ] Implement authenticated POST creation returning `202 { investigationId, runId }`, GET paginated listings and watchlist CRUD with optimistic version checks. The client creates one `requestId` per deliberate new investigation and retains it across retries. Derive the unique server key from the authenticated actor and that UUID, and store the canonical request hash. A repeated actor/key with identical content returns the original run; different content returns `409`. A new deliberate refresh receives a new UUID.
- [ ] Route tests cover unauthenticated, client, forged workspace/owner, invalid time range, excessive budget, duplicate request and database unavailable. Run them plus `commission.test.ts`; commit only the listed files and generated migration.

## Task 2: Store claims and calculate transparent priority

**Files:**

- Create `src/lib/research/scoring.ts`, `src/lib/research/scoring.test.ts`, `src/lib/research/claims.ts`, `src/lib/research/claims.test.ts`.
- Extend `src/lib/db/research-workflow-schema.ts` and `src/lib/db/research-workflow.ts` with claims, evidence joins and signals.

**Interfaces and core algorithm:**

```ts
export type SignalInput = {
  id: string;
  eventKey: string;
  kind: "direct" | "project_change" | "payment" | "context";
  occurredAt: string | null;
  confidence: number;
  halfLifeDays: number;
  independenceConfirmed: boolean;
  available: boolean;
  suppressed: boolean;
};
export type Priority = {
  score: number;
  independentEvents: number;
  corroborated: boolean;
  provisionalIds: string[];
};
const weights = { direct: 40, project_change: 25, payment: 15, context: 5 };

export function scoreSignals(items: SignalInput[], now: Date): Priority {
  const events = new Map<string, number>();
  const qualifying = new Set<string>();
  const provisionalIds: string[] = [];
  for (const item of items) {
    if (!item.available || item.suppressed) continue;
    const at = item.occurredAt === null ? NaN : Date.parse(item.occurredAt);
    if (!Number.isFinite(at) || at > now.getTime()) {
      provisionalIds.push(item.id);
      continue;
    }
    if (item.confidence < 0 || item.confidence > 1 || item.halfLifeDays <= 0) {
      throw new Error("Invalid scoring input");
    }
    const age = (now.getTime() - at) / 86_400_000;
    const value = weights[item.kind] * item.confidence * 2 ** (-age / item.halfLifeDays);
    events.set(item.eventKey, Math.max(events.get(item.eventKey) ?? 0, value));
    if (item.independenceConfirmed && item.kind !== "context" && item.confidence >= 0.75 && value >= 5) {
      qualifying.add(item.eventKey);
    }
  }
  return {
    score: Math.min(100, Math.round([...events.values()].reduce((a, b) => a + b, 0))),
    independentEvents: qualifying.size,
    corroborated: qualifying.size >= 2,
    provisionalIds,
  };
}
```

- [ ] Add the following test and separate tests for decay, withdrawn evidence, undated/future events, confidence bounds and contextual-only signals:

```ts
import { expect, it } from "vitest";
import { scoreSignals, type SignalInput } from "./scoring";

it("does not count syndication as corroboration", () => {
  const item: SignalInput = {
    id: "a", eventKey: "appointment:GB-COH:00000001:2026-09-12",
    kind: "direct", occurredAt: "2026-09-12T00:00:00Z", confidence: 1,
    halfLifeDays: 30, independenceConfirmed: true, available: true, suppressed: false,
  };
  expect(scoreSignals([item, { ...item, id: "b" }], new Date("2026-09-12T00:00:00Z")))
    .toEqual({ score: 40, independentEvents: 1, corroborated: false, provisionalIds: [] });
});
```

- [ ] Implement the core above, adding finite-number validation at the API/schema boundary. Persist `qcs_priority_v1`, component inputs and `scoredAt`. Event keys use provider record identity, event type, subject and event date; a reviewed equivalence link merges differently published reports of the same event. Unknown lineage remains unconfirmed and cannot satisfy the corroboration rule automatically.
- [ ] Create `research_claims` with observation/allegation/inference and unverified/verified/disputed state; `research_claim_evidence` references exact version/passages and supports contradiction links. Treat extractor `observation` as proposed factual material, not automatic verification. A displayed claim must join to an available version and preserve its source wording/context.
- [ ] Write a claim test using a fabricated quotation that is absent from the supplied passage; the verifier must return `unsupported_quote`. Changing only the supplied citation URL must never turn the assertion into verified evidence. Verify the exact passage or structured field first.
- [ ] Run focused tests; inspect a synthetic two-event score and its component breakdown; commit this task's modules and schema migration.

## Task 3: Calendars and referral relationship research

**Files:**

- Create `src/lib/research/calendar.ts`, `src/lib/research/calendar.test.ts`, `src/lib/research/referrals.ts`, `src/lib/research/referrals.test.ts`.
- Add calendar records, review history, suppressions and outcomes in `src/lib/db/research-workflow-schema.ts`.

**Interfaces:**

```ts
export type CalendarProposal = {
  kind: "practical_completion" | "retention" | "limitation" | "hearing";
  date: string;
  evidenceIds: string[];
  jurisdiction: string | null;
  rule: string | null;
  accrualBasis: string | null;
  reviewedBy: string | null;
};
export function calendarState(value: CalendarProposal): "provisional" | "reviewed" {
  if (!value.evidenceIds.length || !value.reviewedBy) return "provisional";
  if (value.kind === "limitation" && (!value.jurisdiction || !value.rule || !value.accrualBasis)) {
    return "provisional";
  }
  return "reviewed";
}
export type Engagement = {
  adviserEntityId: string; partyEntityId: string; caseId: string;
  evidenceIds: string[]; observedAt: string;
};
export type ConflictDecision = {
  status: "not_checked" | "clear" | "potential" | "conflicted";
  reviewedBy: string | null; reviewedAt: string | null; rationale: string | null;
};
export function initialConflictDecision(): ConflictDecision {
  return { status: "not_checked", reviewedBy: null, reviewedAt: null, rationale: null };
}
```

- [ ] Add tests that a practical-completion date plus six years is never generated as an automatic limitation deadline; test `calendarState` remains provisional without the rule/accrual evidence. Add a referral test that an observed expert engagement leaves `initialConflictDecision().status` equal to `not_checked`.
- [ ] Implement source-backed calendar entry creation and review. Accept a director-entered proposed date, retain assumptions and subsequent corrections, and schedule reminders from persisted dates. Do not implement a universal statutory limitation calculator.
- [ ] Implement relationship filters for funders, insurers, administrators, firms, chambers, surveyors, contractors and experts. Store engagement observations as evidence-backed relationships. Record referral channel, service offer, owner, relationship stage and last contact date separately from company priority.
- [ ] Add suppression actions scoped to person, organisation or investigation with a reason and optional expiry. Changing a suppression causes score/recommendation recomputation and stops pending conversion/export jobs for that subject.
- [ ] Run tests and review a synthetic insolvency claims-book/referrer example with an already-appointed adviser. Commit only these workflow changes.

## Task 4: Evidence-backed investigation assistant

**Files:**

- Create `src/lib/research/assistant.ts`, `src/lib/research/assistant-tools.ts`, `src/lib/research/assistant.test.ts`, `src/lib/research/report-schema.ts`.
- Create `src/app/api/portal/research/investigations/[id]/questions/route.ts` and its test.
- Modify `src/lib/questions/sources.ts`, `src/lib/questions/system-prompt.ts` and their tests for safe, precise shared source handling.

**Interfaces:**

```ts
export type EvidenceRef = { documentId: string; versionId: string; passageId: string };
export type DraftFinding = {
  text: string;
  kind: "observation" | "allegation" | "inference";
  evidence: EvidenceRef[];
};
export function validateFinding(
  finding: DraftFinding,
  permittedEvidence: ReadonlyMap<string, EvidenceRef>,
): "valid" | "missing_evidence" | "unknown_evidence" {
  if (finding.kind !== "inference" && finding.evidence.length === 0) return "missing_evidence";
  if (finding.evidence.some((ref) => {
    const actual = permittedEvidence.get(ref.passageId);
    return !actual || actual.documentId !== ref.documentId || actual.versionId !== ref.versionId;
  })) return "unknown_evidence";
  return "valid";
}
```

- [ ] Test that a model cannot cite an unread passage, forge a document/version pair around a real passage, or supply a fact without evidence. An inference remains visibly labelled even when evidence is supplied. Build `permittedEvidence` from authenticated database joins for the actual source versions read. Test that two pages on the same publisher domain produce two citation records, preserving their URLs and locators.
- [ ] Define typed tools: `search_sources`, `read_evidence`, `search_case_law`, `read_case_law`, `compare_claims`, `read_entity`, `read_coverage`. Every tool checks workspace and source availability. Tools consume validated IDs or controlled search terms, never model-selected arbitrary URLs. Return passage IDs and source metadata, not a free-text source list.
- [ ] Build the prompt from the question, scope and fenced evidence. Fence user-provided headers, titles, company names, queries and source text. Reject forged system/developer/tool messages in the incoming conversation; reconstruct trusted tool history from storage. Model output cannot perform mutations or direct outreach.
- [ ] Reuse existing AI Gateway clients and log actual model ID, prompt version, source versions, usage and coverage. Use foundation cancellation and budget reservation; abort the provider request when cancelled. An upstream failure produces a visible partial run and preserves completed evidence.
- [ ] Link every draft to its exact evidence set and run. `validateFinding` is a structural citation gate, not semantic proof: apply the passage/field verification from Task 2 and retain unverified status for substantive interpretation. A director, not the model, changes a finding to reviewed.
- [ ] Add route tests for client access, cross-workspace passage IDs, withdrawn source, prompt injection, cancellation, budget exhaustion and provider failure. Run them plus existing questions/brief tests and commit.

## Task 5: Reviewed conversion into the pursuit desk

**Files:**

- Create `src/lib/research/review.ts`, `src/lib/research/review.test.ts`, `src/lib/research/convert.ts`, `src/lib/research/convert.test.ts`.
- Create `src/app/api/portal/research/signals/[id]/review/route.ts`, `src/app/api/portal/research/signals/[id]/convert/route.ts` and tests.
- Extend `src/lib/db/research-workflow.ts` and add `research_conversions` migration.
- Modify `src/app/(portal)/portal/pursuits/[id]/page.tsx` to display linked research.

**Interfaces:**

```ts
export type ConversionInput = {
  signalId: string;
  ownerId: string;
  reviewId: string;
  singleEventReason: string | null;
};
export type ConversionResult = { pursuitId: string; created: boolean };
export function convertResearchLead(input: ConversionInput, actorId: string): Promise<ConversionResult>;
```

- [ ] Add an integration test against an isolated database that invokes conversion twice concurrently and expects the same pursuit ID with exactly one created pursuit. Add separate tests for withdrawn evidence, suppression, unreviewed findings and missing single-event rationale.
- [ ] Create `research_conversions(signal_id UNIQUE, pursuit_id UNIQUE, review_id, created_by, created_at)` with foreign keys. Conversion runs in a Postgres function: acquire a transaction-level advisory lock derived from the signal UUID; return an existing conversion if present; recheck actor role, available evidence, current review and suppression; insert pursuit, conversion link and activity; return the ID. Abort the entire transaction on any failed condition.
- [ ] Set pursuit source detail to `QCS research`, attach the investigation/signal IDs and a concise reviewed summary. Persist a dependency link from this derived summary to each source version. Reuse the existing stage enum and set stage `enquiry`. Require a valid director owner. Preserve original case/party roles. Activity records contain actor/action/target IDs, not source quotations or a historical copy of the summary.
- [ ] Record approval, dismissal, correction, merge and conversion decisions with actor, reason and version. A single compelling event can be converted with the recorded exception; two-source corroboration is a quality default, not a categorical bar to director judgement.
- [ ] The endpoint creates a pursuit only. It does not send email or contact the subject. Test existing pursuit/dossier behaviour and commit.

## Task 6: Reports, indexes, exports and withdrawal propagation

**Files:**

- Create `src/lib/research/reports.ts`, `src/lib/research/reports.test.ts`, `src/lib/research/exports.ts`, `src/lib/research/exports.test.ts`.
- Create `src/lib/research/invalidation.ts`, `src/lib/research/invalidation.test.ts`.
- Create `src/app/api/portal/research/reports/[id]/route.ts` and `src/app/api/portal/research/reports/[id]/export/route.ts` with tests.
- Add reports and report/evidence relations to workflow schema.

**Interfaces and safe export function:**

```ts
export type ResearchReport = {
  id: string; investigationId: string; runId: string;
  audience: "internal" | "external";
  status: "draft" | "reviewed" | "stale";
  findings: DraftFinding[];
  coverage: { sourceId: string; state: "complete" | "partial" | "unavailable"; note: string }[];
};
export function csvCell(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const safe = /^[\s]*[=+@-]/.test(raw) || /^[\t\r\n]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function invalidateResearchDependants(versionId: string): Promise<void>;
```

Import `DraftFinding` from `report-schema.ts`; do not redefine it in `reports.ts`.

- [ ] Add tests for `csvCell('=HYPERLINK("https://example.org")')`, quoted newlines and null. Add a report test where a source version becomes unavailable after generation: subsequent read/export must hide source-dependent content immediately.
- [ ] Generate Markdown, CSV and print-ready HTML from the same stored report model. Include source title, exact URL, passage locator, observed/publication/retrieval dates, review status and coverage. Retain original currencies and date FX conversions if a GBP equivalent is needed; do not silently combine mixed-currency values.
- [ ] Index reports must state the population, period, inclusion rules, duplicates removed and missing sources. Store counts with denominators. Gateway reports compare like cohorts; court indexes measure published material in the selected corpus, not all adjudications. Every chart/table links to contributing source records.
- [ ] Implement `invalidateResearchDependants`: consume the foundation outbox; mark dependent claims unavailable and reports stale; revoke export access and purge generated objects; remove cached source quotations from conversations; remove or regenerate the linked research-derived pursuit summary; recalculate signals; retain minimal audit metadata. Preserve independently supplied director notes, with a review flag if their provenance is uncertain. Queries always join source availability so a slow purge worker cannot serve withdrawn material. A restore/reindex job must apply tombstones before exposing restored content.
- [ ] External audience selection produces a reviewable draft, evaluates configured source rights and records the deciding director. Download is distinct from sending/publishing, which this task does not implement. Internal weekly watchlists are generated by a scheduled job and shown in the portal; no unsolicited email recipient list is introduced.
- [ ] Run export/invalidation tests, including a simulated purge failure and retry, and inspect one rendered HTML report with long organisation names and multiple same-domain citations. Commit.

## Task 7: Director interface and source-health views

**Files:**

- Create `src/app/(portal)/portal/research/page.tsx`, `src/app/(portal)/portal/research/investigations/[id]/page.tsx`, `src/app/(portal)/portal/research/signals/page.tsx`, `src/app/(portal)/portal/research/watchlists/page.tsx`, `src/app/(portal)/portal/research/sources/page.tsx`, `src/app/(portal)/portal/research/runs/page.tsx`.
- Create `src/components/portal/research/InvestigationForm.tsx`, `InvestigationView.tsx`, `EvidenceTable.tsx`, `SignalInbox.tsx`, `ScoreExplanation.tsx`, `ResearchTimeline.tsx`, `SourceHealth.tsx`, `RunStatus.tsx` and focused component tests.
- Modify `src/app/(portal)/portal/layout.tsx` for the Research navigation item.
- Integrate the case-law page and reader supplied by the source plan into Research navigation without duplicating them.

**Interfaces:** Components consume stored report/evidence/score types. They never query providers directly. Actions call authenticated route handlers and use server-returned actor/scope information.

- [ ] Add component tests for an unavailable source and provisional signal:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { SourceHealth } from "./SourceHealth";

it("distinguishes missing access from no findings", () => {
  render(<SourceHealth label="Court listings" state="unavailable" note="Source access is not configured" />);
  expect(screen.getByText("Source access is not configured")).toBeInTheDocument();
  expect(screen.queryByText("No disputes found")).not.toBeInTheDocument();
});
```

- [ ] Implement `SourceHealth({label,state,note}:{label:string;state:"complete"|"partial"|"unavailable";note:string})` as a labelled status block. Use this same vocabulary in report coverage and run views. Show fetched time and source period separately.
- [ ] Build investigation creation, evidence drill-down, score explanations, review actions, entity-match candidates, timeline, follow-up questions and pursuit conversion. All mutations show pending, success and failure states; retain input on recoverable errors. Use existing portal spacing/typography and accessible table/dialog patterns.
- [ ] Add Sources and Runs views for configuration, credentials-present state, last successful checkpoint, next attempt, failure reason, budget usage and cancellation. Never show credential values or raw provider errors containing secrets. A source marked unavailable stays visible.
- [ ] Verify keyboard navigation, named form controls, focus return after review dialogs, readable citations, long report content, loading states and client-role denial. Capture a local browser walkthrough of an investigation through reviewed conversion using synthetic data. Commit.

## Task 8: Outcome measurement and complete-system acceptance

**Files:**

- Create `src/lib/research/outcomes.ts`, `src/lib/research/outcomes.test.ts`, `src/lib/research/workflow.integration.test.ts`.
- Add `src/app/(portal)/portal/research/outcomes/page.tsx`.
- Update `README.md` and `docs/research-operations.md` with actual configured routes and job deployment instructions.

**Interfaces:**

```ts
export type OutcomeCounts = { reviewedSignals: number; conversations: number; proposals: number; instructions: number };
export function conversationRate(counts: OutcomeCounts): number | null {
  return counts.reviewedSignals === 0 ? null : counts.conversations / counts.reviewedSignals;
}
```

- [ ] Test zero denominator returns null and 5 conversations from 100 reviewed signals returns 0.05. Store cohort start/end and attribution period; count each originating signal once. Separate source acquisition date, review date and conversion date.
- [ ] Implement outcomes by joining reviewed signals, research conversions and explicit director-entered events. Label the 5% strategy threshold a trial criterion. Do not attribute a pre-existing pursuit to research merely because a company name matches.
- [ ] Run the full synthetic workflow: source page acquired, evidence committed, entity confirmed, claim proposed, duplicate news deduplicated, signal reviewed, report generated, pursuit converted and source later corrected. Expect report invalidation and one conversion record. Repeat with a failed source, expired lease, cancellation and client user.
- [ ] Run all 411 existing tests plus new tests, source ESLint and TypeScript. Resolve the existing `clientDomainId` fixture mismatch in coordination with the owner of that schema change before claiming a green type check. Add the explicit `clientDomainId: null` to its default fixture only if that change remains the intended schema. Do not revert the schema to make tests pass.
- [ ] Use a disposable database for migrations and a local synthetic S3 substitute/test prefix. Run a Next build only with migration side effects deliberately isolated. Inspect actual deployed scheduler/worker configuration separately; do not claim continuous monitoring merely because enqueue tests pass.
- [ ] Review the spec's R01 to R21 matrix against delivered tests. Record operational source access individually: live verified, fixture verified, import supported or unavailable. Commit reviewed code and documentation; production deployment and external publication remain distinct actions.

## Coverage and handoff

| Requirement | Task |
|---|---|
| R01 commissioning | 1 |
| R12 relationship review and unresolved identity presentation | 3 and 7, with source-plan resolver |
| R13 precise evidence and corrections | 2, 4 and 6, with foundation storage |
| R14 signals | 2 |
| R15 calendars | 3 |
| R16 referral channels | 3 |
| R17 review and pursuit conversion | 5 and 7 |
| R18 assistant | 4 |
| R19 reports and indexes | 6 |
| R20 monitoring visibility | 1, 6 and 7, with foundation scheduler |
| R21 outcomes | 8 |

After each task, stage only its enumerated files and the corresponding generated migration, then commit with `feat(research):` and a description of the delivered behaviour. Do not push until requested. Completion means the whole specified workflow passes acceptance and any unavailable live sources are explicitly identified, not silently counted as integrated.
