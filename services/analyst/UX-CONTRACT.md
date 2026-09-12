# Meritus UX contract

This contract is authoritative for observable analyst-desk behaviour. Visual decisions live in [DESIGN.md](DESIGN.md); HTTP data and mutation shapes live in `docs/superpowers/contracts/meritus-v1.md`.

## Product, locale and access

Meritus is a local, authenticated product for UK construction intelligence analysts. Interface language, collation, numbers and dates use `en-GB`. Date-only input and display use typed `DD/MM/YYYY` values and are sent as `YYYY-MM-DD` without UTC conversion. Absolute timestamps display in Europe/London using the browser's current daylight-saving rules.

The app checks setup status, then an existing session, before rendering protected routes. Setup and sign-in preserve password-manager and paste support. A 401 clears only in-memory authentication, retains the intended URL and presents sign-in with a persistent session-expired message. Successful authentication returns to that URL. A 403 stays in context and explains the policy boundary. Client visibility never replaces server authorisation.

## Business source traceability

| Behaviour | Normative source | UI implementation |
| --- | --- | --- |
| API payloads, review types, lifecycle states and export formats | `docs/superpowers/contracts/meritus-v1.md` | Typed route API calls and response renderers |
| Analyst routes, workflow scope and acceptance criteria | `.superpowers/sdd/2026-09-12-analyst-desk/task-2-brief.md` | Protected route map, route forms and browser tests |
| Source permission reference and explicit activation consequence | Approved analyst-desk specification | Source permission form and confirmation dialog |
| Confirmed calendar date basis and linked evidence | Approved analyst-desk specification | Calendar status, basis and evidence fields |
| Immutable review actor, date and rationale | Approved analyst-desk specification | Review decision form and audit history |
| UK date interpretation and session recovery | This contract | `TextField` plus `parseUkDate`, display helpers and auth boundary |

Where these sources disagree, the HTTP contract governs data shape and the approved specification governs required business behaviour. The UI exposes an unavailable state rather than inventing data when an endpoint cannot supply a required field.

## Canonical UI map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Table selection | Not used in v1 | This contract | None | Static audit |
| Select/Listbox | `SelectField`, native select | This contract and DESIGN.md | Required, optional | Keyboard/component tests |
| Date | `TextField` plus `parseUkDate`, typed UK date | This contract | Provisional, confirmed | Parsing and form tests |
| Form | `TextField`, `TextAreaField`, `SelectField`, `TextField` plus `parseUkDate`, `FormError` | This contract | Create, decision, permission | Interaction tests |
| Scrollbar | `web/src/styles.css` document baseline | DESIGN.md | Stable-gutter table wrapper | Static and browser inspection |
| Toast | `ToastProvider` | This contract | Success, info, warning, error | Live-region test |
| CRUD | Route API functions plus shared form states | API contract and this contract | Return to list, remain in context | Interaction tests |
| Dialog | `Dialog` | This contract | Consequence confirmation | Keyboard/focus test |
| Search | `SearchField` and `EntityPicker` | This contract | Watchlist and embedded entity query | Race/cancellation tests |
| Status/async | `StatePanel`, `Status`, `Button` | This contract | Loading, empty, no-results, error, partial | Component and route tests |

No equivalent route-local primitive is permitted. Native selects are intentional because platform-owned popup geometry is acceptable. Table selection is excluded because v1 has no bulk action.

## Navigation and lists

The protected shell exposes Watchlist, Evidence, Sources, Review queue, Alerts, Calendar, Relationships, Pipeline, Reports, Indices and Imports as real links. Each route sets a meaningful document title. Current-route state is visible and exposed with `aria-current="page"`. Narrow layouts retain the operator identity and Sign out control below the horizontally scrolling navigation.

Watchlist query and `kind`, `sector`, `signal_family`, `geography`, `lead_time_band`, `reviewer`, `review_state`, `stage`, `change_since_previous`, `eligible`, `page` and `page_size` filters use URL parameters as the single committed source. Remote search waits 300ms, Enter commits immediately, IME composition suppresses dispatch and every superseded request is aborted. Clear removes the query immediately, cancels pending work, resets page one and returns focus to the field. Filter changes reset page one; page navigation preserves the requested page. The API owns list pagination through `{items,total,page,page_size}`. The UI renders the returned page once, shows an exact server range and repeats truncation or coverage without claiming completeness.

Semantic tables remain tables. A horizontal wrapper preserves all columns, actions and evidence links on narrow screens. Empty dataset offers the relevant next action; no-results offers Clear filters; errors offer Retry. Loading reserves the table/state region.

## Forms, mutations and feedback

All forms use `noValidate`, real labels, inline errors, `aria-invalid`, `aria-describedby`, first-invalid focus and preserved non-sensitive values. Mutation buttons prevent duplicate submission, keep their dimensions and expose `aria-busy`. Server `detail` remains as persistent form-level feedback when no safe field mapping exists. Toasts acknowledge successful mutations but never contain the only critical result.

Review actions require a reason. Identity, observation and independence decisions stay distinguishable. A decision appends an immutable audit record with actor and date; correction uses a later review decision rather than deleting history, so it is operationally reversible. A failed save keeps the reason and selected action available.

Source access follows the current permission and readiness contract. Credentials are environment-only and never rendered as values. The analyst edits an actual permission reference, scope, review date, explicit operations and optional expiry/retention conditions. Saving a grant and enabling a source are separate actions. Enablement does not fabricate permission or imply readiness. The user-authorised configuration flow applies enable/disable directly and reports the saved state; current readiness explains missing credentials, permission or required configuration. Source runs report `queued`, then show server run status and counts; dispatch is never described as completion.

Calendar entries marked confirmed require a non-empty basis and source evidence. Provisional dates are visually and textually separate. Calendar, relationship and pipeline writes remain disabled while their entity register is loading or unavailable, with an explicit retry. Relationships require typed from/to entities, role, explicit validity dates and a review reason. Evidence is either a retained source record or an independently reviewed human basis; web references use retained source evidence. Professional roles also identify a matter through a reference or entity. Imports accept keyboard file selection or pasted CSV/JSON, use a standards-compliant CSV parser, call preview, show server errors and preview rows, then allow one token-based commit. Any change to kind, content, source URL or permission reference invalidates the preview token. A commit token is single-use in the UI.

`EntityPicker` combines the native `SelectField` with embedded `SearchField`, returns up to 25 server matches and validates exact IDs through the detail API. Searching or clearing the query retains the selected entity and its label. Embedded form queries are transient form state, so they do not replace route filters. The role field uses a native datalist for suggested canonical roles while allowing other evidenced roles.

Entity corrections use the review API with a required reason. Name and identifier corrections remain subject to the canonical identity key; identity resolution uses a reviewed merge. Historical reviews are read-only and use server state and allowed actions. Alerts show server-created category, title, body, timestamps and entity context, with URL-persisted server pagination. Mark as read waits for server success, preserves unread state and inline errors on failure, and never fabricates an alert. Calendar timing previews are expressly unpersisted and non-actionable; using a preview fills a provisional form that still requires an explicit save, preserving the stated input basis. Confirmed practical-completion entries alone offer the server-derived 12 to 24 month window.

Pipeline actions append human actor/date history using the eight approved stages: review, shortlisted, introduction_considered, contacted, conversation, instruction, dismissed and snoozed. Historical stage names remain visible as recorded. Outcome metrics show the server counts, denominators and both conversation rates, with cohort and reviewed-date filters. Six measures use a balanced three-column grid, reducing to two columns on narrow screens. Opportunity panels show readable evidence, matter-specific introduction routes and conflict-clearance prompts with server pagination; they do not claim professional availability or a conflict conclusion. Dashboard metrics displayed in Pipeline and Indices come only from `/api/metrics` and `/api/indices`. Index plots use supplied finite numeric values by reporting window, retain zero values, never estimate missing or suppressed points, and preserve the detailed source table. The plot has a textual description and a keyboard-focusable horizontal wrapper on narrow screens. Reports create saved weekly or digest snapshots, insert the returned snapshot into the list, and link only to real `/api/exports/{id}.csv` and `.html` routes.

## Async, recovery and authenticity

Every route has loading, empty, no-results where filtering applies, error and retry states. Required secondary requests have their own dependency state and cannot be mistaken for an empty register. Status tone uses an explicit whole-value map, so prefixed negative values never inherit a positive substring. Older requests cannot overwrite newer data or pending state. Navigating away aborts in-flight reads. Mutations keep context on network, validation, conflict and permission failure. When connectivity returns, the analyst retries explicitly; v1 does not claim offline writes or optimistic commits.

If an API response explicitly identifies synthetic/demo data, a persistent `Demo data` banner appears in the shell. Request failure never substitutes fixtures or fabricated production content. Mock API data exists only under `web/src/test` and browser test fixtures.

## Modal, notification and layer behaviour

The application defines one overlay scale for sticky UI, dropdown, popover, backdrop, dialog and toast. `Dialog` moves focus inside, loops Tab and Shift+Tab, treats Escape as Cancel, makes the app content inert while open and restores focus. Consequence confirmation initially focuses Cancel. Browser `alert`, `confirm` and `prompt` are forbidden.

The toast region is fixed at the bottom right, polite by default and limited to three messages. Notification cards do not intercept clicks on the application beneath them; their dismissal controls remain interactive. Success and information notices expire after six seconds, pausing while their controls are focused or hovered. Warnings and errors remain until dismissed. Errors requiring correction stay inline. Reduced-motion mode removes transitions without changing state meaning.

## Accessibility and responsive behaviour

The target is WCAG 2.2 AA. Controls use native semantics, visible focus and text labels; status never relies on colour. Important targets are at least 44px high. The desktop rail becomes a top navigation landmark below 860px. Dialogs fit the visual viewport, tables scroll horizontally, forms stay in document flow, and evidence links remain reachable at 320px wide and 200% zoom.

Keyboard verification covers navigation links, search clear and Enter, native selects, form errors, modal Tab/Escape/restoration and export links. Auth expiry, reduced motion, narrow layout, empty/error/loading and stale-search order require automated or browser evidence before release.
