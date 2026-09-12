# Access implementation report

Date: 12 September 2026
Branch: `codex/meritus-experience-reset`
Baseline: `efd8849cac66cf8db622260983249482ca9c4f7c`

## Implemented

- Added a pure local destination resolver, with full path-segment checks, URL parsing and rejection of external targets, API paths, backslashes, control characters and ambiguous encoded paths. `/account` resolves the current role before redirecting. Public signed-in navigation uses Account, so a client never passes through the workspace landing page.
- Replaced session-claim authority and the five-minute process cache with a current Clerk backend lookup for every protected operation. The lookup has an 8,000 ms bound. No authority cache is retained, including between background Research checks. Unknown roles and confirmed missing accounts remain denied; provider failures are a distinct 503. Verified primary email is the displayed identity.
- Portal/client API guards, server actions, middleware, direct page guards and Research use this authority. Middleware preserves the original local path and query through sign-in or verification recovery. Staff visiting the client page are sent directly to internal Client documents.
- Added calm access, unavailable and denial shells, client loading/error states, labelled email validation, stable generic acknowledgement, Change email, 60-second resend cooldown and duplicate-submit protection. Existing server throttles and the generic listed/unlisted response remain intact.
- Client links retain a safe client return destination. A ticket is captured into component memory and immediately removed from the address bar. Existing accounts are displayed with explicit Keep current account or Sign out and use this link choices. Provider-supported sign-out callback, legacy ticket exchange and session activation APIs are used. Activation retries retain the created session ID and do not redeem a single-use ticket twice. Expired, used, invalid and temporary failure states have distinct recovery copy.
- Ordinary staff sign-in has no public registration action. Invitation entry requires the invitation ticket and provides an explicit account choice for existing sessions. Provider forms use hash routing so intermediate steps do not discard the original safe return or invitation query.
- Added `ClientDocumentsView` for the production client page and the controller's local fixture harness. The organisation, verified email, existing organisation-wide visibility, upload control and receipt history share the client shell. Upload byte completion is shown as Confirming receipt until server completion succeeds. Upload failures have retry actions and no raw storage diagnostics.
- Root fonts are IBM Plex Sans (`--font-ibm-plex-sans`) and Literata (`--font-literata`). Clerk appearance adapts the shared semantic CSS variables. Access and client screens have no dependency on the portal shell.

## Preserved behaviour and limits

- Resend sender, API, single-use 30-minute links and generic access acknowledgement are unchanged. No messages, invitations or access grants were sent during implementation.
- Existing organisation-wide submission visibility and cross-domain upload guards are unchanged. Client documents are a delivery service, not a matter-management system.
- Existing upload limit remains 50 GB per file as labelled by the service (50 × 1024³ bytes), with 32 MiB multipart chunks, three concurrent part uploads by default and existing local resume IDs. These are service limits, not new policy.
- No database migration, build, deployment or provider-setting mutation was run by this worker.

## Verification

- Initial destination test run failed because the new destination module did not yet exist. Implemented the boundary, then verified its cases.
- `corepack pnpm exec vitest run src/lib/portal src/lib/research/roles.test.ts src/lib/access src/components/access src/components/client src/app/access src/app/client src/app/account src/app/api/access src/app/api/client`: 31 files, 359 tests passed. Log: `access-tests.log`.
- `corepack pnpm exec tsc --noEmit`: passed. Log: `access-typecheck.log`.
- Scoped `corepack pnpm exec eslint` across owned implementation files: passed with no warnings. Log: `access-lint.log`.
- Tests include stale staff claims against current client metadata, next-operation revocation, deleted accounts, provider rejection and timeout, API/action outage handling, direct client-page gates, safe account destinations, different existing account identities, explicit switching, incomplete/expired/used/invalid tickets, provider retry, activation retry, duplicate prevention, email validation/cooldown, removed organisation access, receipt confirmation and existing cross-domain API coverage.
- Controller reported the real `ClientDocumentsView` and `AccessShell` looked clean at 390 px, and exercised local synthetic acknowledgement/cooldown/change-email/error states. These are fixture checks, not authenticated live-account evidence.

## Integration and release checks

- Full application tests, production build, Premium strict audit and broad browser checks remain owned by the controller. Workspace owner supplies global tokens, client/access styles, shared primitives and maintained design contracts.
- The controller's read-only provider inspection found public sign-up enabled. The source route guard and hidden widget action do not establish restricted registration at the provider. Restricted mode and hosted configuration must be corrected and verified before release. No new roles are assigned by the source sign-up route.
- Actual hosted invitation acceptance, real emailed ticket exchange, existing-session switching and real provider outages need live-account verification. Component tests mock the provider and do not prove that external configuration works.
- On a full browser reload after ticket capture, the ticket is deliberately unavailable; the user must reopen the email or request another link. It is never persisted to browser storage.

## Independent review fixes

Completed both P2 findings on 12 September 2026:

- Clerk's documented `sign_in_token_revoked_code` and `sign_in_token_cannot_be_used_code` now produce terminal recovery with Request a new link. `sign_in_token_not_in_sign_in_code` also has terminal recovery. Existing documented used-token codes remain recognised. None offers Retry against an unusable token. Source: [Clerk frontend API errors](https://clerk.com/docs/guides/development/errors/frontend-api#sign-in-tokens).
- Middleware now overwrites or removes `x-meritus-page-path` using the actual requested pathname and query. It never accepts a caller-supplied destination header. The page guard validates the value through the existing local path boundary and checks that it belongs to the intended experience. The header only carries a return target, never authority.
- `requireWorkspacePage` performs a fresh role lookup and redirects page failures to the deliberate unavailable, sign-in or denial journey. All 12 existing page/layout guard callers use it, including Home, Actions, Pursuits, Programmes, Library, Prospects and Research. Research APIs and background workers retain their typed 401/403/503 contract. Redundant unguarded session lookups used only to obtain a display/filter user ID were replaced with the already-authorised user ID.
- Integration tests explicitly pass middleware, then fail the next provider lookup or revoke the role before the page guard. They verify the original path and full query are preserved for temporary failure/session expiry, that current client or null roles are refused appropriately, and that spoofed headers cannot replace the actual route.

Ownership coordination: the workspace owner completed the portal presentation and route-metadata edits, then explicitly excluded every `src/app/(portal)` path from their Task 2 commit. This access review commit includes those agreed presentation changes together with the page guard integration. The access worker changed guard imports/calls and redundant user-ID lookups; the workspace owner authored the presentation and metadata.

Verification after these fixes:

- `corepack pnpm exec vitest run src/lib/portal src/lib/research/roles.test.ts src/lib/access src/components/access src/components/client src/app/access src/app/client src/app/account src/app/api/access src/app/api/client 'src/app/(portal)'`: 33 files, 382 tests passed. Log: `access-review-tests.log`.
- `corepack pnpm exec tsc --noEmit`: passed. Log: `access-review-typecheck.log`.
- `corepack pnpm exec eslint src/lib/portal/auth.ts src/lib/portal/request-path.ts src/lib/portal/page-auth.test.ts src/middleware.ts src/components/access/AccessContinue.tsx src/components/access/AccessContinue.test.tsx 'src/app/(portal)'`: passed without warnings. Log: `access-review-lint.log`.
- `git diff --check`: passed.

The live provider configuration and authenticated journey limitations above remain unchanged.

## Nested reader recovery correction

A subsequent independent review found typed access errors raised inside protected readers after the page entry guard had succeeded. The entry guard could not translate errors it did not receive, and an asynchronously rendered child required its own recovery boundary.

Added `src/lib/portal/page-access.ts`, a page-only translator for `ResearchAccessError` 401, 403 and 503. It retains the validated actual request path/query for sign-in and temporary verification failure; confirmed denial opens the deliberate account-access page. Unrelated errors retain their existing handling. Shared backend readers, APIs and workers contain no routing changes and retain their typed errors.

Applied the boundary to Home's `readDashboard`, live leads' `readLiveLeads`, pursuit detail's `pursuitResearchLink` and `readRelatedActions`, investigation `getInvestigation`, and the independently rendered `RelatedActionPanel`. The related panel has a page-aware entry guard and translates later access errors before its ordinary load-error fallback. Actions register/direct-editor catches now also translate typed access errors instead of reducing them to a generic load failure.

Verification:

- Actual Home page plus actual `readDashboard` tests prove the page guard succeeds, then a subsequent provider failure, session expiry or role change produces the correct 503/401/403 page recovery. A direct backend-reader test confirms the typed 503 still escapes for non-page callers.
- Async related-panel tests exercise later 503/401/403 after successful entry. Actions tests exercise both register and direct-editor readers for the same three typed errors. Existing ordinary database-failure fallback tests still pass.
- `corepack pnpm exec vitest run src/lib/portal src/lib/research/roles.test.ts src/lib/dashboard/read.test.ts src/lib/access src/components/access src/components/client src/components/portal/actions/RelatedActionPanel.test.tsx src/app/access src/app/client src/app/account src/app/api/access src/app/api/client 'src/app/(portal)'`: 36 files, 406 tests passed. Log: `nested-access-tests.log`.
- `corepack pnpm exec tsc --noEmit`: passed. Log: `nested-access-typecheck.log`.
- Scoped ESLint across the new translator, changed pages and related-panel implementation/tests: passed without warnings. Log: `nested-access-lint.log`.
- No shared backend function, API route, worker or permission policy was changed for this correction.

## Live-preview control-size adjustment

The controller measured the deployed Clerk Google button at 36 px and show-password control at 38 px. Root Clerk appearance now gives social buttons a 44 px minimum height, the password visibility toggle a 44 × 44 px minimum target, and the account trigger a 44 × 44 px minimum target. The social button uses the canonical surface, field-border, text and hover tokens.

The primary button retains the shared `app-button` class. A scoped Clerk root appearance rule removes residual gradient images and shadows from that button and its decorative pseudo-elements. Clerk branding and authentication behaviour are unchanged.

- `corepack pnpm exec tsc --noEmit`: passed (`clerk-controls-typecheck.log`).
- `corepack pnpm exec eslint src/app/layout.tsx`: passed (`clerk-controls-lint.log`).
- `git diff --check -- src/app/layout.tsx`: passed.
- Updated deployed target measurements and gradient removal remain for the controller's final browser verification.
