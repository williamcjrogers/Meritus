# Home dashboard: approved design

Date: 12 September 2026

Status: Approved by William Rogers on 12 September 2026. Implementation planning is authorised. Application changes and deployment have not yet been made.

## Purpose and success criteria

Home is the directors' operating overview. Within a few seconds, a director should be able to identify what requires attention, what is due, who is responsible and what has changed. It must also explain the current position across live leads, prospects, research and programme analysis.

Live leads have a separate working area. They contribute to Home without defining Home.

The user's current request supersedes the 09 September pursuit-desk specification's decisions that Home is a pipeline board and that a firm dashboard is excluded. Older documents are context, not authority to reject this change.

## Findings from the existing implementation

The application is in `/Users/williamrogers/Projects/Meritus`. This design was checked against main at `246ae9d`, using its checkout at `/Users/williamrogers/Projects/Meritus/.worktrees/qcs-research`. The current Codex project directory is an empty Git repository and is not the application.

- `src/app/(portal)/portal/page.tsx` renders the pursuit desk, including the inbox, stage board and dormant/instructed/declined lists. It does not aggregate the other workspaces.
- `src/components/portal/NavLink.tsx` treats pursuit detail pages as Home. There is no separate pursuit index route.
- `src/lib/db/schema.ts` gives a pursuit one owner and one editable next action/date. It has no action completion record. `setNextAction` in `src/lib/portal/actions.ts` replaces or clears those fields; this is not evidence that work was completed.
- Prospects have outreach statuses and notes, but no accountable owner or due date.
- Programme records describe imported schedules and the status of automated analysis. They do not establish accountable delivery milestones or live construction progress.
- Research has its own investigations, review decisions, events and processing state. These require explicit mappings; a source scan or processing job is not a director's action.
- `directorName` currently labels an owner that cannot be resolved as Unassigned. A failed lookup must instead retain the fact that an owner ID exists.

These are source findings, not a fresh query of production data. The supplied screenshot is the evidence for the illustrated L&Q and Kubik examples below.

## Alternatives considered

| Approach | Value | Limitation |
|---|---|---|
| Operating overview, recommended | Prioritises commitments and exceptions while retaining a view of the business | Requires a small, real action register beneath the presentation |
| Executive scorecard | Quick understanding of volumes and outcomes | Counts obscure unattended work and provide little help with today's decisions |
| Personal worklist | Excellent for an individual's immediate tasks | Conceals team commitments and unassigned work if it is the only landing view |

Use the operating overview, with a My work filter and compact contextual summaries. Avoid a wall of equal-sized metric cards: prominence should follow the decision the director needs to make.

## Navigation and boundaries

| Label | Route | Job |
|---|---|---|
| Home | `/portal` | Operating overview across the portal |
| Actions | `/portal/actions` | Complete register, filters and completion history |
| Live leads | `/portal/pursuits` | Existing enquiry/scoping/proposal board and dormant/instructed/declined views |
| Prospects | `/portal/prospects` | Organisations being assessed or approached |
| Programmes | `/portal/programmes` | Programme imports and analysis |
| Research | `/portal/research` | Investigations, evidence and review workflows |
| Library | `/portal/library` | Shared reference documents |

Keep pursuit record IDs and detail URLs unchanged. A live lead is an active commercial opportunity; a prospect is not automatically one. Use Live leads consistently in navigation, page titles, buttons and return links, while retaining the existing internal pursuit model.

Home is active only at `/portal`. Live leads remains active when viewing a pursuit dossier. Move stage lists to `/portal/pursuits?stage=...`; redirect the old `/portal?stage=...` links to the equivalent view. Update dossier back links, deletion returns and the old leads redirect.

Use Directors' workspace as the portal descriptor, because Pursuit desk no longer describes the whole portal. Preserve the Meritus Via wordmark.

## Home layout

The desktop page is left aligned and uses the available content width. The working action list takes approximately two thirds of the main row; upcoming dates use the remaining third.

```text
Home                            Team overview | My work     Add action
12 September 2026

Overdue    Due today    Due in next 7 days    Needs assignment

Actions requiring attention                Upcoming dates
Action / related work / owner / due /       Next 14 days, grouped by date
status / completion control                Action deadlines and reviewed events

Missing commitments and decisions
Live leads without an owner or next action; actions without a date

Team accountability                        Live leads
Director / open / overdue / due soon        Stages, exceptions, open board
Explicit unassigned row

Prospects / Research / Programme analysis
Short summaries with a relevant next step and source-workspace links

Recent progress
Dated, attributable completion and commercial changes
```

The date is context beneath the page title. The first useful content is the attention summary and the actual work. The full stage board is absent from Home.

### Actions requiring attention

Each row shows a specific action, a link to its related work, the accountable person's readable name, a full due date, status and a completion control. Initials are supplementary. A compact row expansion opens the details, assignment, dates and history without losing the overview.

Sort overdue actions first by due date, then those due today, then the next seven calendar days. Show up to eight rows with a View all actions link carrying the current scope. Rows appear once, even when they satisfy more than one attention condition. Waiting actions retain their follow-up dates and can become overdue.

Missing dates and assignment gaps appear explicitly in the exceptions area and the full register. Absence of a date does not imply absence of urgency. A live lead lacking a next action receives an Add next action control.

Summary counts are filters, not decoration. Their accessible labels include the count and meaning. Because an overdue action can also be unassigned, the counts must not be added into a purported total of outstanding issues.

### Upcoming dates

Use a compact chronological agenda for today and the following 13 London calendar dates. It shows action deadlines, dormant lead review dates and reviewed research events with a source link. Distinguish an external event from an assigned commitment. A director can create an action linked to an event; the event itself is not silently made their responsibility.

Review of a research entry does not establish the certainty of its date. Retain the source's date type and qualification, such as Expected decision date, and any uncertainty. Only entries with a usable exact date enter the chronological agenda; undated events remain in Research, and approximate dates are not converted into invented days. Provisional entries are excluded until reviewed.

Do not infer statutory or contractual deadlines from scraped dates. Do not turn every imported programme activity into a dashboard milestone. Programme actions can be created explicitly and linked to the relevant analysis. Identical action records are deduplicated in the agenda; separate events retain separate identities.

### Team accountability

Show one row per director with open actions, overdue actions, actions due in the next seven days and actions completed in the last seven days. Include an Unassigned row. Clicking a figure opens the exact action subset. This section always remains team-wide, including in My work, and is explicitly labelled Team accountability. Its totals use the complete team action set rather than the personal filter.

This is a view of recorded commitments, not a productivity ranking or a measure of spare capacity. Never imply that a count of open actions measures effort. A recorded owner whose profile is unavailable is shown as Assigned, name unavailable, not Unassigned.

### Progress and business context

- Live leads: compact stage counts including unowned leads, with separate instructed/dormant/declined links. Surface missing lead owners and missing next actions. Do not express commercial stages as percentage completion.
- Prospects: outreach-status totals and a link to the relevant filtered prospect list. A prospect's progress is its recorded outreach status; research population size is not sales performance. Do not reuse the current Approachable total unchanged: its query checks a classification but does not exclude converted, parked or do-not-approach records. Show explicit outreach statuses and exclude those records from any action-oriented outreach count.
- Research: investigations running, results available for review, and work requiring a director's decision. Use the workspace's recorded decision state, not raw scan counts or imagined tasks. Ownership and revisit decisions must be resolved consistently by that workspace before appearing as current state on Home.
- Programme analysis: reports running, completed analyses and failures requiring attention. Label these as analysis results. Do not call them project completion or business delivery progress.
- Recent progress: a short dated feed of completed actions, recorded lead stage changes, instructions and relevant research decisions. Include who recorded each change. Display system processing separately from human achievements.

Do not show pipeline revenue: the existing approximate value is a dispute value band, not a fee. A proposal stage change means Moved to proposal, not Proposal submitted unless an actual submission event is recorded. Do not create conversion percentages without a defined cohort and sufficient history.

## A real action register

The action register and dashboard are one cohesive change: the dashboard depends on reliable action records. This is not a new general project-management platform.

An action records its title, optional description, accountable director, due date, status, related work, creator, creation time and version. It also retains completion time and completing actor when applicable. An action can be standalone or link to one pursuit, prospect, programme analysis or research investigation. Validate the linked record and its permissions on the server.

Statuses are To do, In progress, Waiting, Completed and Cancelled. Waiting requires a short reason and a follow-up due date. Cancelled requires a reason and does not count as completed. Reopening clears the current completion state but retains the original event in history. Any authorised director can update an action; history identifies the person who did so.

One person is accountable for each assigned action. The lead owner and action owner are distinct. New actions require an assignee and due date before they become confirmed commitments; an explicit Save as unassigned option is available for intake and records an exception. Imported incomplete records remain visible for correction.

Keep an append-only action history of creation/import, assignment, status change, changed due date, completion, reopening and cancellation. A changed deadline records the old date, new date, actor and reason. Retain the original recorded due date as well as the current due date. Completing an action must not automatically advance a commercial stage or complete related actions.

The underlying action register is shared between Home, Actions and related record pages. Do not create a second dashboard-only task store. Existing Next action displays read from the same records: a director can nominate an open action as the next action for a pursuit; otherwise use the earliest dated unfinished action. Waiting work is labelled explicitly. With no unfinished action, show Needs next action for an active lead.

Use version checks on edits. If another director has changed the action, preserve the attempted edits and ask the user to review the current record. Completion is idempotent and the action update and event write commit atomically.

### Preserving existing commitments

Import each non-empty legacy next action exactly once, preserving its text, due date and pursuit link. A unique legacy reference prevents duplicates on a rerun. Preserve dormant review dates even when no action text exists.

The previous pursuit owner is a suggested assignee, not proof of a separate action assignment. Mark imported actions as requiring assignment confirmation and offer that existing owner as the first selection. Preserve the existing pursuit owner unchanged. Do not manufacture historical completion from a replaced or cleared next-action field.

Once all relevant views and mutations use the new register, it becomes authoritative. Keep the legacy values until migration reconciliation has confirmed that no commitment or review date was lost. Stage changes must offer a review of remaining open actions rather than silently clearing or completing them. Hard deletion of a linked pursuit with actions is refused until those actions are deliberately retained as standalone records or otherwise resolved; action history is not silently cascaded away.

## Scope, dates and truthful counts

- Default Home to Team overview. My work filters actions by action assignee, leads by lead owner and investigations by their explicitly recorded owner. It is a preference, not an access-control boundary.
- Team-wide unassigned work remains visible as a clearly labelled notice in My work. The notice links to the unassigned view; it does not contaminate personal totals.
- Prospect and programme summary panels remain explicitly Team totals where those records lack accountable ownership. Never infer ownership from who uploaded or created a record.
- Use Europe/London consistently. Due today becomes overdue on the following London calendar date. Next seven days means tomorrow through the seventh following date, excluding today. Display dates as DD Month YYYY and state Today or Overdue in addition where helpful.
- Completed in the last seven days means the seven London calendar dates ending today. Count each action once, using its current completed state and latest completion time; cancelled or currently reopened actions are excluded. A task's history remains available separately.
- Retain audit history from launch without inventing earlier completions. If no records exist, say No completed actions recorded.
- Totals come from full filtered queries, never from the eight displayed action rows or a paginated research sample. Use one request timestamp for all date buckets.

## Visual system and critique

Retain the existing Meritus identity deliberately. Its green and brass are brand assets, rather than a reason to replace the product with a generic dashboard kit.

| Token | Value | Use |
|---|---|---|
| Racing green | `#0B3B24` | Navigation, primary text and primary action |
| Cream | `#F5F0E8` | Cleaner main working surface |
| Parchment | `#EDE7DB` | Secondary context and grouped content |
| Brass | `#B5975A` | Brand detail and restrained emphasis |
| Ink | `#1C1F26` | Body text and tabular data |
| Oxblood | `#4A0404` | Overdue and failed states, with textual labels |

Cormorant Garamond carries the page title at 36/40 px and major section headings at 24/28 px. Inter carries task titles, names, dates and controls at 14/20 or 16/24 px. Use tabular numerals for aligned counts. Preserve the existing wordmark; avoid additional display families or monospaced dashboard labels.

The distinctive element is the commitment list: an immediately readable alignment of action, person and date. Everything around it supports that purpose. Use understated separators to align records, light grouping surfaces for secondary context and restrained corner rounding on interactive controls. Do not repeat decorative brackets around every panel.

The first-pass idea of large metric cards above the board was rejected because it would retain the original information hierarchy. The revised design makes the actions themselves the leading content, reduces the oversized date, introduces readable owner names and replaces vague stage-age strings with explicit labels.

On a phone, use a menu for the expanded navigation. Stack actions, exceptions, agenda, accountability and summaries in that order. Each action becomes a compact vertical record with visible owner, due date and status. Keep completion controls at least 44 px high, visible keyboard focus, semantic headings, table headers and reduced-motion support. Status never depends on colour alone. Verify contrast rather than assuming brass text is readable on a light surface.

## Data flow and failure behaviour

Load a server-side dashboard view model through narrow readers for actions, lead counts, prospects, research and programmes. Pure selectors determine date buckets, filters and ordering. Client components handle interactions and accessible feedback, not the definitions of business metrics.

Authorise every read and mutation using the existing director checks and retain research workspace scoping. The dashboard must not broaden visibility of restricted research. Retain evidence-availability masking for research-derived lead summaries and activity. Research agenda entries must be reviewed, supported by available evidence and not suppressed; apply suppression explicitly because the current calendar reader alone does not enforce it. Do not fetch credentials or raw evidence simply to render a summary.

Reads must not seed prospects, advance jobs or expire processing records. Reuse existing data readers where safe; split read-only summary queries from readers with side effects. Revalidate Home, Actions and the related record after a confirmed change.

Each summary loads and fails independently. If programme analysis is unavailable, commitments still load. A failed query displays Could not load programme analysis and Retry; it never becomes zero or Everything is up to date. Preserve entered data when an action save fails, roll back optimistic state and show the error beside that action. Initial loading uses stable placeholders without invented numbers.

## Implementation boundaries after approval

1. Add the action model, atomic mutations, event history and an idempotent legacy-import procedure. Verify preservation and date semantics before changing the user-facing source of truth.
2. Build Actions and the shared editor; connect pursuit next-action controls and assignment to the same register.
3. Move the existing board to the Live leads route, correct selected navigation and return links, and preserve old bookmarked stage URLs.
4. Add the read-only dashboard aggregation and the Home layout, with truthful scoped summaries from the existing workspaces.
5. Exercise the complete flows and review desktop/mobile screenshots with sparse and busy fixtures.

Expected file areas are `src/lib/db/schema.ts`, a focused action repository and action-history module, `src/lib/portal/actions.ts`, new `src/lib/dashboard/` selectors/readers, new action and dashboard components, the portal Home and layout, the new Actions and Live leads pages, and existing pursuit next-action/navigation components. Research contributes bounded summary readers; redesigning its source settings is outside this proposal and is being addressed separately.

The implementation plan will specify exact interfaces, migration numbering against the latest branch state, test code and commits after approval. No new charting dependency is needed for this design. Do not run the existing `build` script against a shared database merely to verify compilation, because it applies migrations.

## Acceptance checks

1. Sign-in lands on the overview. Live leads has its own selected navigation state, and pursuit return links return there.
2. With the screenshot's records, L&Q appears as needing a next action, Kubik's recorded call and date appear as a commitment, and the lead summary shows one scoping and one proposal record. Assignee names and completion counts are never invented. The screenshot's 62 prospects remain secondary context, not a verified present-day total.
3. Create an action, assign it, set a due date, complete it and reopen it. Home, Actions, the linked record and history stay consistent; the pursuit stage is unchanged.
4. Deadline changes preserve the original date, changed date, reason and actor. Waiting and cancelled work follow the explicit counting rules.
5. Verify midnight, the two UK clock changes, due-today boundaries, missing dates and all closed statuses using a fixed London clock.
6. A director owns a lead whose action belongs to another director. My work follows the action assignee and does not misattribute the action to the lead owner.
7. Missing owner profiles do not become Unassigned. A failed director lookup does not offer invalid reassignment choices.
8. Totals remain correct with more actions than the displayed list, and clicking each total returns the corresponding records.
9. An independent research/programme failure leaves the rest of Home usable and does not display a false zero. Client users cannot access dashboard data or action mutations.
10. Importing legacy next actions twice creates no duplicate commitments, loses no dates and creates no fabricated completions. Concurrent edits cannot overwrite one another silently.
11. Review at 1440 px and 390 px widths, with keyboard-only interaction. Check the primary work appears early, long organisation names wrap properly and expanded navigation remains usable.

Approved scope: this operating overview, separate Live leads workspace and shared accountable action register form the basis of the detailed implementation plan.
