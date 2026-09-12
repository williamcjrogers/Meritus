# Meritus experience reset

Date: 12 September 2026
Status: Superseded for public scope and colour. On 12 September 2026 the user clarified that the requested changes concerned the internal system, rejected the public redesign and rejected monochrome treatment in the internal system. The public redesign was an incorrect interpretation of scope. Follow `docs/reviews/experience-reset/scope-correction.md` and the current `DESIGN.md`; retain the access and workflow repairs.
Product repository: `williamcjrogers/Meritus`
Verified production revision: `efd8849cac66cf8db622260983249482ca9c4f7c`

## Decision

Replace the whole experience: public website, access, client documents and internal workspace. Retain the working services, records and integrations beneath it. This is a new information architecture and design system, including complete authentication and recovery journeys.

The user's rejection applies to the current appearance and process across the deployment. The new design must not inherit the present green-and-parchment application styling, decorative brackets, grain, small monospaced labels or repeated descriptions of directors.

## Evidence and limits

The production alias `https://www.meritusvia.com` was checked through Vercel. Deployment `dpl_C53o8XhasrF7TpVuomUw6YioM2PR` is READY and identifies the revision above. The local main checkout is older; the audit used `origin/main` at the verified production revision.

Live browser inspection covered the public home, mobile navigation, staff sign-in and client access. Authenticated workspace findings are based on the verified source revision, with an existing synthetic Home screenshot used only as supplementary design evidence. A real authenticated staff/client journey has not been tested in this audit. No cross-role disclosure of internal records has been established.

| Confirmed problem | Evidence at the production revision | Required correction |
|---|---|---|
| Public Login leads to Partner sign in; invitation-only instructions coexist with a Sign up link | Live `/sign-in`; `src/app/sign-in/[[...sign-in]]/page.tsx` | Purposeful entry, invitation acceptance and recovery states with consistent names |
| Client access label and input boundary are almost invisible | Live `/access`; `AccessForm.tsx:45,53`; `globals.css:461-497` | Shared field primitives with explicit surface variants and checked contrast |
| All authenticated visitors receive an internal Portal link | `HeaderAuth.tsx:22-31`; `MobileAuth.tsx:20-29` | Identity-aware destination and label |
| Global authentication redirects force `/portal` and lose intended destinations | `src/app/layout.tsx:127-133` | Validated return destinations within the authorised experience |
| An existing session causes an emailed client ticket to be ignored | `AccessContinue.tsx:22-38` | Explicit account handling; no silent reuse of the wrong identity |
| Portal and Research use different role authorities | `src/lib/portal/roles.ts:57-68`; `src/lib/research/roles.ts:14-42` | One authoritative policy for protected reads and mutations |
| Identity-provider failure looks like lack of permission | `roles.ts:62-68`; `gate.ts:37-45`; access denied page | Separate temporary verification failure from a confirmed access refusal |
| Director language appears throughout ordinary journeys | Access pages, client page, portal navigation and Home heading | Natural task labels; private permission identifiers stay internal |
| Shared and newer screens have conflicting type, panels, spacing and controls | Global CSS, Panel, Home and Research components | One canonical system, applied across the route inventory |

## Product boundaries

Three experiences share the Meritus identity and shared accessible components. Each has its own shell, navigation and responsibilities.

| Experience | Primary job | First screen and navigation |
|---|---|---|
| Public website | Explain expertise and help a visitor make a relevant enquiry | Expertise, Approach, Insights, Contact; a clear Client access action; existing sector and credential content remains reachable |
| Client documents | Send documentation and confirm receipt | Organisation name, signed-in email, Send documents, recent submissions and Account |
| Meritus workspace | Develop pursuits, manage follow-up and perform preliminary analysis | Home, Actions, Pursuits, Research and Client documents, with Programmes and Library grouped as resources and administration in Settings |

Keep existing URLs as compatibility routes. Navigation can improve without breaking bookmarks or email links. Do not create separate deployments or duplicate authentication providers merely to separate the appearance.

Home remains the operating overview requested previously. It must show attention, upcoming dates, ownership and progress. It must not become the pursuit board again. Live leads remains a distinct view under Pursuits; Prospects remains reachable within that commercial workflow.

Pursuit detail uses a consistent Brief, Questions, Documents, Activity and Actions structure. The brief remains the first substantive view. Research retains question submission, background processing, source links, saved opportunities and optional daily updates. Advanced collection and source configuration sit within Research settings.

Client documents remain a document-delivery service. Do not invent a client case-management system, expose internal pursuit analysis, rename pursuits as instructed matters or duplicate VeriCase. Instructed evidence and substantive case management retain their existing VeriCase boundary.

## Access design

### Client entry

Public Client access opens `/access`. The page has a small wordmark, the title Send documents, a labelled work-email field and Send me a link. It contains no internal role explanations or staff sign-in widget.

Clients keep Resend email links and the existing Clerk session after exchange. Preserve the work-email domain access model and generic response that avoids disclosing which organisations have access. Preserve throttling and verified-email protections. There is no password or public account-creation path for clients.

After submission, show a stable confirmation view with the entered email, Change email and a bounded resend control. Explain expiry in plain language. Transport failure, throttling and invalid input must be recoverable without losing the email value.

After successful verification, open Client documents. The page names the organisation and signed-in email, explains the existing visibility of submissions and offers upload and receipt history. Show received, uploading, processing, failed and retryable states truthfully. Preserve existing upload size, resumability and storage behaviour; document current limits from the implementation before changing their presentation.

### Staff entry and invitation

Staff access uses a dedicated sign-in route and the existing invite-only Clerk mechanism. The title is Sign in to Meritus. Invitations open Accept your invitation. An ordinary sign-in screen does not show contradictory public registration or instructions for repairing a different journey.

Use supported provider customisation to align the interface. Provider configuration that cannot be changed in source must be identified and verified separately. Do not claim that a hidden Sign up link establishes invite-only server enforcement.

Successful staff sign-in returns to the permitted deep link or Home. Successful client sign-in returns to the permitted client destination. Return targets must be local, allowlisted by experience and checked after authentication. Clients must not pass through the staff landing page.

### Account, session and recovery

An incoming client link must never be silently discarded because a session exists. If continuing would use an existing account, show that identity and make the choice explicit. Switching accounts requires an intentional action and the provider-supported sign-out and ticket-exchange sequence. Never silently switch a staff user or reuse another client's organisation. Do not expose ticket values in analytics, logs or persistent browser storage.

Distinguish these states: invalid link, expired link, link already used, wrong account, confirmed lack of access, removed organisation and temporary verification failure. Each has one relevant recovery action. Temporary provider failure offers Retry and leaves the correct destination intact; it must not tell the user that permission has been removed.

An unauthorised direct page visit receives a deliberate recovery page with its authorised destination. APIs keep machine-readable 401/403 responses. An outage is represented separately. No password entry, role choice or URL parameter grants a permission.

The internal role identifiers `director` and `client` can remain in the data model. Ordinary product copy uses the task, account or organisation, not the identifier. Existing staff privileges to inspect client submissions remain internal. Staff should see submissions in the workspace rather than landing in a client screen that explains why they are in the wrong place.

### Authorisation and existing sharing policy

Use one server-side identity and entitlement contract across middleware, pages, APIs, server actions, downloads, uploads and Research. Critical checks must use current authoritative membership and fail closed on lookup failure. Rendering can share a request-local result; a five-minute process cache must not override a confirmed revocation. Record the chosen freshness and timeout behaviour in the implementation plan and test it explicitly.

The current client policy is organisation-wide: eligible colleagues can see submission metadata for their company, and uploads are authorised by domain. Preserve that scope for this redesign and state it clearly in the client experience. Matter-specific membership or per-user upload ownership is a separate product/security change; do not silently introduce or imply it through the visual design.

## Visual direction

The recommended direction takes its character from clear construction records and careful advisory work. Public expression can be distinctive; working screens must make actions, evidence, responsibility and dates immediately readable.

| Token | Proposed value | Use |
|---|---|---|
| Chalk | `#FAFCFC` | Main canvas and light work surfaces |
| White | `#FFFFFF` | Fields and focused content |
| Flint | `#263033` | Primary text and wordmark |
| Mineral blue | `#26424C` | Primary actions and selected navigation |
| Mist | `#E7ECEC` | Secondary surfaces and boundaries where contrast is sufficient |
| Oxide | `#A63A35` | Overdue work and errors, with text and icons |

These are a proposed base palette, not proof of accessibility. Semantic success, warning, disabled, focus and border tokens must be completed and contrast-tested during implementation. Decorative boundary colours must not substitute for accessible input boundaries.

Use Literata for considered public headings and IBM Plex Sans for explanation and application UI, subject to rendered validation and loading performance. Use tabular numerals for dates and amounts, not a separate miniature monospace system. Application body text starts at 15-16 px; operational metadata is normally at least 13-14 px. Labels use sentence case. Public headings may have scale; application headings remain proportionate to their content.

Public layouts use generous, left-aligned compositions. A single characteristic visual can combine an illustrative programme fragment, drawing detail and evidence reference. Use approved or clearly illustrative material; never fabricate a real case or result. Remove unsupported numerical claims and decorative slogan repetition unless evidence supports a useful statement.

Application layouts use aligned rows, clear local hierarchy and consistent page headers. Use restrained 6 px control rounding, limited elevation for overlays and generous separation between sections. Cards represent real bounded units, not every paragraph or statistic. On narrow screens, show priority fields first and preserve access to the remaining information. Full-screen dark green, parchment, grain, gold small text, bracket decoration and repeated uppercase labels are retired from operational surfaces.

The identifying moment is the finding beside its evidence, or the action beside its owner and date. Animation responds to a user's action and explains a change. There is no ambient motion in the workspace.

## Shared system and behaviour

Create a project-root `DESIGN.md` and `UX-CONTRACT.md` once this direction is approved. Runtime semantic CSS tokens remain the canonical value source, with documented mappings to shared components and drift checks. Do not create a second independent colour system inside provider customisation.

Resolve canonical owners for PageHeader, Button, Field, Section, Status, account navigation, Dialog, Toast, Select, Date input and file-upload feedback. Accessible native controls remain valid where their platform behaviour is deliberately accepted; authored controls require keyboard and popup verification. Client and internal shells must not depend on classes named for the other audience.

For every changed workflow, define trigger, pending state, success destination, feedback and failure recovery. Preserve input and safe draft state on errors. Prevent duplicate submission. Reserve geometry for progress and errors. Keep focus visible, return focus after overlays, respect reduced motion and support password managers and paste. Use inline errors for corrections and one shared live-region notification system for acknowledgements.

## Options considered

| Option | Assessment |
|---|---|
| Complete experience reset within the current application, recommended | Corrects the journeys, information architecture and visual system while retaining data and services. Requires representative screens and cross-role checks before release. |
| Minimal website and two simple utility interfaces | Faster and lower visual ambition, but less distinctive and unlikely to satisfy the rejection of the whole experience. |
| Separately deployed public, client and internal products | Enables independent releases, but adds operational and authentication complexity. Separate deployments do not by themselves enforce permissions. Current evidence does not justify this additional architecture. |

## Delivery sequence after approval

1. Write the detailed implementation plan from this approved design, pinned to the verified production baseline. Reconcile any subsequent remote changes before implementation.
2. Establish the canonical identity/destination contract and regression tests for the currently broken access journeys.
3. Establish shared tokens, primitives and three shells. Implement and inspect representative public, sign-in, client documents, Home and Research screens before migrating the remainder.
4. Apply the complete system to every existing route, its overlays, emails, empty states and recovery views. Retain existing capabilities and records. Audit authored product copy; avoid global replacement inside user data or official records.
5. Release a coherent preview after independent code and design review. Verify the actual provider configuration, invitation acceptance, client ticket exchange and real signed-in journeys on that preview.
6. Run the full release checks and publish only the reviewed, verified result. Record the deployed commit, migration outcome if relevant and post-release journey evidence.

No product code has been implemented under this proposal. The detailed writing-plans stage follows approval, as required by the requested brainstorming workflow.

## Acceptance criteria

- Every public, access, client and internal route is inventoried and mapped to a shared shell and component system.
- A visitor, invited staff member and authorised client reach the correct destination without role self-selection, a wrong-area detour or contradictory instructions.
- Public and mobile navigation resolve to the correct experience for each authenticated identity.
- Invitations, fresh sign-in, deep links, ticket expiry, used tickets, conflicting sessions, sign-out, removed access and provider outages have verified recovery paths.
- No client can read internal pages, server-action results, API responses, Research data or downloads. Cross-domain file operations are rejected server-side.
- Existing organisation-wide sharing is described accurately; the interface does not imply matter-level confidentiality that the service does not provide.
- No unnecessary director, partner-login, client-versus-director explanation, provider setup instruction or backend configuration name appears in ordinary user journeys.
- All existing useful Home, Actions, Pursuits, Prospects, Research, Programmes, Library and client-upload behaviours and records remain accounted for.
- Controls, text, validation, progress, empty states, errors and overlays pass keyboard and contrast checks. Verify desktop, narrow mobile, long content, 200% zoom and reduced motion.
- Run repository lint, typecheck, relevant tests, full tests and a production build with the build-time database migration side effect understood and pointed only at the authorised target. A build must not become an accidental production migration.
- Run the Frontend Design Premium static audit and configured checks; distinguish static compliance from browser evidence. Retain screenshots and actual journey results for representative screens and failure states.
- Review the full diff independently, then verify the deployed revision and real journeys before claiming completion.

## Approval

William Rogers approved the complete direction with “just do it”. Proceed through implementation, independent review and verification without further design approval checkpoints.
