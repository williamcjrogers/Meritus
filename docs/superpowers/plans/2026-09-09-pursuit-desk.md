# Pursuit Desk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the lead-era partner portal with the directors' pursuit desk described in the spec: intake from the site form, an inbox and board on Home, a dossier per pursuit with a research brief and a questions drawer, all in the Meritus Via identity.

**Architecture:** Next.js 15 app router under `src/app/(portal)`; server components read through thin Drizzle modules in `src/lib/db/*`; mutations are server actions in `src/lib/portal/actions.ts` that revalidate `/portal`; long-running AI work runs in route handlers with `after()`; pure domain logic lives in `src/lib/portal`, `src/lib/brief` and `src/lib/questions` and is unit-tested with Vitest.

**Tech Stack:** Next 15.5, React 19, Tailwind 4, Clerk 7, Drizzle 0.45 on Neon (neon-http), Vercel Blob, AI SDK 7 through the Vercel AI Gateway, Resend, mammoth, postal-mime, Vitest 5 with Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-09-pursuit-desk-design.md` (read it first; the plan argues from it).

## Global Constraints

- British English in every string, comment and test name. Never an em dash anywhere.
- Dates: day month year ("09 September 2026"); all date logic in `Europe/London`.
- The word "lead" does not appear in new code, copy, routes or tests.
- No conflict-check stage or concept anywhere in the portal.
- Tokens only from `src/styles/globals.css`; no new colours. Secondary text on stone or parchment is `text-ink/70` or `text-green/80`, never `text-slate` at 14 px. Eyebrows on light surfaces: `font-mono text-[11px] tracking-[0.2em] uppercase text-green` with an `h-px bg-brass/15` rule beneath. Brass eyebrows only on the green sidebar.
- Form controls: `text-[16px] sm:text-[14px]`.
- Server actions return `{ ok: true }` or `{ ok: false, error }` and end with `revalidatePath("/portal", "layout")`. They never throw redirects.
- Every task: write the failing test first, run it, implement, run `npm test -- <file>` and `npx tsc --noEmit`, then stop. Do not run `git commit`; the orchestrator commits after each phase.
- Do not edit files outside the task's list except where the task says a file is shared.
- Already done and not to be redone: `src/lib/db/schema.ts`, the migration in `drizzle/`, `scripts/migrate.mjs`, `src/lib/db/{index,pursuits,activity,documents,briefs,questions,throttle}.ts` (extend, do not rewrite), Vitest config, dependencies.

---

## Phase 1: domain and services (Task 1 first, then Tasks 2 to 7 in parallel)

### Task 1: Stages, dates and board partition

**Files:**
- Create: `src/lib/portal/stages.ts`, `src/lib/portal/stages.test.ts`
- Create: `src/lib/portal/dates.ts`, `src/lib/portal/dates.test.ts`
- Create: `src/lib/portal/board.ts`, `src/lib/portal/board.test.ts`
- Modify: `src/lib/db/pursuits.ts` (add `listDeskPursuits`)

**Interfaces (produces):**

```ts
// stages.ts
import type { Activity, PursuitStage } from "@/lib/db/schema";
export const ACTIVE_STAGES: readonly PursuitStage[]; // enquiry, scoping, proposal
export const BOARD_STAGES: readonly ["enquiry", "scoping", "proposal"];
export const STAGE_LABELS: Record<PursuitStage, string>; // "Enquiry", "Scoping", "Proposal", "Instructed", "Declined", "Dormant"
export function stageLabel(stage: PursuitStage): string;
export function isActiveStage(stage: PursuitStage): boolean;
export function isPursuitStage(value: string): value is PursuitStage;
export function requiresReason(to: PursuitStage): boolean; // declined or dormant
export function validateMove(from: PursuitStage, to: PursuitStage, reason?: string | null): { ok: true } | { ok: false; error: string };
// errors: "Already at Scoping" when from === to; "Give a reason (at least three characters)" when required and shorter than 3 after trim
export function resolveReopenStage(activity: Activity[]): PursuitStage;
// latest stage_changed whose meta.to is declined or dormant -> meta.from if active, else "enquiry"

// dates.ts
export const TIME_ZONE = "Europe/London";
export function todayIso(now?: Date): string;               // "2026-09-09"
export function isOverdue(due: string | null | undefined, now?: Date): boolean; // due < today
export function daysInStage(stageChangedAt: Date, now?: Date): number;          // whole days, never negative
export function relativeLabel(date: Date, now?: Date): string; // "just now" (<1 min), "n minutes ago", "n hours ago", "yesterday", "n days ago" (<7), else fullDate
export function fullDate(date: Date): string;   // "09 September 2026"
export function shortDate(date: Date): string;  // "09 Sep 2026"
export function dateTime(date: Date): string;   // "09 Sep 14:02"
export function dueLabel(iso: string): string;  // "Fri 12 Sep"
export function longDayDate(date: Date): string; // "Tuesday 09 September 2026"

// board.ts
import type { Pursuit } from "@/lib/db/schema";
export type Scope = "mine" | "all";
export type BoardColumns = Record<"enquiry" | "scoping" | "proposal", Pursuit[]>;
export type DeskPartition = { inbox: Pursuit[]; revisit: Pursuit[]; board: BoardColumns; counts: Record<"enquiry" | "scoping" | "proposal", number> };
export function sortColumn(pursuits: Pursuit[], now?: Date): Pursuit[];
export function partitionDesk(pursuits: Pursuit[], opts: { scope: Scope; userId: string; now?: Date }): DeskPartition;
// inbox: ownerId null and stage active, oldest created first (never filtered by scope)
// revisit: stage dormant and isOverdue(nextActionDue), by due ascending (never filtered by scope)
// board: owned, active stage, scope "mine" keeps ownerId === userId; each column sortColumn'd; counts follow the filter
```

`listDeskPursuits()` in `src/lib/db/pursuits.ts` returns every pursuit whose stage is enquiry, scoping, proposal or dormant.

- [ ] **Step 1: stages.test.ts** covering every function above, including `resolveReopenStage` with an activity list containing a `stage_changed` from proposal to dormant (expect "proposal"), one from enquiry to declined (expect "enquiry"), and an empty list (expect "enquiry").
- [ ] **Step 2: run, see it fail.** `npm test -- src/lib/portal/stages.test.ts`
- [ ] **Step 3: implement stages.ts.**
- [ ] **Step 4: dates.test.ts** with `process.env.TZ` irrelevant: use `Intl.DateTimeFormat` with `timeZone: TIME_ZONE` inside the implementation and fix `vi.setSystemTime(new Date("2026-09-09T10:00:00Z"))`. Cases: todayIso; isOverdue for yesterday, today (false), tomorrow (false), null (false); daysInStage 0 for now, 3 for three days ago; relativeLabel for 30 seconds, 5 minutes, 3 hours, 26 hours ("yesterday"), 3 days, 10 days (full date); fullDate; dueLabel("2026-09-12") is "Fri 12 Sep".
- [ ] **Step 5: implement dates.ts.** Use `Intl.DateTimeFormat("en-GB", { timeZone })` parts; never rely on the machine zone.
- [ ] **Step 6: board.test.ts** with a `makePursuit(overrides)` factory: partition puts unowned enquiry in inbox, unowned scoping in inbox, owned proposal on board, dormant with past due in revisit, dormant with future due nowhere; scope "mine" hides other owners from board and counts but not from inbox; sortColumn orders overdue first by due, then dated, then oldest stageChangedAt.
- [ ] **Step 7: implement board.ts and `listDeskPursuits`.**
- [ ] **Step 8:** `npm test -- src/lib/portal` and `npx tsc --noEmit` pass.

### Task 2: Directors from Clerk

**Files:**
- Create: `src/lib/portal/directors.ts`, `src/lib/portal/directors.test.ts`

**Interfaces (produces):**

```ts
export type Director = { id: string; name: string; email: string; initials: string };
export function initialsFor(user: { firstName?: string | null; lastName?: string | null; email?: string | null }): string;
export async function listDirectors(): Promise<Director[]>; // [] when Clerk not configured; cached 5 minutes; 8-second timeout -> []
export async function getDirector(id: string | null | undefined): Promise<Director | null>;
export function directorInitials(directors: Director[], id: string | null | undefined): string; // initials or "—"
export function directorName(directors: Director[], id: string | null | undefined): string;     // name or "Unassigned"
export function __resetDirectorsCache(): void;
```

Implementation: `import { clerkClient } from "@clerk/nextjs/server"`; `const client = await clerkClient(); const { data } = await client.users.getUserList({ limit: 50 })`; primary email from `emailAddresses.find(e => e.id === primaryEmailAddressId)`; name is `firstName lastName` trimmed, else the email; sort by name. Wrap in `Promise.race` with an 8-second timer. Guard on `isClerkConfigured()`.

- [ ] **Step 1: test** with `vi.mock("@clerk/nextjs/server", ...)` returning two users and env vars set; assert initials ("WR" from William Rogers; "MA" from mateo@x.com when no names), the cache (second call does not call the client again), `__resetDirectorsCache`, empty list when unconfigured, and the timeout using fake timers.
- [ ] **Step 2 to 4:** fail, implement, pass. `npx tsc --noEmit`.

### Task 3: Intake, alerts and the contact route and form

**Files:**
- Create: `src/lib/portal/intake.ts`, `src/lib/portal/intake.test.ts`
- Create: `src/lib/portal/alerts.ts`
- Modify: `src/lib/db/throttle.ts` (rewrite the increment as one atomic upsert per key; add `purgeExpiredThrottle`)
- Modify: `src/lib/db/pursuits.ts` (add `findDoubleSubmissionCandidate`, `findRelatedPursuits`)
- Modify: `src/lib/db/activity.ts` (add `appendEnquiry` helper if useful)
- Rewrite: `src/app/api/contact/route.ts`; Create: `src/app/api/contact/route.test.ts` (`// @vitest-environment node`)
- Modify: `src/app/(marketing)/contact/ContactForm.tsx`; Create: `src/app/(marketing)/contact/ContactForm.test.tsx`
- Modify: `src/lib/env.ts` (add `isResendConfigured()`)

**Interfaces (produces):**

```ts
// intake.ts
export type EnquiryInput = { name: string; firm: string; email: string; disputeNature: string; approximateValue: string | null; forum: string | null; description: string | null };
export function parseEnquiry(body: unknown): { ok: true; data: EnquiryInput } | { ok: false; error: string }; // zod; trims; lower-cases email; "" -> null for optional selects; validates against CONTACT_FORM_OPTIONS
export function isHoneypotFilled(body: unknown): boolean;      // body.company_website non-empty
export function normaliseFirm(firm: string): string;           // lower-case, strip punctuation and legal suffixes (ltd, limited, llp, plc), collapse spaces
export function isDoubleSubmission(existing: Pursuit, input: EnquiryInput, now: Date): boolean; // same email, same normaliseFirm, stage enquiry, ownerId null, created within 24h
export function toPursuitValues(input: EnquiryInput, id: string, now: Date): NewPursuit; // source "site_form", createdBy "site", stage enquiry
export function toSubmission(input: EnquiryInput, now: Date): EnquirySubmission;
export function sanitiseSubject(firm: string): string;          // strip control chars and newlines, collapse spaces, max 80 chars
export function hashKey(prefix: "email" | "ip", value: string): string; // `${prefix}:${sha256 hex of lower-cased trimmed value}` via node:crypto
export function firstHop(forwardedFor: string | null): string; // first comma-separated value or "unknown"

// alerts.ts
export type AlertInput = { firm: string; disputeNature: string; approximateValue: string | null; forum: string | null; receivedAt: Date; pursuitUrl: string | null; related: boolean; notSaved?: EnquirySubmission };
export async function sendEnquiryAlert(input: AlertInput, recipients: string[]): Promise<AlertOutcome>;
// Resend with 8s AbortSignal.timeout; subject "New enquiry: <sanitised firm>" or "Further enquiry: ..."; plain text; no reply_to; returns {sentAt, recipients} | {error} | {skipped:"not_configured"}

// db/throttle.ts
export async function registerEnquiryAttempt(keys: { email: string; ip: string }, now?: Date): Promise<{ emailAllowed: boolean; ipAllowed: boolean; alertAllowed: boolean }>;
// one atomic upsert per key using sql`insert ... on conflict (key) do update ... returning count`; email window 24h cap 5, ip window 1h cap 20, global window 1h cap 60 (alertAllowed false above it)
export async function purgeExpiredThrottle(now?: Date): Promise<void>; // delete rows with window_start older than 24h

// db/pursuits.ts
export async function findDoubleSubmissionCandidate(email: string, now: Date): Promise<Pursuit | null>; // stage enquiry, ownerId null, created within 24h, most recent
export async function findRelatedPursuits(email: string | null, firmNormalised: string, excludeId?: string): Promise<Pursuit[]>; // same lower-cased email OR same normaliseFirm(firm) (compare in code over candidates fetched by email plus a lower(firm) ilike prefix), excluding the id
```

Route algorithm (`POST /api/contact`): read JSON; if honeypot filled return 200 `{ success: true }`; parse, 400 on error; throttle (keys from email and `x-forwarded-for`), 429 `{ error: "Too many enquiries" }` when email or ip not allowed; `store()` in try: candidate = findDoubleSubmissionCandidate; if candidate and isDoubleSubmission then addActivity enquiry_received on it and touchPursuit, else related = findRelatedPursuits, then `db.batch([insert pursuit, insert activity])` via a new `createPursuitWithEnquiry(values, activity)` in pursuits.ts; then `alert()` in try with recipients from `listDirectors()`; write outcome into the activity meta (update activity row: add `updateActivityMeta(id, meta)` in activity.ts); respond 200 if store or alert succeeded, 500 otherwise. Purge expired throttle rows after responding (call before return, ignore errors).

- [ ] **Step 1: intake.test.ts** covering parseEnquiry (valid, missing firm, bad nature, empty forum -> null, long description), honeypot, normaliseFirm ("Brewster Bye Architects Ltd." and "brewster bye architects" equal), isDoubleSubmission true and false cases (different firm; owned; 25 hours old), toPursuitValues fields, sanitiseSubject strips "\r\n" and truncates, hashKey deterministic and prefixed, firstHop.
- [ ] **Step 2 to 3:** fail, implement intake.ts and alerts.ts and the db additions.
- [ ] **Step 4: route.test.ts** with `vi.mock` for `@/lib/db/pursuits`, `@/lib/db/activity`, `@/lib/db/throttle`, `@/lib/portal/directors`, `@/lib/portal/alerts`: cases from spec 11 (both succeed 200 with alert meta sentAt; store throws but alert sends 200 and alert called with notSaved; alert returns error 200 with meta error; both fail 500; honeypot 200 and no store; 429 when emailAllowed false; alertAllowed false skips alert).
- [ ] **Step 5 to 6:** implement the route; pass.
- [ ] **Step 7: ContactForm.test.tsx** with `global.fetch` mocked: success shows "Thank you"; 429 shows the "several enquiries" copy; 500 shows the "could not send" copy and keeps typed values; the honeypot input exists, is empty, has tabIndex -1 and aria-hidden.
- [ ] **Step 8:** implement the form changes (keep react-hook-form; register `company_website`; branch on `res.status`; keep GA4 on 2xx only).
- [ ] **Step 9:** `npm test -- src/lib/portal/intake src/app` and `npx tsc --noEmit`.

### Task 4: The brief

**Files:**
- Modify: `src/lib/research/companies-house.ts` (add `fetchCompany`, `fetchOfficers`, `searchCompanies` with 10s timeouts; keep types)
- Create: `src/lib/brief/facts.ts`, `src/lib/brief/facts.test.ts`
- Create: `src/lib/brief/run-brief.ts`, `src/lib/brief/run-brief.test.ts`
- Create: `src/app/api/portal/pursuits/[id]/brief/route.ts`
- Create: `src/app/api/portal/companies-house/route.ts`
- Modify: `src/lib/db/briefs.ts` if a query is missing

**Interfaces (produces):**

```ts
// companies-house.ts
export type CompanyRecord = { companyNumber: string; title: string; status: string | null; incorporatedOn: string | null; address: string | null; sicCodes: string[]; hasCharges: boolean | null; accountsOverdue: boolean | null };
export async function fetchCompany(number: string): Promise<CompanyRecord | null>;
export async function fetchOfficers(number: string): Promise<BriefOfficer[]>;
export async function searchCompanies(name: string, limit?: number): Promise<CompanyCandidate[]>;
export function registerUrl(number: string): string; // https://find-and-update.company-information.service.gov.uk/company/<number>

// facts.ts
export function normaliseCompanyName(name: string): string; // same rules as normaliseFirm; import it from intake to keep one implementation
export function exactMatch(hits: CompanyCandidate[], subject: string): CompanyCandidate | null;
export function buildFacts(input: { subject: string; match: BriefFacts["match"]; company?: CompanyRecord | null; officers?: BriefOfficer[]; candidates?: CompanyCandidate[]; fetchedAt: Date }): BriefFacts;
export function normaliseAnalysis(lines: BriefAnalysisLine[], allowedUrls: string[], register: string | null): BriefAnalysisLine[];
export function acceptWebsite(candidate: string | null, sources: string[]): string | null; // normalizeWebsite; host must appear in a source
export const analysisSchema: z.ZodType<{ analysis: BriefAnalysisLine[]; summary: string; website: string | null }>;
export function briefPrompt(input: { subject: string; companyNumber: string | null; facts: BriefFacts | null; research: string | null; enquiry: string | null; nature: string | null; value: string | null; forum: string | null }): string; // wraps blocks in <companies_house>, <web_research>, <enquiry> with the data-not-instructions rule
export function researchPrompt(input: { subject: string; companyNumber: string | null; website: string | null; nature: string | null; value: string | null; forum: string | null }): string; // no enquiry summary

// run-brief.ts
export type BriefDeps = {
  getPursuit(id: string): Promise<Pursuit | null>;
  fetchCompany(number: string): Promise<CompanyRecord | null>;
  fetchOfficers(number: string): Promise<BriefOfficer[]>;
  searchCompanies(name: string): Promise<CompanyCandidate[]>;
  research(prompt: string): Promise<{ text: string; sources: string[] }>;
  analyse(prompt: string): Promise<{ analysis: BriefAnalysisLine[]; summary: string; website: string | null }>;
  completeBrief: typeof completeBrief; failBrief: typeof failBrief; addActivity: typeof addActivity; updatePursuit: typeof updatePursuit;
  companiesHouseConfigured(): boolean; now(): Date;
};
export function defaultBriefDeps(): BriefDeps; // wires companies-house.ts, searchWeb, generateText with Output.object(analysisSchema) and timeout { totalMs: 90_000 }
export async function runBrief(briefId: string, pursuitId: string, actorId: string, deps: BriefDeps): Promise<void>;
export function briefSubject(p: Pursuit): { name: string; number: string | null; isParty: boolean };
```

Routes: `GET .../brief` -> `expireStaleRuns`, then `{ latestRun, brief }`; `POST .../brief` -> guard user, expire, `createBriefRun`, `after(() => runBrief(...))`, 202 `{ id }`; `export const maxDuration = 120`. `GET /api/portal/companies-house?q=` -> guard user, `searchCompanies(q, 5)`, `{ candidates }` (503 when not configured).

- [ ] **Step 1: facts.test.ts**: exactMatch (single exact hit; two hits none; case and "Ltd" insensitive), buildFacts mapping and match flags, normaliseAnalysis rules (web line with unknown url -> reasoning/null; fact with reasoning -> inference; companies_house gets register url), acceptWebsite, briefPrompt contains the three blocks and the rule sentence, researchPrompt does not contain the enquiry text.
- [ ] **Step 2 to 3:** fail, implement facts.ts and companies-house additions.
- [ ] **Step 4: run-brief.test.ts** with stub deps: number known -> fetchCompany called, complete with match confirmed; no number and one exact hit -> updatePursuit called with companyNumber; no number and several hits -> candidates stored, no fetchCompany; research throws -> still complete with a "Web research unavailable" reasoning line; analyse throws -> failBrief called and completeBrief not; party set -> subject is party.
- [ ] **Step 5 to 6:** implement run-brief.ts and the routes; `npm test -- src/lib/brief`; `npx tsc --noEmit`.

### Task 5: The questions drawer service

**Files:**
- Create: `src/lib/questions/allowlist.ts`, `src/lib/questions/sources.ts`, `src/lib/questions/system-prompt.ts`, `src/lib/questions/questions.test.ts`
- Create: `src/app/api/portal/pursuits/[id]/questions/route.ts`

**Interfaces (produces):**

```ts
// allowlist.ts
export function isUrlPermitted(url: string, ctx: { website: string | null; briefSources: string[]; messageText: string }): boolean;
// sources.ts
export function collectSources(parts: UIMessagePart<any, any>[]): QuestionSource[]; // tool-search_web output.sources -> {label: host, url}; tool-read_document output.title -> {label: title}; de-duplicated
export function shouldPersist(event: { isAborted: boolean; outcome: { status: string }; text: string }): boolean;
export function finalText(message: UIMessage): string; // joined text parts, trimmed
// system-prompt.ts
export function buildSystemPrompt(input: { pursuit: Pursuit; brief: Brief | null; activity: Activity[]; documents: Array<{ id: string; title: string; hasText: boolean }>; directors: Director[] }): string;
```

Route: guard user and db and AI; load pursuit, brief (`latestCompleteBrief`), activity (20), documents; tools `search_web`, `read_brief`, `read_document`; `streamText({ model, system, messages: convertToModelMessages(messages), tools, stopWhen: stepCountIs(4), timeout: { toolMs: 45_000 } })`; `result.consumeStream()`; return `result.toUIMessageStreamResponse({ originalMessages: messages, onEnd: async ({ isAborted, outcome, responseMessage }) => { ... shouldPersist ... db.batch([...]) } })`; `maxDuration = 120`. Persist the last user message text and the answer with sources.

- [ ] **Step 1: questions.test.ts**: allowlist (same origin true; brief source true; typed in message true; other false; javascript: false), collectSources on a sample parts array, shouldPersist (aborted false; failed false; empty text false; completed non-empty true), buildSystemPrompt contains `<brief>` and `<activity>` blocks, the rule sentence, and "never say" wording, and omits raw meta JSON.
- [ ] **Step 2 to 4:** fail, implement, route; `npm test -- src/lib/questions`; `npx tsc --noEmit`.

### Task 6: File types and extraction

**Files:**
- Modify: `src/lib/portal/files.ts` (allow `.eml`, `.msg`; mimes `message/rfc822`, `application/vnd.ms-outlook`), `src/lib/research/extract-text.ts` (docx via `mammoth.extractRawText({ buffer })`, eml via `PostalMime.parse`), `src/lib/portal/upload.ts` (log `file_added` when scope is pursuit; signature gains `actorId` already present as `uploadedBy`)
- Create: `src/lib/portal/extract.test.ts` with small fixtures built in the test (a minimal .eml string; a .docx produced by zipping a minimal document.xml with `jszip`? No: build the docx fixture with mammoth-compatible minimal zip via `node:zlib`? Simpler: test docx path through a mocked mammoth, and test eml with a real string)
- Create: `src/app/api/portal/pursuits/[id]/documents/route.ts` (POST upload for a pursuit; 404 when pursuit missing)
- Modify: `src/lib/db/documents.ts` if needed

**Interfaces (produces):** `export function hasReadableText(doc: Pick<DocumentRow, "extractedText">): boolean;` in files.ts; `extractUploadText(file)` returns text for pdf, docx, eml, txt and null otherwise.

- [ ] **Steps:** test (eml header block "From:", "Subject:" then body; docx via mocked mammoth; msg returns null; allow-list accepts .eml and rejects .exe), fail, implement, pass, tsc.

### Task 7: Server actions

**Files:**
- Modify: `src/lib/portal/auth.ts` (add `requireActionUser`)
- Create: `src/lib/portal/actions.ts` (`"use server"`), `src/lib/portal/actions.test.ts` (`// @vitest-environment node`, mocks for db modules, `next/cache`, `@clerk/nextjs/server`)
- Modify: `src/lib/db/pursuits.ts` (add `takePursuitGuarded(id, ownerId)`, `declinePursuitGuarded(id, ownerId, now)` returning boolean; `createPursuitWithEnquiry` may already exist from Task 3, do not duplicate)

**Interfaces (produces):**

```ts
export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateResult = { ok: true; id: string } | { ok: false; error: string };
export type PursuitFormInput = { firm: string; contactName?: string; contactEmail?: string; contactPhone?: string; website?: string; companyNumber?: string; party?: string; partyCompanyNumber?: string; counterparty?: string; disputeNature: string; approximateValue?: string; forum?: string; source: "referral" | "introduction" | "existing_client" | "other"; sourceDetail?: string; summary?: string };
export async function createPursuit(input: PursuitFormInput): Promise<CreateResult>;
export async function updatePursuit(id: string, input: PursuitFormInput): Promise<ActionResult>;
export async function deletePursuit(id: string): Promise<ActionResult>; // deletes blobs (del) best-effort then row
export async function takePursuit(id: string): Promise<ActionResult>;   // guarded; error "Taken by <initials> a moment ago"
export async function declinePursuit(id: string, reason: string): Promise<ActionResult>; // guarded, from inbox
export async function movePursuit(id: string, to: PursuitStage, reason?: string, revisitDue?: string): Promise<ActionResult>; // validateMove; sets stageChangedAt; dormant + revisitDue sets nextActionDue; logs stage_changed
export async function reopenPursuit(id: string): Promise<ActionResult>; // resolveReopenStage; logs reopened
export async function setOwner(id: string, ownerId: string | null): Promise<ActionResult>; // logs assigned
export async function setNextAction(id: string, text: string, due: string | null): Promise<ActionResult>; // 140 chars; logs next_action_set
export async function addNote(id: string, body: string): Promise<ActionResult>; // 4000 chars
export async function saveAnswerAsNote(id: string, body: string): Promise<ActionResult>;
export async function clearQuestions(id: string): Promise<ActionResult>;
export async function setCompanyNumber(id: string, number: string, target: "firm" | "party"): Promise<ActionResult>;
```

- [ ] **Steps:** tests for validateMove wiring (reason missing -> error), take guard (guarded returns false -> error with initials from a mocked `listDirectors`), setNextAction length, addNote empty -> error, every action calls `revalidatePath("/portal", "layout")`; fail, implement, pass, tsc.

## Phase 2: interface (Task 8 first, then Tasks 9 and 10 in parallel, then Task 11)

### Task 8: Primitives, styles and layout

**Files:**
- Modify: `src/styles/globals.css` (add `.btn-secondary`, `.btn-quiet`, `.portal .btn-brass:hover { transform: none }`, `.portal-eyebrow`, `.panel-brackets` corner accents)
- Create in `src/components/portal/`: `Eyebrow.tsx`, `Panel.tsx`, `StagePill.tsx`, `OwnerAvatar.tsx`, `SlideOver.tsx`, `ConfirmDialog.tsx`, `MoveToMenu.tsx`, `MoveToMenu.test.tsx`, `MineAllToggle.tsx`
- Rewrite: `src/app/(portal)/portal/layout.tsx` (224 px rail, wordmark, "Pursuit desk" eyebrow, Home and Library links with brass left rule on active via a small client `NavLink`, foot with director name + `UserButton` appearance + Back to site; phone top bar; wraps children in `<div className="portal">`)
- Modify: `src/components/portal/SetupNotice.tsx` (copy: "invite the directors only")

**Interfaces (produces):**

```tsx
<Eyebrow>Inbox</Eyebrow>                       // green mono 11px uppercase + brass/15 rule; prop `tone="brass"` for the sidebar
<Panel title="Brief" actions={<.../>} eyebrow="Brief">...</Panel>  // parchment, green/10 border, corner brackets, padding 6
<StagePill stage="dormant" />                  // mono label; oxblood tint for declined, slate/ink for dormant, brass for instructed
<OwnerAvatar initials="WR" name="William Rogers" size="sm"|"md" current={boolean} />
<SlideOver open title onClose>children</SlideOver>   // <dialog> showModal; full width below md; 480px above
<ConfirmDialog open title body confirmLabel onConfirm onCancel danger />
<MoveToMenu current={stage} onMove={(to, reason?, revisitDue?) => Promise<ActionResult>} align="right" />  // role="menu"; reason field inline for declined/dormant; revisit date input for dormant
<MineAllToggle scope="all" />                  // writes cookie desk_scope and router.refresh()
```

- [ ] **Steps:** MoveToMenu.test.tsx (lists five other stages; choosing Declined shows the reason field and disables confirm under 3 chars; Dormant shows the revisit date; Escape closes and returns focus; onMove receives (to, reason, revisitDue)); implement; layout; `npx tsc --noEmit`; `npm run lint`.

### Task 9: Home

**Files:**
- Create in `src/components/portal/`: `Desk.tsx`, `InboxRow.tsx`, `InboxRow.test.tsx`, `RevisitRow.tsx`, `PursuitCard.tsx`, `Board.tsx`, `Board.test.tsx`, `StageList.tsx`, `PursuitForm.tsx`, `NewPursuitButton.tsx`
- Rewrite: `src/app/(portal)/portal/page.tsx`
- Modify: `src/lib/db/pursuits.ts` (`listByStage` already exists; add `listRelatedForPursuits(ids)` if the inbox "Previously" line needs it, or compute from `activity.meta.relatedPursuitIds` via `latestEnquiryActivities(ids)` in activity.ts)

**Interfaces (consumes):** `partitionDesk`, `listDeskPursuits`, `countByStage`, `listByStage`, `latestStageChanges`, `listDirectors`, actions `takePursuit`, `declinePursuit`, `movePursuit`, `reopenPursuit`, `createPursuit`.

**Interfaces (produces):**

```tsx
<Desk pursuits={Pursuit[]} related={Record<pursuitId, Array<{id, firm, stage, date}>>} alerts={Record<pursuitId, AlertOutcome | undefined>} directors={Director[]} userId={string} scope={Scope} now={ISO string} />
// client; useOptimistic over pursuits; renders inbox strip, revisit strip, MineAllToggle, Board
<InboxRow pursuit related alert directors onTake onDecline />   // article; firm link; Take, Decline buttons; inline reason; "Taken by MD a moment ago" state
<RevisitRow pursuit reopenStageLabel onReopen />
<PursuitCard pursuit directors onMove now />                      // article; group-hover Move to
<Board columns counts directors onMove now />
<StageList stage rows={Array<{pursuit, change?: Activity}>} directors />
<PursuitForm mode="create"|"edit" initial? onSubmit(input) />     // fields per spec 6; 16px/14px controls
```

Page: cookie `desk_scope`; `?stage=` renders `StageList` with a "Back to board" link; header with `longDayDate`, New pursuit button opening `SlideOver` + `PursuitForm`; empty state.

- [ ] **Steps:** InboxRow.test.tsx (Take calls onTake with id; Decline reveals reason and calls onDecline(id, reason); taken-by state renders when onTake resolves `{ok:false}`), Board.test.tsx (three columns with counts; overdue dot and word; "No next action"); implement; page; `npx tsc --noEmit`.

### Task 10: Pursuit page

**Files:**
- Create in `src/components/portal/`: `PursuitShell.tsx`, `Stepper.tsx`, `Stepper.test.tsx`, `NextActionField.tsx`, `NextActionField.test.tsx`, `BriefPanel.tsx`, `BriefPanel.test.tsx`, `CompanyPicker.tsx`, `ActivityTimeline.tsx`, `NoteBox.tsx`, `AskDrawer.tsx`, `PursuitHeader.tsx`, `OwnerSelect.tsx`
- Modify: `src/components/portal/FileList.tsx` (size, date, "text"/"no text" tag, `btn-secondary` upload)
- Create: `src/app/(portal)/portal/pursuits/[id]/page.tsx`, `src/app/(portal)/portal/pursuits/[id]/not-found.tsx`

**Interfaces (consumes):** everything from Phase 1 plus Task 8 primitives; brief route `GET/POST /api/portal/pursuits/[id]/brief`; companies-house route; questions route; actions.

**Interfaces (produces):**

```tsx
<PursuitShell pursuit directors userId related latestChange={Activity | null}>   // client; useOptimistic for stage and owner; renders PursuitHeader, Stepper or StagePill+Reopen, NextActionField, MoveToMenu, ··· menu (Edit -> SlideOver+PursuitForm, Delete -> ConfirmDialog)
<Stepper current onMove />           // ol of four buttons, aria-current="step", commits on click/Enter/Space
<NextActionField text due onSave />  // inline edit; Enter/blur saves; Escape cancels; 140 chars; dueLabel
<BriefPanel pursuitId subject={{name, number}} initial={{ latestRun, brief }} candidatesEndpoint onPick />  // six states; polls every 3s for up to 120s while running; Regenerate; Ask opens AskDrawer via a callback prop
<CompanyPicker query onPick />       // fetches /api/portal/companies-house?q=; five hits; Pick
<ActivityTimeline entries directors />   // kinds rendered per spec 7; enquiry entries expandable with "Alert not sent"
<NoteBox onSave />                   // 4000 chars; Cmd/Ctrl+Enter
<AskDrawer pursuitId initialMessages open onClose onSaveNote onClear />  // <dialog>; useChat + DefaultChatTransport; sources under answers; error under input
```

Page: loads pursuit (404 -> notFound), directors, activity, documents, latest run and complete brief, questions; `?` shortcut handled in `PursuitShell`.

- [ ] **Steps:** Stepper.test.tsx (four buttons; aria-current; click calls onMove; ArrowRight does not commit; Space commits), NextActionField.test.tsx, BriefPanel.test.tsx (none, running, complete, failed, complete+running notice, complete+failed notice; polling with fake timers stops after 120s and shows "Timed out"); implement; page; tsc.

### Task 11: Wiring, redirects, docs, gates

**Files:**
- Modify: `next.config.ts` (`redirects()`: `/portal/leads` -> `/portal`, `permanent: false`)
- Create: `README.md` portal section (one-off steps from spec 12; local dev; `npm run db:migrate`)
- Modify: `.env.example` (already has the Resend lines; verify)
- Delete: any remaining lead-era references (`grep -ri "lead" src --include=*.ts --include=*.tsx` must return only unrelated words)
- Run: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` (without DATABASE_URL the migrate step skips)

- [ ] **Steps:** implement; run all gates; fix anything they surface.

## Self-review notes

Spec coverage: 3 (Task 8, 11), 4 (done, Task 1 and 3 extend queries), 5 (Task 3), 6 (Task 9), 7 (Task 10), 8 (Tasks 4, 5), 9 (Task 8 and the components), 10 (Task 7), 11 (each task), 12 (Task 11). Type names are consistent across tasks: `Director`, `Scope`, `DeskPartition`, `ActionResult`, `PursuitFormInput`, `BriefDeps`, `QuestionSource`, `AlertOutcome`, `CompanyCandidate`, `CompanyRecord`.
