# Meritus experience reset implementation plan

> Superseded for public scope and colour by the user's correction on 12 September 2026. Do not repeat the public redesign or monochrome palette. Follow `docs/reviews/experience-reset/scope-correction.md` and current `DESIGN.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Replace the public, access, client and internal experiences with the approved design and reliable role-separated journeys.

**Architecture:** Retain Next.js, Clerk, Resend, Neon, Research and S3 capabilities. Use one authoritative identity contract and safe destination resolver, three audience-specific shells and a canonical semantic CSS/component system. Preserve current company-wide client sharing and existing routes.

**Tech Stack:** Next.js 15.5.12, React 19.2.4, TypeScript, Tailwind 4, Clerk 7.9.1, Vitest 5, pnpm 11.25.0.

**Spec:** `docs/superpowers/specs/2026-09-12-meritus-experience-reset-design.md`

## Global constraints

- Baseline: `efd8849cac66cf8db622260983249482ca9c4f7c` in `/Users/williamrogers/Projects/Meritus/.worktrees/experience-reset`, branch `codex/meritus-experience-reset`.
- British English, sentence-case labels, no em dashes in authored copy. Keep user data and legal records unchanged.
- Preserve invite-only staff access and Resend client links. No new identity provider, public sign-up, role picker or client matter-management system.
- Preserve organisation-wide document scope, server-side cross-role and cross-domain checks, upload resumability and existing service contracts.
- Approved palette: Chalk `#FAFCFC`, White `#FFFFFF`, Flint `#263033`, Mineral blue `#26424C`, Mist `#E7ECEC`, Oxide `#A63A35`.
- Literata public headings, IBM Plex Sans working UI. At least 15 px ordinary app text and 13 px metadata. Visible focus, contrast, reduced motion, stable layout.
- Node commands use `corepack pnpm`. Dependencies are installed from the existing frozen pnpm lock, with no root-checkout dependency changes.
- Do not run a database-connected `pnpm build` accidentally: it invokes migrations. Local build has no DATABASE_URL. Preview uses current migration history only; add no database migration for this redesign.
- Every worker owns its assigned files, accommodates others and stages only those files. Workers do not spawn reviewers; controller owns independent review.

## Ownership and shared interfaces

| Owner | Files | Interface |
|---|---|---|
| Access | `src/lib/portal/{roles,auth,gate}.ts`, `src/lib/research/roles.ts`, middleware, access/client/sign-in/sign-up routes and components, new account/recovery routes, HeaderAuth/MobileAuth, root layout | Preserve `resolveIdentity`, portal/client guard public signatures where practical; centralise unavailable handling. Own Clerk root settings and font loading. |
| Design/workspace | `src/styles/globals.css`, new system CSS, `src/components/ui` shared primitives, portal components/routes, `DESIGN.md`, `UX-CONTRACT.md`, `premium-ui.json` | Shared `Button` keeps existing variant API; add optional busy/intent and native attributes. Shared semantic CSS variables, `.app-button`, `.app-field`, `.app-label`, `.app-status`, `.access-*`, `.client-*` documented. |
| Public site | Marketing routes, sections, Header/Footer/MobileNav, HallmarkLogo and public-facing UI compositions except shared Button/Field | Keep HeaderAuth/MobileAuth named imports and their existing prop signatures. Own `src/styles/marketing.css`; system owner imports it. No global token overrides. |
| Controller/integration | Plan, approved spec, verification harness/reports, setup and release | Builds and reviews the complete result. Any fixes go to owning worker. |

Root layout font bridge: IBM Plex Sans variable `--font-ibm-plex-sans`; Literata variable `--font-literata`. The system maps `--font-sans`, `--font-serif`, and compatibility aliases to these without retaining separate runtime fonts. Marketing owns no auth logic. Access owns no portal presentation beyond contract changes coordinated with system owner.

### Task 1: Authoritative access and complete client journey

**Files:** Modify the access-owner files above and their adjacent tests; add `src/lib/portal/destination.ts`, its tests, an account destination page, a temporary-unavailable recovery page and a shared access shell as needed. Existing access mail uses `src/lib/access/mail.ts`; preserve Resend API and security wording.

**Interfaces:** Consumers keep `requirePortalUser`, `requireClientUser`, `requireActionUser`, `requireResearchDirector`. One underlying resolver reads current backend metadata, with an 8,000 ms bounded timeout and request-local reuse only. Unavailability is distinct from null/unknown role. Pure destination code must not import server-only modules.

- [ ] Write and run failing destination tests:

```ts
import { describe, expect, it } from 'vitest';
import { destinationFor } from './destination';
describe('authorised destinations', () => {
  it('keeps each audience in its own experience', () => {
    expect(destinationFor('client', '/portal/research')).toBe('/client');
    expect(destinationFor('director', '/portal/actions?scope=mine')).toBe('/portal/actions?scope=mine');
    expect(destinationFor(null, '/portal')).toBe('/access/denied');
  });
  it.each(['https://evil.example', '//evil.example', '/\\evil.example', '/api/portal', '/portalish'])('rejects unsafe targets %s', target => {
    expect(destinationFor('director', target)).toBe('/portal');
  });
});
```

- [ ] Implement the pure boundary and safe local-return logic. The exact public signature is:

```ts
export function destinationFor(role: 'director' | 'client' | null, requested?: string | null): string;
```

Validate with URL parsing against a fixed local origin, reject off-origin, backslashes, control characters and API routes; match a full path segment under `/portal` or `/client`. Unentitled identities go to recovery. Middleware must preserve the original path and query when sending someone to sign-in.

- [ ] Replace the five-minute role cache with bounded authoritative resolution, preserve unknown-role denial, and update Research to consume the same result. Add tests where old director session claims disagree with current client metadata, where membership is revoked between requests and where the provider rejects/times out. Assert 503 for outages and 403 for confirmed forbidden APIs. Update direct page and action guards as well as middleware.
- [ ] Repair public auth destinations and global Clerk redirects. Use a dedicated account-resolution route if needed so a client is never directed through `/portal`. Remove contradictory public registration from ordinary staff sign-in while preserving ticketed invitation acceptance.
- [ ] Replace the access/client screens with the shared calm surface. Keep verified email visible, company visibility statement, uploads and receipt history. Staff visiting the client screen return to internal client documents. Add field validation, live errors, Change email and a 60-second resend cooldown; retain server throttles and generic access acknowledgement.
- [ ] Replace the existing `AccessContinue.test.tsx` test that expects an arbitrary session to skip ticket processing. Test no session, existing staff, existing different client, explicit account switching, expired/used/invalid ticket and retry after provider failure. Use provider-supported APIs; keep ticket only in memory while switching and clear it from the browser address after capture.
- [ ] Update `src/app/layout.tsx` to the specified two font variables and shared Clerk appearance tokens. Keep technical errors in logs; present useful recovery messages in ordinary UI.
- [ ] Run `corepack pnpm exec vitest run src/lib/portal src/lib/research/roles.test.ts src/lib/access src/components/access src/components/client src/app/api/access src/app/api/client`; typecheck changed contracts. Commit only owned files and record commands/results in `docs/reviews/experience-reset/access-report.md`.

### Task 2: Canonical design system and complete workspace migration

**Files:** Modify `src/styles/globals.css`, `src/components/ui/Button.tsx`, shared portal components and every `src/app/(portal)` screen. Add shared field/header/status primitives and canonical documentation. Preserve all data-loading and mutation services.

**Interfaces:** Runtime semantic variables own colours and geometry. Export `Button` with backward-compatible `variant='primary'|'secondary'|'ghost'`, plus native button attributes, intent and busy state. Link variant still accepts `href`. Use distinct `.access-shell`, `.client-shell`, `.workspace-shell` wrappers with shared controls, never client markup dependent on `.portal` for styling. Import the public owner's `marketing.css` once from the global stylesheet.

- [ ] Create `DESIGN.md`, `UX-CONTRACT.md` and a canonical capability map from the approved spec. Document native select/date ownership where currently used; preserve OS popup behaviour unless an existing accessible authored owner exists. Populate `premium-ui.json` with real verification commands and ownership paths.
- [ ] Implement the semantic runtime core and font mapping:

```css
:root {
  --surface: #ffffff;
  --canvas: #fafcfc;
  --text: #263033;
  --muted: #56666b;
  --primary: #26424c;
  --danger: #a63a35;
  --border: #b2bfc3;
  --focus: #22647b;
  --radius-control: 6px;
}
.app-field { color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-control); font: inherit; }
.app-field:focus-visible { outline: 2px solid var(--focus); outline-offset: 3px; }
```

These variables are the agreed minimum; complete semantic success/warning/disabled/scrollbar states. Use compatibility tokens only as migration adapters, not a second visual scheme. Remove grain/brackets from app surfaces and replace old CSS rules rather than adding competing patches. Map typography to the font variables loaded by the access owner.

- [ ] Add meaningful primitive tests, including busy-state duplicate prevention and accessible field errors:

```tsx
it('prevents another submit while saving', async () => {
  const submit = vi.fn();
  render(<Button busy onClick={submit}>Save action</Button>);
  expect(screen.getByRole('button', { name: /save action/i })).toBeDisabled();
  expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
});
```

- [ ] Rebuild PortalNavigation into a legible shared shell. Keep Home as the overview; group Pursuits and Prospects coherently; group Programmes and Library as resources; include Client documents. Provide mobile navigation and a clear account control. Preserve every existing route and active-state behaviour.
- [ ] Migrate Home, Actions and pursuit detail first, then Research and all advanced Research pages, Programmes, Library, Prospects and client-domain administration. Every page gets coherent headers, readable text, aligned actions and state surfaces. Keep Research's simple question workflow. Remove repeated Director/QCS/desk labels from authored copy without renaming domain identifiers or user data.
- [ ] Preserve action focus/recovery, upload and drawer behaviour. Repair native dialogs, unlabeled controls, lost errors and unsafe submit repetition in touched workflows using canonical primitives. Honour current API and lifecycle semantics.
- [ ] Run relevant portal component/page tests and typecheck. Inventory all page routes with shell/status in `docs/reviews/experience-reset/route-inventory.md`. Record exact verification in `workspace-report.md` and commit only owned files.

### Task 3: Complete public site redesign

**Files:** Own `src/app/(marketing)`, public Header/Footer/MobileNav, public UI compositions, HallmarkLogo and `src/styles/marketing.css`. Do not modify HeaderAuth/MobileAuth, root layout, shared Button/Field or global tokens. Coordinate shared public component ownership before edits.

**Interfaces:** Preserve route and hash targets, public enquiry API and client access route. HeaderAuth/MobileAuth retain current component signatures but provide role-aware links from Task 1. Use shared Button and semantic tokens from Task 2. Public font variables are available via root layout.

- [ ] Replace the repeated hero/slogan/band stack with a specific construction-advisory composition: clear service statement, expertise, an illustrative construction record and relevant enquiry/client access actions. Use semantic HTML/SVG for an explicitly illustrative programme/evidence composition; do not fabricate claims, case histories or results.
- [ ] Rebuild public navigation as Expertise, Approach, Insights and Contact with Client access distinct from staff sign-in. Preserve Services and sector hash navigation and a reachable credentials route. Make mobile navigation keyboard-operable, with focus return and Escape dismissal.
- [ ] Implement public CSS through owned classes and semantic tokens, not raw old palette utilities. Use Literata headlines, IBM Plex Sans body, left alignment and responsive compositions. Remove ambient scroll tickers and decorative grain. Retain a restrained distinctive visual signature.
- [ ] Carry the visual system through services, sectors, approach, insights/list/detail, credentials, contact and legal page shells. Preserve legal text, existing article content and enquiry semantics; remove unverified promotional figures from redesigned display sections.
- [ ] Keep ContactForm submission and honeypot contracts. Verify validation, success and error states, label associations, duplicate-submit prevention and client access discoverability. Add a focused navigation test:

```tsx
it('offers client access separately from the staff session entry', () => {
  render(<Header />);
  expect(screen.getByRole('link', { name: 'Client access' })).toHaveAttribute('href', '/access');
  expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');
});
```

- [ ] Run marketing/contact and navigation tests, typecheck owned files, inspect the public site at desktop/mobile via the controller browser, then record results in `public-report.md` and commit owned files.

### Task 4: Independent review, integration and release verification

**Files:** Reports, `docs/reviews/experience-reset`, test harness and package verification scripts only. Implementation fixes remain assigned to their owner and receive a scoped review.

**Interfaces:** Consume all reports and the complete branch diff against `efd8849`. Reuse actual components in any local fixture harness; do not ship authentication bypasses or fabricated data in production routes.

- [ ] Run independent code review over Task 1 for authentication, sharing and error handling; run independent design/code review over Tasks 2 and 3 for whole-spec coverage and usable states. Send concrete findings to the relevant owner and verify the fixes.
- [ ] Run `corepack pnpm test`, `corepack pnpm exec tsc --noEmit`, `corepack pnpm lint`, then a local production build with no database URL. Capture logs in the review folder.
- [ ] Run the Premium strict static audit with a report path inside `docs/reviews/experience-reset`; resolve applicable findings and distinguish limitations of static evidence from browser verification.
- [ ] Exercise live local routes and actual components: public home/services/contact, sign-in/access, client documents, Home, pursuit, Actions, Research, Programmes and Library. Verify desktop, 390 px mobile, long labels, empty/error/pending, keyboard focus, accessible controls, reduced motion and zoom. Save representative screenshots.
- [ ] Inspect existing Vercel/Clerk configuration read-only, identify any external configuration required by the implemented access flow and apply only changes already authorised by the redesign. Do not invite people, send messages or widen access to obtain test coverage.
- [ ] Deploy a coherent preview, verify its build and reachable routes, and check the real authentication flow with existing authorised accounts where available. Record any real identity step that cannot be verified without user interaction; do not report synthetic component evidence as a live account test.
- [ ] Review the complete branch and current remote state. Complete the authorised safe landing and production verification when the release checks pass. Preserve review evidence and identify the final deployed revision.

## Review and completion tracking

The progress ledger is `docs/reviews/experience-reset/progress.md`. It records task status, commit IDs, review findings, fixes, test evidence and material decisions. Keep reports in this project folder rather than temporary storage. Re-read the ledger after context compaction before dispatching more work.
