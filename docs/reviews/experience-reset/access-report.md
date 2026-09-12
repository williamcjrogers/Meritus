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
