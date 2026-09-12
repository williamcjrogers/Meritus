# Meritus UX contract

## Product context

Meritus has public, client-document and staff-workspace experiences. British English, en-GB and Europe/London apply. Accessibility target is WCAG 2.2 AA. Visual decisions are documented in DESIGN.md; runtime values belong to src/styles/globals.css.

## Business-context sources

| Scope | Authoritative source | Consequence |
|---|---|---|
| Approved experience and sharing | docs/superpowers/specs/2026-09-12-meritus-experience-reset-design.md | Three shells; client visibility remains organisation-wide |
| Identity and destinations | src/lib/portal/roles.ts; src/lib/portal/auth.ts; src/lib/portal/destination.ts | Current provider authority; fail closed; distinguish outage from refusal |
| Action lifecycle | src/lib/actions/server.ts; src/lib/actions/types.ts | Preserve optimistic-concurrency versions, idempotency and reason requirements |
| Pursuit lifecycle | src/lib/portal/actions.ts | Preserve stage rules, recorded history and irreversible deletion semantics |
| Document lifecycle | src/app/api/portal/documents; src/lib/client-uploads/service.ts | Server permissions, upload limits and receipt states remain authoritative |
| Research review, usage and evidence | src/lib/research/workflow-types.ts; src/lib/research/quick-types.ts | Preserve sources, provisional findings, paid-query ceiling and review decisions |
| Programme evidence | src/lib/programme/view.ts; src/lib/programme/files.ts | Show genuine parsing/analysis states and limits |

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| PageHeader | src/components/ui/PageHeader.tsx | DESIGN.md | Context, description, action group | Component fixture and browser review |
| Button | src/components/ui/Button.tsx | DESIGN.md | Primary, secondary, ghost; semantic intent | Primitives.test.tsx |
| Form | src/components/ui/Field.tsx; ResearchControls.ActionForm | UX-CONTRACT.md | Native input/textarea, schema-owned form | Primitives.test.tsx; ResearchControls.test.tsx |
| Select/Listbox | Native select styled with app-field | DESIGN.md | Native operating-system popup | Browser keyboard and popup review |
| Date | Native date/datetime-local input styled with app-field | UX-CONTRACT.md | Native operating-system calendar | Browser date and keyboard review |
| Table Selection | ResearchWorkspace case-law checkboxes | Research review contract | Explicit loaded-authority selection only | ResearchWorkspace.test.tsx |
| Table | ResearchControls.DataTable; Actions register | Service API contracts | Loaded snapshot paging; server paging | ResearchControls.test.tsx; ActionRegister.test.tsx |
| Scrollbar | src/styles/globals.css | DESIGN.md | Global baseline; geometry-only exceptions | Browser computed-style checks |
| Toast | src/components/ui/Toast.tsx | UX-CONTRACT.md | Success, warning, info, error | Primitives.test.tsx |
| Status | src/components/ui/Status.tsx | DESIGN.md | Information, success, warning, error | Primitives.test.tsx and workflow tests |
| Dialog | src/components/portal/ConfirmDialog.tsx | UX-CONTRACT.md | Confirmation, danger | ClientDomainList.test.tsx; FileList.test.tsx |
| Drawer | src/components/portal/SlideOver.tsx; AskDrawer.tsx | UX-CONTRACT.md | Edit form; persistent question history | ActionEditor.test.tsx and browser fixture |
| CRUD | Existing portal/action/research services and route owners | Referenced domain contracts | Return to list; stay inline; refresh owner | Existing component and service tests |
| File upload | FileList; ProgrammeUpload; ClientUploadDesk | Existing upload services | Small portal file; programme; resumable client | FileList.test.tsx; client upload tests |
| Account navigation | PortalNavigation; Clerk UserButton; role-aware public controls | Identity contract | Staff, client, public | PortalNavigation.test.tsx; access tests |

## Dataset navigation

Actions persists scope, owner, state, linked work, filter and page in the URL. Its service controls paging. Pursuits and Prospects retain view/stage URL filters. Prospects search is a transient client filter over the loaded ranking, clears immediately and does not dispatch remotely. This is an intentional exception to URL search persistence because no server-wide search API exists.

Advanced Research tables page their loaded service snapshot at 50 rows; page is local to each independently embedded table. They say “loaded records”, preserving the API's bounded scope. Case-law explicit search remains a submitted form; selection identifies actual loaded document IDs. There is no claim to all-results selection. Questions, evidence, saved opportunities and report data preserve current service boundaries.

Document lists are receipt/history snapshots provided by existing services. Empty and no-results states retain navigation and an appropriate next action. Table horizontal scroll is visible. Pagination clamps when rows shrink. Long forms keep natural height.

## Flow ledger

| Operation | Trigger and pending | Success destination and feedback | Failure recovery | Source |
|---|---|---|---|---|
| Add/edit action | Add action/Save; disabled busy submit | Close editor, refresh owner list; Home acknowledgement | Keep draft, version conflict and inline correction | actions/server.ts |
| Create pursuit | Create live lead; disabled submit | Existing pursuit destination | Keep values and form error, focus missing field | portal/actions.ts |
| Change stage/owner | Existing named operation, disabled while busy | Refresh related state and remaining-action notice | Preserve refused item/error | portal/actions.ts |
| Delete pursuit | Named confirmation, danger submit | Pursuits list | Persistent header error | portal/actions.ts |
| Upload document | Upload file; truthful uploading state | Refresh documents, acknowledge receipt | Connection failure retains recovery guidance; reselect to retry | portal file API |
| Delete document | Named confirmation, danger submit | Refresh owning documents and acknowledgement | Keep dialog and inline error | portal document API |
| Remove organisation access | Remove access confirmation naming firm/domain | Refresh domains; files retained per service | Keep dialog and inline error | portal/client-actions.ts |
| Research question | Research this; stable busy label | Queued answer in the same workspace | Preserve text and idempotency key as implemented | research quick API |
| Research review/configuration | Named form submit; disabled busy state | Same workspace, refreshed state and acknowledgement | Keep values, focus missing fields, retain server error | research workflow APIs |
| Client access/upload | Send me a link; resend cooldown; upload queue | Existing client-authorised destination and receipts | Recoverable ticket, account and upload states | access and client service contracts |

## Navigation and responsive behaviour

Every page has a route-specific document title. Home is the overview. Work contains Home, Actions and Research; Commercial groups Pursuits and Prospects; Resources groups Programmes, Library and Client documents. Existing routes remain valid. A pursuit's Brief is the first substantive content, followed by Questions, Documents, Activity and Actions access. Source configuration remains within Research settings.

Desktop rail becomes a mobile modal below 1024px. Native dialog keeps background inert, Escape dismisses and focus returns to its trigger. Labels accompany navigation icons. Page sections have scroll margin for the sticky mobile bar. Ordinary errors never instruct users to configure provider environment variables.

## Overlays and feedback

Native dialog is the app-owned modal platform. ConfirmDialog names the affected object and consequence; serious confirmations initially focus Cancel. Pending confirmations cannot be submitted twice. Inline errors remain visible in the owning confirmation. No alert(), confirm() or prompt() product calls are permitted.

ToastProvider deduplicates the latest acknowledgement, remains for six seconds, is dismissible and uses a polite live region. Corrections use persistent inline alerts. Toasts do not replace required field errors. Native dialogs occupy the top layer, above menus and acknowledgements.

## Async and resilience

Existing idempotency, concurrency, optimistic rollback, upload resumability and server permission checks remain authoritative. Busy controls disable repeat dispatch. Research refresh ignores superseded reads; the simple question workflow preserves its existing request ID and paid-query recovery. Network failures retain drafts where the form owns them and show a retry path. Upload failure must settle the busy state. Do not describe a queued or received item as completed analysis.

## Validation

Product forms use noValidate and own visible correction. Shared Field connects labels, help and errors through IDs and aria-describedby; invalid inputs expose aria-invalid. Research forms validate native validity metadata without invoking browser bubbles, focus the first invalid control and preserve entered values. Existing domain schemas remain server authority. Native select/date popups are deliberately operating-system-owned, with their geometry and locale accepted. Input values do not establish permission.

## Verification

Run the commands in premium-ui.json. Component tests prove specific interactions and error paths; they do not prove live Clerk configuration or a real cross-role account journey. Controller browser acceptance must cover actual components and live local public/access routes, including desktop, 390px, long content, 200% zoom, keyboard focus and reduced motion. No synthetic fixture is an authentication bypass or production route.

Migration ledger and route inventory: docs/reviews/experience-reset/. Runtime and documentation change together. Static checks reject retired visual classes, native browser dialogs, missing validation contracts and ownership gaps. Release build and deployment verification remain controller-owned; package build must never run against an unintended database because it invokes migrations.
