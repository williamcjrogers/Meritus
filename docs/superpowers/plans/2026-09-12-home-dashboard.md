# Home Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Home with an actionable directors' overview, backed by shared accountable actions, and give Live leads its own workspace.

**Architecture:** A small action register is the source of truth for commitments, assignees, deadlines and completion history. Server-side read models aggregate the existing workspaces without mutating them, and pure selectors define dates, scope and ordering. Shared action controls serve Home, Actions and related records; the existing pursuit board moves to its own route.

**Tech Stack:** Existing Next.js 15.5.12, React 19.2.4, TypeScript 5.9.3, Tailwind 4, Drizzle 0.45.2, Neon PostgreSQL, Clerk, Zod 4.5.4, Vitest 5 and Testing Library. Use corepack pnpm 11.25.0. No new runtime or charting dependency.

**Spec:** `docs/superpowers/specs/2026-09-12-home-dashboard-design.md`, approved on 12 September 2026.

## Global Constraints

- Live leads have a separate working area. They contribute to Home without defining Home.
- Keep pursuit record IDs and detail URLs unchanged.
- Use Live leads consistently in navigation, page titles, buttons and return links, while retaining the existing internal pursuit model.
- Use Europe/London consistently. Due today becomes overdue on the following London calendar date.
- Next seven days means tomorrow through the seventh following date, excluding today.
- Display dates as DD Month YYYY and state Today or Overdue in addition where helpful.
- Totals come from full filtered queries, never from the eight displayed action rows or a paginated research sample.
- Use one request timestamp for all date buckets.
- This section always remains team-wide, including in My work, and is explicitly labelled Team accountability.
- A recorded owner whose profile is unavailable is shown as Assigned, name unavailable, not Unassigned.
- Completing an action must not automatically advance a commercial stage or complete related actions.
- Do not manufacture historical completion from a replaced or cleared next-action field.
- Reads must not seed prospects, advance jobs or expire processing records.
- The dashboard must not broaden visibility of restricted research.
- Status never depends on colour alone.
- British English. No em dashes in new code, documents or UI copy.
- Preserve concurrent work. Do not push, merge, deploy or run a migration against shared data as part of local implementation verification.

## Workspace and baseline

Worktree: `/Users/williamrogers/Projects/Meritus/.worktrees/home-dashboard`.

Branch: `codex/home-dashboard`, based on main `246ae9d`. Approved design committed as `67f7bd2`. William explicitly instructed that this work remain on a separate branch and not be merged. Other worktrees contain ongoing client-access and research-source changes. Do not use or reset them. Do not merge this branch.

Dependencies installed with `corepack pnpm install --frozen-lockfile`. Baseline on 12 September 2026: 61 test files passed, 5 skipped; 582 tests passed, 54 skipped. The skipped tests require an explicitly isolated PostgreSQL fixture. Existing warning: the CSV-import worker has no package-level module-type declaration. This is not a dashboard failure.

The latest migration is `0008_qcs_research_watchlists`, journal idx 8, timestamp 1789228800005. Reserve `0009_portal_dashboard_actions` in this branch; check migration numbering again when integrating with newer main. Never edit an already applied migration. The installed migrator wraps all pending migrations in one transaction, although its existing comment says per-file.

## Locked implementation decisions

1. Use `desk_actions` and `desk_action_events` to distinguish business actions from existing server-action functions. Status values are `todo`, `in_progress`, `waiting`, `completed`, `cancelled`.
2. A related action points to at most one of a pursuit, prospect, programme, investigation or research-calendar entry. Programme links use stable `programmes.id`, so recomputation does not orphan commitments. Calendar is an explicit extra link kind needed by the approved Create action from event interaction. A general action has no parent.
3. Use nullable foreign keys with restrictive deletion, rather than unchecked polymorphic IDs. Research links are additionally checked against `QCS_WORKSPACE_ID` and availability/suppression before reads and writes.
4. Add `pursuits.reviewDue` as a separate date. Preserve legacy dormant dates into it, including where the old date was also attached to action text. Import the action with the same date and flag its legacy origin for confirmation. Do not guess which meaning the director intended.
5. Imported actions have no confirmed assignee. Preserve the old lead owner as `suggestedOwnerId`, the action text/date unchanged, and a unique `legacyKey`. Display Assign action with the suggestion preselected. This is not a historical completion.
6. `desk_action_priorities` stores one nominated action per pursuit. A composite foreign key ensures it belongs to that pursuit. A completed nomination is ignored by the next-action selector. Otherwise select the earliest dated unfinished action, with stable creation/id tie-breaks; undated actions follow dated ones.
7. An action's current state and history event are written by one transactional SQL function. Optimistic versions prevent lost updates; request UUID plus payload hash prevents duplicate/replayed commands. Record creation, updates, completion, reopening, cancellation, detachment and nomination.
8. A newly assigned action needs a date. Explicit unassigned intake may lack one. Existing imported omissions can be saved as unresolved intake; they remain exceptions. Waiting always requires a reason and follow-up date. Completed actions require a confirmed owner. Editing closed records requires reopening first, except an idempotent repeat completion.
9. Store the original recorded due date once, including when an initially undated action first acquires a date. Later changes require a reason and keep old/new values in the event. Never label it agreed without evidence of agreement.
10. New Home uses its own `home_scope` preference, values `team`/`mine`, default `team`. Do not inherit the board's `desk_scope` cookie. URL scope overrides the preference; shareable action filters live in the URL.
11. The action list and its counts follow scope. Team accountability, prospect totals and programme totals remain explicitly team-wide. Recent progress is explicitly labelled Team progress. Research summaries follow investigation ownership for My work.
12. Use full-date strings in serialisable view models. Convert database timestamps at the boundary. Do not pass database objects or date-sensitive logic into client components.

## File responsibility map

| Files | Responsibility |
|---|---|
| `src/lib/actions/types.ts`, `model.ts`, `dates.ts`, `filters.ts` | Client-safe contracts, validation, lifecycle rules and date/filter semantics |
| `src/lib/db/desk-action-schema.ts`, `schema.ts`, `drizzle/0009_portal_dashboard_actions.sql` | Action tables, constraints, transactional functions, import and review date |
| `src/lib/db/desk-actions.ts`, `desk-action-links.ts` | Parameterised reads/writes, parent resolution and visibility |
| `src/lib/actions/server.ts` | Authorisation, exact assignee validation, typed mutations and revalidation |
| `src/lib/portal/directors.ts`, `director-helpers.ts` | Directory availability and honest name resolution |
| `src/components/portal/actions/` | Shared action editor, rows, history, filters and related-action panel |
| `src/app/(portal)/portal/actions/page.tsx` | Full action register and URL filters |
| `src/lib/portal/live-leads.ts`, existing board components | Next-action projection and separate review dates |
| `src/lib/dashboard/types.ts`, `read.ts`, `research.ts`, `context.ts` | Independent, read-only overview queries and aggregates |
| `src/components/portal/dashboard/`, Home page | Dashboard composition and scoped controls |
| Portal layout, navigation and new pursuit index | Separate Live leads workspace, mobile menu and legacy redirects |
| Related record pages and questions context | Same accountable actions throughout the app |
| Focused unit/UI/SQL tests; `docs/reviews/2026-09-12-home-dashboard-verification.md` | Acceptance evidence and remaining limitations |

## Delivery order and ownership

Tasks 1 and 2 establish contracts and persistence. Task 3 builds guarded operations. Tasks 4 and 6 can then run independently: action UI and overview queries. Task 7 composes Home, Task 8 separates navigation, and Task 5 cuts over the existing action consumers. Task 9 connects remaining related records and Ask. Task 10 verifies the joined result. The implementer of a task owns only its named files; shared schema, layout and pursuit files require sequential handoff. All tasks belong to the same feature branch.

### Task 1: Client-safe action contracts, dates and lifecycle rules

**Files:**
- Create: `src/lib/actions/types.ts`, `dates.ts`, `model.ts`, `filters.ts`
- Create: `src/lib/actions/model.test.ts`, `dates.test.ts`, `filters.test.ts`, `fixtures.test-support.ts`

**Interfaces:**
- Consumes: `todayIso(now: Date): string` from `src/lib/portal/dates.ts`.
- Produces: the following exact types and functions for every later task.

```ts
export type ActionState = 'todo' | 'in_progress' | 'waiting' | 'completed' | 'cancelled';
export type LinkKind = 'general' | 'pursuit' | 'prospect' | 'programme' | 'investigation' | 'calendar';
export type WorkLink = { kind: 'general' } | { kind: Exclude<LinkKind, 'general'>; id: string };
export type DeskAction = {
  id: string; title: string; description: string | null;
  ownerId: string | null; suggestedOwnerId: string | null;
  dueDate: string | null; originalDueDate: string | null;
  state: ActionState; stateReason: string | null;
  completedAt: string | null; completedBy: string | null;
  createdBy: string; createdAt: string; updatedAt: string;
  version: number; legacyKey: string | null; link: WorkLink;
  retainedContext: string | null;
};
export type ActionView = DeskAction & {
  relatedLabel: string; relatedHref: string | null;
  ownerName: string; isPrimary: boolean; linkAvailable: boolean;
};
export type ActionDraft = {
  title: string; description: string; ownerId: string | null;
  dueDate: string | null; state: ActionState;
  stateReason: string; changeReason: string;
  saveUnassigned: boolean;
};
export type SaveActionInput = {
  id: string; requestId: string; expectedVersion: number;
  link: WorkLink; draft: ActionDraft;
};
export type ActionEvent = {
  id: string; actionId: string; actorId: string; actorName: string;
  kind: 'imported' | 'created' | 'updated' | 'completed' | 'reopened' | 'cancelled' | 'detached' | 'primary_selected';
  before: DeskAction | null; after: DeskAction;
  reason: string | null; createdAt: string;
};
export type ActionSaveResult =
  | { ok: true; action: ActionView }
  | { ok: false; code: 'conflict'; error: string; current: ActionView }
  | { ok: false; code: 'validation' | 'unavailable' | 'forbidden' | 'not_found'; error: string };
export type ActionFilter = 'open' | 'overdue' | 'today' | 'upcoming' | 'unassigned' | 'undated' | 'completed_recent' | 'all';
export type ActionQuery = {
  scope: 'team' | 'mine'; filter: ActionFilter;
  ownerId?: string | null; link?: WorkLink;
  state?: ActionState; page: number; pageSize: number;
};
export type DateWindow = { today: string; upcomingEnd: string; agendaEnd: string; recentStart: string };
```

- [ ] **Step 1: Write boundary and lifecycle tests.** Use a complete fixture factory returning `DeskAction` with a stable UUID, title, nullable fields, `todo`, version 1 and general link. These tests must precede implementation.

```ts
import { describe, expect, it } from 'vitest';
import { dateWindow } from './dates';
import { actionIssue, chooseNextAction, isOpenAction } from './model';
import { actionFixture, draftFixture } from './fixtures.test-support';

describe('recorded commitments', () => {
  it('does not equate cancellation with completion', () => {
    expect(isOpenAction(actionFixture({ state: 'cancelled' }))).toBe(false);
  });
  it('requires a reason when a recorded deadline changes', () => {
    expect(actionIssue(draftFixture({ dueDate: '2026-09-18', changeReason: '' }),
      actionFixture({ dueDate: '2026-09-12' }))).toBe('Explain why the due date changed');
  });
  it('requires a dated follow-up for waiting work', () => {
    expect(actionIssue(draftFixture({ state: 'waiting', stateReason: 'Awaiting client', dueDate: null }), null))
      .toBe('Set a follow-up date for waiting work');
  });
  it('ignores a completed nomination and selects the earliest open action', () => {
    const done = actionFixture({ id: 'done', state: 'completed' });
    const due = actionFixture({ id: 'due', dueDate: '2026-09-13' });
    expect(chooseNextAction([done, due], 'done')?.id).toBe('due');
  });
  it('uses the London calendar at midnight and clock changes', () => {
    expect(dateWindow(new Date('2026-09-12T23:30:00Z')).today).toBe('2026-09-13');
    expect(dateWindow(new Date('2026-03-29T23:30:00Z')).today).toBe('2026-03-30');
    expect(dateWindow(new Date('2026-10-25T23:30:00Z')).today).toBe('2026-10-25');
  });
});
```

- [ ] **Step 2: Run the tests to confirm the new imports fail.**

Run: `corepack pnpm exec vitest run src/lib/actions/model.test.ts src/lib/actions/dates.test.ts src/lib/actions/filters.test.ts`.

- [ ] **Step 3: Implement dates, lifecycle validation and deterministic next-action selection.**

```ts
// dates.ts
import { todayIso } from '@/lib/portal/dates';
import type { DateWindow } from './types';
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function dateWindow(now: Date): DateWindow {
  const today = todayIso(now);
  return { today, upcomingEnd: shiftDate(today, 7), agendaEnd: shiftDate(today, 14), recentStart: shiftDate(today, -6) };
}
export function displayDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${value}T12:00:00Z`));
}
```

```ts
// model.ts
import type { ActionDraft, DeskAction } from './types';
import { validDate } from './dates';
export const OPEN_STATES = ['todo', 'in_progress', 'waiting'] as const;
export function isOpenAction(a: Pick<DeskAction, 'state'>): boolean {
  return a.state === 'todo' || a.state === 'in_progress' || a.state === 'waiting';
}
export function actionIssue(d: ActionDraft, current: DeskAction | null): string | null {
  if (!d.title.trim()) return 'Give the action a title';
  if (d.title.trim().length > 240) return 'Keep the action title to 240 characters';
  if (d.description.length > 4000) return 'Keep the description to 4,000 characters';
  if (d.stateReason.length > 1000 || d.changeReason.length > 1000) return 'Keep the reason to 1,000 characters';
  if (d.dueDate && !validDate(d.dueDate)) return 'Choose a valid due date';
  if (d.state === 'waiting' && !d.dueDate) return 'Set a follow-up date for waiting work';
  if ((d.state === 'waiting' || d.state === 'cancelled') && !d.stateReason.trim()) return 'Give a reason for this status';
  if (d.state === 'completed' && !d.ownerId) return 'Confirm an assignee before completing the action';
  if (!d.ownerId && !d.saveUnassigned) return 'Assign the action or save it as unassigned';
  if (d.ownerId && !d.dueDate && (current === null || current.ownerId !== d.ownerId)) return 'Set a due date for this assignment';
  if (current && current.dueDate !== d.dueDate && !d.changeReason.trim()) return 'Explain why the due date changed';
  if (current && !isOpenAction(current) && !isOpenAction(d) && current.state !== d.state) return 'Reopen the action before changing it';
  return null;
}
export function chooseNextAction(actions: DeskAction[], nominatedId: string | null): DeskAction | null {
  const open = actions.filter(isOpenAction);
  return open.find(a => a.id === nominatedId) ?? open.sort((a, b) =>
    (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31') ||
    a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))[0] ?? null;
}
```

Validate the complete command envelope with Zod: UUIDs for action/request IDs and research IDs, non-empty strings up to 64 characters for existing text IDs, exact state/link enums, positive integer versions except creation version zero. Reject unknown fields. Link changes are refused by normal Save; detachment is a separate recorded command.

Implement `parseActionQuery(params: URLSearchParams): ActionQuery` with whitelisted values; unknown filters fall back to `open`, invalid page to 1, pageSize fixed 50, and `owner=unassigned` maps to null. Export `actionQueryHref(query: ActionQuery): string`, always starting `/portal/actions` and using URLSearchParams. Explicit owner filtering overrides personal scope by encoding `scope=team`. Never interpolate user input into SQL.

- [ ] **Step 4: Pass focused tests and commit.**

Run the Step 2 command, then `corepack pnpm exec tsc --noEmit`. Commit only `src/lib/actions` with message `feat: define accountable action lifecycle and date rules`.

### Task 2: Persistent actions, atomic history and legacy reconciliation

**Files:**
- Create: `src/lib/db/desk-action-schema.ts`, `desk-actions.integration.test.ts`, `desk-actions-test-db.ts`
- Modify: `src/lib/db/schema.ts`, `src/lib/db/pursuits.ts` (`PursuitPatch` only at this step)
- Generate: `drizzle/0009_portal_dashboard_actions.sql`, `drizzle/meta/0009_snapshot.json`, journal entry

**Interfaces:**
- Consumes: Task 1 contracts, existing `pursuits`, `prospects`, `programmes`, `researchInvestigations`, `researchCalendar` tables.
- Produces: `deskActions`, `deskActionEvents`, `deskActionPriorities`; SQL functions `desk_save_action(actor, request_id, request_hash, expected_version, payload)`, `desk_detach_action(actor, request_id, request_hash, id, expected_version)`, `desk_select_primary(actor, request_id, request_hash, action_id, expected_version)` returning JSON objects with `ok`, `code`, `action` or `current`.

- [ ] **Step 1: Add isolated SQL tests for lifecycle, concurrency and import.** Follow the existing Docker/PostgreSQL harness, using only container `meritus-home-test`, user `home_test` and database `home_dashboard_test`. The helper refuses every other container/database and never reads DATABASE_URL. Compile Drizzle SQL through `PgDialect().sqlToQuery`; parameter escaping remains only inside the synthetic test adapter.

Create the test container with `docker run --name meritus-home-test --network none -e POSTGRES_USER=home_test -e POSTGRES_PASSWORD=local-fixture-only -e POSTGRES_DB=home_dashboard_test -d postgres:17-alpine`. Use `docker exec meritus-home-test pg_isready -U home_test -d home_dashboard_test` to verify readiness. No port mapping. Apply journal migrations with `execFileSync('docker', [...])` and stdin, following the existing integration harness; each test database is disposable.

```ts
it('keeps one winner and one completion event for concurrent edits', async () => {
  const created = await createFixtureAction();
  const replies = await Promise.all([
    sqlSave(created.id, 1, { state: 'completed' }, 'request-a'),
    sqlSave(created.id, 1, { title: 'A competing edit' }, 'request-b'),
  ]);
  expect(replies.filter(r => r.ok)).toHaveLength(1);
  expect(replies.filter(r => !r.ok && r.code === 'conflict')).toHaveLength(1);
  expect(await scalar(`select version from desk_actions where id='${created.id}'`)).toBe(2);
  expect(await scalar(`select count(*) from desk_action_events where action_id='${created.id}'`)).toBe(2);
});
it('does not duplicate a repeated request or an imported legacy action', async () => {
  const first = await createFixtureAction();
  await replayFixtureCreation(first.id);
  expect(await scalar(`select count(*) from desk_action_events where action_id='${first.id}'`)).toBe(1);
  await importFixtureTwice();
  expect(await scalar("select count(*) from desk_actions where legacy_key='pursuit:legacy-one'")).toBe(1);
  expect(await scalar("select count(*) from desk_actions where completed_at is not null")).toBe(0);
});
```

Define the named fixture helpers in this test file, using valid deterministic UUIDs for request aliases and real SQL calls to the functions below. `createFixtureAction` creates an assigned dated general action. `replayFixtureCreation` reuses its stored creation request UUID/hash. `importFixtureTwice` inserts a pursuit with non-empty next action, captures its due date, executes the exact import SQL twice, and checks the suggested owner and separate dormant date. Use async child processes for concurrency; synchronous psql would serialise the test and hide races.

- [ ] **Step 2: Run the isolated test before adding the schema.**

Run: `HOME_TEST_CONTAINER=meritus-home-test corepack pnpm exec vitest run src/lib/db/desk-actions.integration.test.ts`.

Expected failure: relation/function does not exist, not a missing test container or connection failure.

- [ ] **Step 3: Define tables and generate an additive migration.**

Action columns: UUID primary id; title text not null; description text; owner_id/suggested_owner_id text; due_date/original_due_date date; state text not null default `todo`; state_reason text; completed_at timestamptz; completed_by text; created_by text not null; created_at/updated_at timestamptz default now; version integer default 1; legacy_key text unique; nullable pursuit_id text, prospect_id text, programme_id text, investigation_id uuid, calendar_id uuid; retained_context text for deliberately detached actions.

Events: UUID id, action_id UUID restrictive FK, request_id UUID unique, request_hash text, actor_id text, kind text, before/after JSONB snapshots, reason text, created_at timestamptz. Snapshot data must be mapped to the Task 1 shape at the repository boundary. Never expose request hashes in the UI.

Priorities: pursuit_id text primary/restrictive FK, action_id UUID not null, version integer default 1. Add unique `(id,pursuit_id)` to actions and a composite FK `(action_id,pursuit_id)` to actions. No action or event table uses ON DELETE CASCADE.

```sql
CHECK (state IN ('todo','in_progress','waiting','completed','cancelled')),
CHECK (length(btrim(title)) BETWEEN 1 AND 240),
CHECK (version > 0),
CHECK (num_nonnulls(pursuit_id,prospect_id,programme_id,investigation_id,calendar_id) <= 1),
CHECK (state <> 'waiting' OR (due_date IS NOT NULL AND length(btrim(state_reason)) > 0)),
CHECK (state <> 'cancelled' OR length(btrim(state_reason)) > 0),
CHECK ((state = 'completed') = (completed_at IS NOT NULL AND completed_by IS NOT NULL)),
CHECK (state = 'completed' OR (completed_at IS NULL AND completed_by IS NULL)),
CHECK (state <> 'completed' OR owner_id IS NOT NULL)
```

Use `coalesce(length(btrim(state_reason)),0)>0` in generated constraints so NULL cannot pass a SQL CHECK. Index `(state,due_date,id)`, `(owner_id,state,due_date)`, each parent FK and events `(action_id,created_at,id)`. Add `reviewDue: date('review_due')` to pursuits and include it in `PursuitPatch`. Reexport the new action schema from the existing schema barrel, following the lazy FK callback pattern used by research schema modules.

Run: `corepack pnpm exec drizzle-kit generate --name portal_dashboard_actions`. Inspect the SQL: it must only add this feature's columns/tables/constraints, never drop or recreate existing tables. Append the functions and import below to the newly generated migration. Keep the snapshot consistent with the Drizzle table definitions.

- [ ] **Step 4: Implement request idempotency, row locking and history within SQL.** Use PL/pgSQL, the existing project's approach for multi-step Neon HTTP writes. The command's actor is supplied only by the authorised server action. Use an advisory transaction lock for the request UUID before reading any prior event, and a row lock before version validation.

```sql
PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
SELECT * INTO prior_event FROM desk_action_events WHERE request_id=p_request_id;
IF FOUND THEN
  IF prior_event.actor_id <> p_actor OR prior_event.request_hash <> p_request_hash THEN
    RETURN jsonb_build_object('ok',false,'code','validation','error','Request was reused with different changes');
  END IF;
  RETURN jsonb_build_object('ok',true,'action',prior_event.after);
END IF;
SELECT * INTO before_row FROM desk_actions WHERE id=(p_payload->>'id')::uuid FOR UPDATE;
IF FOUND AND before_row.version <> p_expected_version THEN
  RETURN jsonb_build_object('ok',false,'code','conflict','current',to_jsonb(before_row));
END IF;
```

On creation require expected version zero, create once, and record `created`. Refuse a missing row with a non-zero expected version. On update keep creator/creation time, keep non-null original due date, and increment version. Recheck deadline-change reason and immutable link columns inside the function. Allow a repeat Completed command on an already completed record to return current state without another completion event; do not apply other submitted edits on that shortcut. Reopening is a transition from a closed status to an open status and clears completion columns; ordinary edits of a still-closed action are refused. A Cancelled transition requires its reason. A Completed transition sets server `now()` and `p_actor`, never client-supplied completion values.

```sql
new_completed_at := CASE WHEN new_state='completed' THEN now() ELSE NULL END;
new_completed_by := CASE WHEN new_state='completed' THEN p_actor ELSE NULL END;
new_original_due := coalesce(before_row.original_due_date, new_due_date);
event_kind := CASE
  WHEN new_state='completed' THEN 'completed'
  WHEN new_state='cancelled' THEN 'cancelled'
  WHEN before_row.state IN ('completed','cancelled') THEN 'reopened'
  ELSE 'updated'
END;
INSERT INTO desk_action_events(id,action_id,request_id,request_hash,actor_id,kind,before,after,reason)
VALUES(gen_random_uuid(),after_row.id,p_request_id,p_request_hash,p_actor,event_kind,
  to_jsonb(before_row),to_jsonb(after_row),nullif(btrim(p_payload->>'changeReason'),''));
RETURN jsonb_build_object('ok',true,'action',to_jsonb(after_row));
```

Implement `desk_detach_action` with the same request/version rules: clear parent FKs, retain the original human-readable context supplied by the server, remove any priority row for the action, increment version and write `detached`. Implement `desk_select_primary` by locking the pursuit then action, requiring an open action linked to that pursuit, replacing its priority and writing `primary_selected`. All three operations return before touching data when authorisation/validation fails in the server layer, and remain atomic in SQL. Use the same lock order, pursuit then action, for commands involving pursuit priority or detachment, to avoid deadlocks.

- [ ] **Step 5: Import legacy fields in the same migration and reconcile.**

```sql
UPDATE pursuits SET review_due=next_action_due
WHERE stage='dormant' AND review_due IS NULL AND next_action_due IS NOT NULL;
WITH imported AS (
  INSERT INTO desk_actions(id,title,owner_id,suggested_owner_id,due_date,original_due_date,
    state,created_by,legacy_key,pursuit_id)
  SELECT gen_random_uuid(),next_action,NULL,owner_id,next_action_due,next_action_due,
    'todo','system:legacy-import','pursuit:'||id,id
  FROM pursuits WHERE nullif(btrim(next_action),'') IS NOT NULL
  ON CONFLICT(legacy_key) DO NOTHING RETURNING *
)
INSERT INTO desk_action_events(id,action_id,request_id,request_hash,actor_id,kind,before,after,reason)
SELECT gen_random_uuid(),id,gen_random_uuid(),'legacy-import','system:legacy-import','imported',NULL,
  to_jsonb(imported),'Imported next action; confirm assignment'
FROM imported;
```

Do not clear or delete the old columns. Add SQL assertions that every original non-empty next action has exactly one matching legacyKey, title and date, and every non-null dormant due date is preserved in review_due. Future pre-deployment reconciliation must compare current production legacy values to migrated records before cutover; the local tests only prove fixture behaviour.

- [ ] **Step 6: Pass SQL invariants and commit.** Include tests for missing parent FK, duplicate parent links, cross-pursuit nomination, NULL waiting reason, stale edit, duplicate request with different payload, completion rollback if event insertion fails, concurrent creation versus parent deletion, detachment retention and repeated import. Commit schema, migration, snapshot and tests together as `feat: persist accountable actions with atomic history`.

### Task 3: Guarded repositories, mutations and directory availability

**Files:**
- Create: `src/lib/db/desk-actions.ts`, `desk-action-links.ts`, `src/lib/actions/server.ts`, `server.test.ts`
- Modify: `src/lib/portal/directors.ts`, `director-helpers.ts`, `directors.test.ts`
- Create: `src/lib/portal/director-helpers.test.ts`

**Interfaces:**
- Consumes: Task 1 contracts and Task 2 SQL functions.
- Produces: `readAction(id): Promise<DeskAction|null>`, `readActionViews(query,actorId,now): Promise<{rows:ActionView[];total:number}>`, `readActionHistory(id): Promise<ActionEvent[]>`, `readRelatedActions(link): Promise<ActionView[]>`, `saveDeskAction(input): Promise<ActionSaveResult>`, `completeDeskAction(id,expectedVersion,requestId): Promise<ActionSaveResult>`, `detachDeskAction(id,expectedVersion,requestId): Promise<ActionSaveResult>`, `selectPrimaryAction(id,expectedVersion,requestId): Promise<ActionSaveResult>`.
- Directory: `readDirectorDirectory(): Promise<{available:boolean;directors:Director[]}>`; retain `listDirectors(): Promise<Director[]>` for existing callers.

- [ ] **Step 1: Write auth, directory and conflict tests.**

```ts
it('rejects a client before loading an action', async () => {
  mocks.requireActionUser.mockResolvedValue({ ok: false, error: 'Director access required' });
  expect(await saveDeskAction(validInput)).toMatchObject({ ok: false, code: 'forbidden' });
  expect(mocks.readAction).not.toHaveBeenCalled();
  expect(mocks.execute).not.toHaveBeenCalled();
});
it('does not trust an assignee ID when the directory cannot be read', async () => {
  mocks.readResearchActor.mockRejectedValue(new Error('unavailable'));
  expect(await saveDeskAction(validInput)).toMatchObject({ ok: false, code: 'unavailable' });
  expect(mocks.execute).not.toHaveBeenCalled();
});
it('returns the latest record on conflict without revalidating a failed write', async () => {
  mocks.persist.mockResolvedValue({ ok: false, code: 'conflict', current: actionFixture({ version: 3 }) });
  expect(await saveDeskAction(validInput)).toMatchObject({ ok: false, code: 'conflict', current: { version: 3 } });
  expect(mocks.revalidatePath).not.toHaveBeenCalled();
});
```

Define these mocks with `vi.hoisted`; use the existing Clerk guard fixtures and mock `next/cache`. Add tests that ownerName for null is Unassigned and for an unresolved non-null ID is Assigned, name unavailable. A healthy empty directory differs from a failed directory.

- [ ] **Step 2: Implement parameterised persistence and typed results.**

```ts
const normalisedInput = {
  id: input.id, link: input.link,
  title: input.draft.title.trim(), description: input.draft.description.trim() || null,
  ownerId: input.draft.ownerId, dueDate: input.draft.dueDate,
  state: input.draft.state, stateReason: input.draft.stateReason.trim() || null,
  changeReason: input.draft.changeReason.trim() || null,
  saveUnassigned: input.draft.saveUnassigned,
};
const command = JSON.stringify(normalisedInput);
const requestHash = createHash('sha256').update(command).digest('hex');
const result = await requireDb().execute(sql`
  select desk_save_action(${actorId},${input.requestId}::uuid,${requestHash},
    ${input.expectedVersion},${command}::jsonb) as result
`);
```

Map snake-case rows once into `DeskAction`, including parent-column-to-WorkLink conversion. Cast counts explicitly with `::int`. Whitelist filters and use parameterised SQL clauses. `readActionViews` applies identical predicates to the total and row query; limit 50 only the row query. Completed-recent predicates compare `(completed_at AT TIME ZONE 'Europe/London')::date` with recentStart and today, inclusive, and require current state Completed. Build shared SQL predicates for both list/count and dashboard queries.

Every public server reader checks `requireResearchDirector()`; internal aggregation helpers accept an already-authorised actor without accepting a client-supplied identity. Resolve related labels through one query per parent type, not one per row. Use `getPursuit`/research masking for research-derived labels. Keep action content and history unavailable when a linked investigation/calendar is suppressed or outside QCS scope. A restricted relation can display an unavailable row without its title/description/history; suppress it consistently from dashboard previews and totals.

- [ ] **Step 3: Validate input, actor and parent before writes.**

```ts
export async function saveDeskAction(input: SaveActionInput): Promise<ActionSaveResult> {
  const actor = await requireActionUser();
  if (!actor.ok) return { ok: false, code: 'forbidden', error: actor.error };
  const current = input.expectedVersion === 0 ? null : await readAction(input.id);
  if (input.expectedVersion !== 0 && !current) return { ok: false, code: 'not_found', error: 'This action no longer exists' };
  const issue = actionIssue(input.draft, current);
  if (issue) return { ok: false, code: 'validation', error: issue };
  if (input.draft.ownerId && input.draft.ownerId !== current?.ownerId) {
    const selected = await readResearchActor(input.draft.ownerId);
    if (selected.role !== 'director') return { ok: false, code: 'validation', error: 'Choose a director' };
  }
  await validateActionLink(input.link);
  const result = await persistDeskAction(input, actor.userId);
  if (result.ok) revalidatePath('/portal', 'layout');
  return result;
}
```

Apply schema parsing before this core flow, wrap unavailable services in a typed friendly result, and return a serialised ActionView for both success/conflict. `validateActionLink(link): Promise<void>` lives in desk-action-links.ts and checks the exact parent, QCS workspace, evidence availability and active suppression where applicable. General links need no lookup. Do not allow Save to change a current link; use Detach to general. Keep the same requestId for a network retry with identical values; generate a new requestId after the user changes the draft.

Completion obtains the current action, constructs its unchanged draft plus Completed, and submits the same guarded persistence path. Reopen uses Save with To do, preserving history. On directory outage, existing assignments and action completion still work; choosing a different owner requires a successful exact actor lookup. Do not copy the old `setOwner` behaviour that trusts arbitrary IDs when listDirectors returns empty.

- [ ] **Step 4: Pass focused tests and commit.**

Run: `corepack pnpm exec vitest run src/lib/actions src/lib/portal/directors.test.ts src/lib/portal/director-helpers.test.ts`. Commit as `feat: add guarded action operations and reliable ownership`.

### Task 4: Action register and shared editor

**Files:**
- Create: `src/components/portal/actions/ActionEditor.tsx`, `ActionRow.tsx`, `ActionHistory.tsx`, `ActionRegister.tsx`, `RelatedActions.tsx`, `ActionEditor.test.tsx`, `ActionRegister.test.tsx`
- Create: `src/app/(portal)/portal/actions/page.tsx`
- Modify: `src/styles/globals.css` only for scoped `.home-dashboard` and `.action-register` classes

**Interfaces:**
- Consumes: Task 3 server functions, ActionView/ActionEvent/ActionQuery, the existing native-dialog SlideOver, directory availability.
- Produces: `ActionEditor({action,link,directory,onClose,onSaved})`, `ActionRow({action,onEdit,onComplete})`, `ActionRegister({rows,total,query,directory,now})`, `RelatedActions({link,rows,directory})`. The directory prop has `{available:boolean;directors:Director[]}` throughout.
- Editor action is `ActionView|null`, link is `WorkLink`; onSaved receives `ActionView`. A new draft receives stable action/request UUIDs from `crypto.randomUUID()` when opened. Keep UI state out of the SQL row types.

- [ ] **Step 1: Write behaviour tests for completion, failed saves and conflicts.**

```tsx
it('keeps the draft when another director has updated the action', async () => {
  const user = userEvent.setup();
  saveMock.mockResolvedValue({ ok: false, code: 'conflict', error: 'Another director updated this action', current: viewFixture({ version: 3 }) });
  render(<ActionEditor action={viewFixture()} link={{ kind: 'general' }} directory={directoryFixture} onClose={vi.fn()} onSaved={vi.fn()} />);
  await user.clear(screen.getByLabelText('Action'));
  await user.type(screen.getByLabelText('Action'), 'Call Matt about the revised scope');
  await user.click(screen.getByRole('button', { name: 'Save action' }));
  expect(screen.getByLabelText('Action')).toHaveValue('Call Matt about the revised scope');
  expect(screen.getByRole('alert')).toHaveTextContent('Another director updated this action');
  expect(screen.getByRole('button', { name: 'Review current record' })).toBeVisible();
});
it('shows the actual assignee separately from related work', () => {
  render(<ActionRow action={viewFixture({ ownerName: 'Mateo Diaz', relatedLabel: 'Kubik Construction' })} onEdit={vi.fn()} onComplete={vi.fn()} />);
  expect(screen.getByText('Mateo Diaz')).toBeVisible();
  expect(screen.getByText('Kubik Construction')).toBeVisible();
});
```

Keep viewFixture in a dedicated test-support file under `src/lib/actions/`, returning every ActionView field. Mock server functions at the module boundary. For native dialogs, define `HTMLDialogElement.prototype.showModal/close` only in the relevant test setup and assert focus restoration using the existing SlideOver contract.

- [ ] **Step 2: Build the editor with explicit Save and preserved drafts.**

```tsx
<form onSubmit={save} className="action-editor space-y-5">
  <label>Action<input value={draft.title} onChange={e => update({ title: e.target.value })} maxLength={240} /></label>
  <label>Assignee<select value={draft.ownerId ?? ''} disabled={!directory.available} onChange={e => update({ ownerId: e.target.value || null })}>
    <option value="">Unassigned</option>
    {directory.directors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
  </select></label>
  <label>Due date<input type="date" value={draft.dueDate ?? ''} onChange={e => update({ dueDate: e.target.value || null })} /></label>
  <label>Status<select value={draft.state} onChange={e => update({ state: e.target.value as ActionState })}>
    <option value="todo">To do</option><option value="in_progress">In progress</option>
    <option value="waiting">Waiting</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
  </select></label>
  {needsStateReason && <label>Reason<textarea value={draft.stateReason} onChange={e => update({ stateReason: e.target.value })} /></label>}
  {dateChanged && <label>Reason for changing the due date<textarea value={draft.changeReason} onChange={e => update({ changeReason: e.target.value })} /></label>}
  <label>Description<textarea value={draft.description} onChange={e => update({ description: e.target.value })} maxLength={4000} /></label>
  {error && <p role="alert">{error}</p>}
  <button type="submit" disabled={busy}>{busy ? 'Saving action' : 'Save action'}</button>
  {!draft.ownerId && <button type="button" disabled={busy} onClick={() => saveAsUnassigned()}>Save as unassigned</button>}
  <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
</form>
```

Define update as a functional setState merge. save prevents default, validates via actionIssue, sends the stable request UUID, and changes the view only on success. saveAsUnassigned sends an explicit local draft with saveUnassigned true, without racing a state update. A request timeout retains the exact request UUID; a subsequent edited draft gets a new one. dateChanged compares nullable original/current dates. needsStateReason is Waiting or Cancelled. An unresolved stored owner must be retained as a selected Assigned, name unavailable option, rather than disappearing from the select.

On conflict, show the current record alongside the preserved draft. Review current record does not silently overwrite the draft; a Use current record button loads current values, and Apply my changes explicitly uses the newly reviewed version with a new request UUID. Show history in the expanded panel with original/current due dates and event reasons. Completed/cancelled records show Reopen action rather than editable fields until reopened. Add Make next action for eligible pursuit actions and Retain as standalone with explicit linked-context confirmation.

- [ ] **Step 3: Build the list, URL filters and related panels.** The register page authorises before reads, parses searchParams, loads the requested page and independent total, and loads the directory. Provide filters Open, Overdue, Due today, Next 7 days, Unassigned, No due date, Recently completed and All, plus owner/status/related-work choices. Use a simple result count and previous/next pagination with page size 50. Every filter is a real link or form that survives refresh.

```tsx
<section aria-labelledby="actions-title" className="action-register">
  <header><h1 id="actions-title">Actions</h1><button onClick={openNew}>Add action</button></header>
  <p>{total} {total === 1 ? 'action' : 'actions'} in this view</p>
  <ul>{rows.map(action => <ActionRow key={action.id} action={action} onEdit={openEditor} onComplete={complete} />)}</ul>
  {rows.length === 0 && <p>No actions match these filters. Change the filters or add an action.</p>}
</section>
```

Define openNew to open a general-link editor; RelatedActions opens the same editor with its fixed relation. Row completion is an accessible button labelled `Complete action: ${action.title}`, disabled while saving, with inline failure text and no disappearance until success. Refresh the router after confirmed mutations so totals, history and parent summaries agree. Visible names, date text and status labels remain at 14 px or larger; interactive targets at least 44 px on phones. Do not nest an edit button inside a linked row or completion button.

- [ ] **Step 4: Pass component tests and commit.**

Run: `corepack pnpm exec vitest run src/components/portal/actions src/lib/actions` and `corepack pnpm exec tsc --noEmit`. Commit as `feat: add the shared action register and editor`.

### Task 5: Cut over lead actions and preserve independent review dates

**Files:**
- Create: `src/lib/portal/live-leads.ts`, `live-leads.test.ts`
- Modify: `src/lib/portal/actions.ts`, `actions.test.ts`, `board.ts`, `board.test.ts`
- Modify: `src/lib/db/pursuits.ts`
- Modify: `Desk.tsx`, `Board.tsx`, `PursuitCard.tsx`, `RevisitRow.tsx`, `StageList.tsx`, `PursuitShell.tsx`, corresponding tests under `src/components/portal/`
- Modify: `src/app/(portal)/portal/pursuits/[id]/page.tsx`

**Interfaces:**
- Consumes: readRelatedActions, chooseNextAction, reviewDue, RelatedActions.
- Produces: `LiveLead = {pursuit:Pursuit; nextAction:ActionView|null; reviewDue:string|null}` and `readLiveLeads(pursuits:Pursuit[]):Promise<LiveLead[]>`. One batched action/priority query for the provided IDs, no per-lead fetch loop.
- The board remains responsible for commercial stages; actions remain separate records.

- [ ] **Step 1: Write independence and preservation regression tests.**

```ts
it('keeps a dormant review date distinct from the nominated action date', async () => {
  const p = pursuitFixture({ stage: 'dormant', reviewDue: '2026-09-20' });
  const lead = liveLeadFixture({ pursuit: p, reviewDue: p.reviewDue,
    nextAction: viewFixture({ dueDate: '2026-09-14' }) });
  expect(lead.reviewDue).toBe('2026-09-20');
  expect(lead.nextAction?.dueDate).toBe('2026-09-14');
});
it('preserves open actions when a lead moves to instructed', async () => {
  await movePursuit('p1', 'instructed');
  expect(updatePursuitWithActivity).toHaveBeenCalledWith('p1', expect.objectContaining({ stage: 'instructed' }), expect.anything());
  expect(saveDeskAction).not.toHaveBeenCalled();
});
it('does not delete blobs when a parent deletion is refused', async () => {
  guardedDelete.mockResolvedValue({ ok: false, code: 'linked_actions' });
  expect(await deletePursuit('p1')).toMatchObject({ ok: false });
  expect(deleteObjects).not.toHaveBeenCalled();
});
```

The first test must also render RevisitRow and assert both labelled dates; the value-only assertions establish the fixture, while the UI assertion verifies the actual separation. Add fixtures with closed nominations and different lead/action owners.

- [ ] **Step 2: Replace every production read of legacy nextAction fields.** Desk/Board/Card receive LiveLead records, not raw pursuit next-action fields. Board scope follows pursuit.ownerId, while each card visibly labels its selected action assignee. Sort active cards by resolved action date and stage age; sort dormant review rows by reviewDue. Display stage age as `In proposal for 3 days`, not `3 days` alone.

PursuitShell gets a linked action panel and a resolved next-action summary. Remove its setNextAction import, inline autosave and legacy optimistic text/date patches. Retire the exported setNextAction mutation with a typed message directing an obsolete client to refresh; it must never write the legacy fields after cutover. Preserve next_action_set history as historical entries. Keep the old component file only if a remaining caller needs it; remove its obsolete tests when the component is removed, with replacement editor tests already passing.

Move-to-dormant writes reviewDue, not nextActionDue; reopening clears reviewDue without modifying any action. Update both Desk and PursuitShell optimistic patches, the SQL dormant ordering, RevisitRow, StageList and date tests. Add reviewDue:null to every existing strongly typed Pursuit fixture affected by the schema extension.

- [ ] **Step 3: Review remaining actions after all stage-change entry points.** After a confirmed stage change, show `Stage updated. Review the N open actions linked to this lead.` with an Actions link when N is non-zero. Apply through the shared mutation result/handler so Stepper, MoveToMenu, inbox decline and reopen all use it. Do not require an extra stage change approval; this is a review affordance and never auto-completes actions.

- [ ] **Step 4: Protect deletion before touching S3.** Direct pursuit and child-programme action FKs use RESTRICT. The repository performs the actual database delete before any blob deletion, returning the captured document keys only when the delete succeeds. Prefer a single transaction/function locking the pursuit and its cascade targets, collecting keys and deleting the pursuit. A newly created action racing deletion either wins the FK lock and blocks deletion, or loses to a deleted parent; it cannot lead to deleted blobs after a refused row deletion. The SQL result is `{ok:true,blobKeys:string[]}` or `{ok:false,code:'linked_actions'|'not_found'}`.

```ts
const result = await deletePursuitGuarded(id);
if (!result.ok) return { ok: false, error: result.code === 'linked_actions'
  ? 'Retain linked actions as standalone records before deleting this live lead'
  : 'This live lead no longer exists' };
await deleteObjects(result.blobKeys);
return { ok: true };
```

Handle an S3 cleanup failure as a recorded cleanup failure after successful row deletion, not as a false refusal of the deletion. Preserve existing document scope protections and any concurrent client-file retention changes at integration. Do not delete shared library or retained client files. Add an integration test for child-programme actions and a concurrent parent-delete/action-create pair.

- [ ] **Step 5: Run regression tests and commit.**

Run: `corepack pnpm exec vitest run src/lib/portal src/components/portal/Board.test.tsx src/components/portal/MoveToMenu.test.tsx src/components/portal/Stepper.test.tsx src/components/portal/actions` and the isolated action SQL suite. Commit as `feat: connect live leads to accountable actions`.

### Task 6: Read-only dashboard aggregates and source boundaries

**Files:**
- Create: `src/lib/dashboard/types.ts`, `read.ts`, `context.ts`, `research.ts`, `read.test.ts`, `context.test.ts`, `research.test.ts`
- Create: `src/lib/db/desk-action-filter.ts` for shared parameterised filter predicates
- Modify: `src/lib/db/desk-actions.ts` to consume those same predicates

**Interfaces:**
- Consumes: action register reads, dateWindow, requireResearchDirector, `workflowRows<T>(sql)`, QCS_WORKSPACE_ID, existing schema and masking.
- Produces: `readDashboard(scope:'team'|'mine',now:Date):Promise<DashboardView>`, `readActionSummary(actorId,scope,window)`, `readTeamAccountability(window)`, `readLeadSummary(actorId,scope)`, `readProspectSummary()`, `readProgrammeSummary()`, `readResearchSummary(actorId,scope,window)`, `readResearchAgenda(actorId,scope,window)`, `readRecentProgress(window)`.

```ts
export type SectionResult<T> = { ok: true; data: T } | { ok: false; error: string };
export type ActionCounts = { overdue: number; today: number; upcoming: number; unassigned: number; undated: number; open: number };
export type TeamRow = { ownerId: string | null; ownerName: string; open: number; overdue: number; upcoming: number; completedRecent: number };
export type AgendaEntry = { id: string; date: string; title: string; kind: 'action'|'review'|'research'; href: string; ownerName: string | null; qualification: string | null };
export type LeadSummary = { stages: Record<PursuitStage,number>; withoutOwner: number; withoutAction: number; exceptionRows: {id:string;firm:string;missingOwner:boolean;missingAction:boolean}[] };
export type ProspectSummary = { statuses: Record<ProspectOutreach,number>; availableToApproach:number };
export type ProgrammeSummary = { uploaded:number; analysing:number; analysed:number; analysisFailed:number; parseNeedsAttention:number };
export type ResearchSummary = { runningInvestigations:number; queuedInvestigations:number; signalsAwaitingReview:number; reportsAwaitingReview:number; failedLatestRuns:number };
export type ProgressEntry = { id:string; at:string; title:string; actorName:string; href:string; kind:'action'|'lead'|'research' };
export type DashboardView = {
  scope:'team'|'mine'; today:string; refreshedAt:string;
  directory: {available:boolean;directors:Director[]};
  actions:SectionResult<{counts:ActionCounts;rows:ActionView[];unassignedTeam:number}>;
  team:SectionResult<TeamRow[]>; leads:SectionResult<LeadSummary>;
  prospects:SectionResult<ProspectSummary>; programmes:SectionResult<ProgrammeSummary>;
  research:SectionResult<ResearchSummary>; agenda:SectionResult<{entries:AgendaEntry[];warnings:string[]}>;
  progress:SectionResult<ProgressEntry[]>;
};
```

Import the referenced Director/PursuitStage/ProspectOutreach/ActionView types from the existing or Task 1 modules. Agenda rows identify record kind; reviewed research dates remain qualified as recorded dates, not assigned actions.

- [ ] **Step 1: Write aggregation and partial-failure tests.**

```ts
it('uses complete totals rather than the eight preview rows', async () => {
  readers.actions.mockResolvedValue({ counts: { overdue: 17, today: 3, upcoming: 5, unassigned: 2, undated: 1, open: 27 }, rows: eightActions, unassignedTeam: 2 });
  const view = await readDashboard('team', fixedNow);
  expect(view.actions).toMatchObject({ ok: true, data: { counts: { overdue: 17 } } });
});
it('keeps actions usable when a context reader fails', async () => {
  readers.programmes.mockRejectedValue(new Error('database unavailable'));
  const view = await readDashboard('mine', fixedNow);
  expect(view.actions.ok).toBe(true);
  expect(view.programmes).toEqual({ ok: false, error: 'Could not load programme analysis' });
  expect(readers.team).toHaveBeenCalledWith(expect.any(Object));
});
it('excludes provisional, suppressed and unsupported research dates', async () => {
  const rows = await readResearchAgenda('director', 'team', dateWindow(fixedNow));
  expect(rows.map(r => r.id)).toEqual(['reviewed-available-unsuppressed']);
});
```

Use mocks for the first two tests; run the third against a synthetic query fixture exercising the real SQL, including revoked versus expired suppressions, unavailable evidence, null entity IDs and record-specific suppression. Add tests that prospect converted/parked/do_not_approach records do not enter availableToApproach and that a newer failed programme report takes precedence over an older successful one.

- [ ] **Step 2: Implement shared action predicates and exact aggregates.**

```sql
SELECT
  count(*) FILTER (WHERE state IN ('todo','in_progress','waiting'))::int AS open,
  count(*) FILTER (WHERE state IN ('todo','in_progress','waiting') AND due_date < :today)::int AS overdue,
  count(*) FILTER (WHERE state IN ('todo','in_progress','waiting') AND due_date = :today)::int AS today,
  count(*) FILTER (WHERE state IN ('todo','in_progress','waiting') AND due_date > :today AND due_date <= :upcoming_end)::int AS upcoming,
  count(*) FILTER (WHERE state IN ('todo','in_progress','waiting') AND owner_id IS NULL)::int AS unassigned,
  count(*) FILTER (WHERE state IN ('todo','in_progress','waiting') AND due_date IS NULL)::int AS undated
FROM desk_actions
WHERE (:mine = false OR owner_id = :actor);
```

The colon bindings above are parameter positions: implement using Drizzle `sql` tagged values, never textual replacement. Add the Task 3 relation-visibility predicate to both aggregates and list reads. Team accountability groups by stored owner_id across the same visible action set without the personal predicate, using completedRecent from the specified London date range and current completed state. Union the returned owner IDs with the successful directory list so a director with zero recorded actions still appears; preserve unknown IDs separately from null. Counts in each owner row link with scope=team and that exact owner.

The Home preview is unfinished actions with dates through upcomingEnd, ordered due_date, created_at, id, limit 8. Include every overdue action regardless of age. Missing dates remain in the undated exception count; unassigned team notice uses an independent team aggregate in My work. Read the action agenda from today inclusive to agendaEnd exclusive. Queries use one supplied request timestamp, including suppression expiry comparisons, instead of independently evaluating now().

For lead stages include unowned rows, filter by lead owner only for My work, and count withoutAction by `NOT EXISTS` of an unfinished linked action. Exception preview is at most 6 leads, ordered missing owner first then creation date; totals remain independent. A nominated closed action does not count as open.

- [ ] **Step 3: Implement programme and prospect context with bounded SQL.**

Prospect statuses are `unworked`, `approaching`, `contacted`, `parked`, `converted`, `do_not_approach`. Initialise every enum key to zero, then fill from GROUP BY outreach_status. availableToApproach requires `conflict_tier='latent_conflict' AND outreach_status='unworked' AND converted_pursuit_id IS NULL`. Retain the existing prospect classification language and do not relabel this count as qualified leads.

```sql
SELECT count(*)::int AS uploaded,
  count(*) FILTER(WHERE p.parse_status IN('failed','empty'))::int AS "parseNeedsAttention",
  count(*) FILTER(WHERE r.status='running')::int AS analysing,
  count(*) FILTER(WHERE r.status='complete')::int AS analysed,
  count(*) FILTER(WHERE r.status='failed')::int AS "analysisFailed"
FROM programmes p
LEFT JOIN LATERAL (
  SELECT pr.status FROM programme_reports pr WHERE pr.programme_id=p.id
  ORDER BY pr.created_at DESC,pr.id DESC LIMIT 1
) r ON true;
```

Do not load schedule/report JSON or call expireStaleProgrammeReports. Counts describe latest analysis attempts. They are team totals and do not use created_by as ownership.

- [ ] **Step 4: Implement evidence-aware research summaries and agenda.** The base investigation status `active` does not mean running. Use a lateral latest-run query and count its queued/running/failed/incomplete states by investigation. Exclude automatic source-only runs from investigation counts. My work filters `research_investigations.owner`.

For signalsAwaitingReview use `status='unreviewed'`, `NOT stale`, `research_signal_available(s.id)`, QCS workspace and no active suppression against signal, entity or investigation. reportsAwaitingReview requires draft, at least one evidence reference, every reference present in research_available_passages, and no investigation/report suppression. All totals are SQL aggregates, not existing capped list lengths.

```sql
SELECT c.id,c.investigation_id,c.kind,c.proposed_date::text AS date,c.assumptions,
  i.owner,c.reviewed_by,e.display_name
FROM research_calendar c
JOIN research_investigations i ON i.id=c.investigation_id AND i.workspace_id=c.workspace_id
LEFT JOIN research_entities e ON e.id=c.entity_id AND e.workspace_id=c.workspace_id
WHERE c.workspace_id=:workspace
  AND c.state='reviewed' AND c.reviewed_by IS NOT NULL
  AND c.proposed_date>=:today AND c.proposed_date<:agenda_end
  AND (:mine=false OR i.owner=:actor)
  AND jsonb_array_length(c.evidence)>0
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(c.evidence) ref
    WHERE NOT EXISTS (SELECT 1 FROM research_available_passages p
      WHERE p.workspace_id=c.workspace_id
        AND p.document_id=(ref->>'documentId')::uuid
        AND p.version_id=(ref->>'versionId')::uuid
        AND p.passage_id=(ref->>'passageId')::uuid))
  AND NOT EXISTS (SELECT 1 FROM research_suppressions x
    WHERE x.workspace_id=c.workspace_id
      AND x.target IN(c.id,c.entity_id,c.investigation_id)
      AND x.revoked_at IS NULL AND (x.expires_at IS NULL OR x.expires_at>:request_time))
ORDER BY c.proposed_date,c.id LIMIT 8;
```

Implement bindings with tagged SQL and use fixed QCS_WORKSPACE_ID. Keep source kind and assumptions accessible in the agenda details. The current schema stores date-only values and cannot prove precision beyond that; label research entries Reviewed research date and preserve its kind/assumptions. No computed legal deadline and no completion control. Link to the corresponding investigation/calendar view and offer Add action with a calendar relation.

For recent progress, read up to 8 latest entries from each source (action completion events, lead stage changes/reopening, research signal decisions), apply masking/suppression before limiting, merge by timestamp/id and take the latest 8. This produces the global top eight without scanning per-record timelines. Show generic source-changed text when permitted historical decisions lose their evidence, never the old note. Omit ordinary system scans. Use Recorded stage change, not an inferred proposal submission.

- [ ] **Step 5: Compose independent failures without changing data.**

```ts
async function section<T>(work: () => Promise<T>, error: string): Promise<SectionResult<T>> {
  try { return { ok: true, data: await work() }; }
  catch { return { ok: false, error }; }
}
```

Authorise once before starting parallel reads. Call each named reader through section and await Promise.all. None may import ensureProspectsSeeded, expireStaleProgrammeReports, source runners or write functions. Agenda source failures preserve usable action/review entries: return the available entries and explicit warnings for failed sources in the declared agenda contract. Only fail the entire agenda when every source fails.

- [ ] **Step 6: Pass aggregation/visibility tests and commit.**

Run: `corepack pnpm exec vitest run src/lib/dashboard src/lib/actions/filters.test.ts` plus the synthetic SQL cases. Commit as `feat: aggregate truthful dashboard summaries`.

### Task 7: Build Home with actions, dates and team accountability

**Files:**
- Create: `src/components/portal/dashboard/HomeDashboard.tsx`, `AttentionSummary.tsx`, `Agenda.tsx`, `TeamAccountability.tsx`, `ContextSummary.tsx`, `ProgressFeed.tsx`, `ScopeControl.tsx`, `SectionFailure.tsx`, `HomeDashboard.test.tsx`
- Modify: `src/app/(portal)/portal/page.tsx`, `src/styles/globals.css`

**Interfaces:**
- Consumes: DashboardView, shared ActionRow/ActionEditor, actionQueryHref and readDashboard.
- Produces: the approved Home route with an independent scope preference and real filter links.

- [ ] **Step 1: Test Home against the approved example and sparse/failure states.**

```tsx
it('makes actions and missing commitments visible above commercial context', () => {
  render(<HomeDashboard view={dashboardFixture()} />);
  expect(screen.getByRole('heading', { name: 'Home', level: 1 })).toBeVisible();
  expect(screen.getByText('Call Matt Bruce about the curtain wall scope')).toBeVisible();
  expect(screen.getByText('L&Q needs a next action')).toBeVisible();
  expect(screen.getByRole('link', { name: /17 overdue actions/ })).toHaveAttribute('href', expect.stringContaining('filter=overdue'));
  expect(screen.getByRole('link', { name: 'Open live leads' })).toHaveAttribute('href', '/portal/pursuits');
});
it('keeps team accountability explicitly team-wide in My work', () => {
  render(<HomeDashboard view={dashboardFixture({ scope: 'mine' })} />);
  expect(screen.getByRole('heading', { name: 'Team accountability' })).toBeVisible();
  expect(screen.getByText('Team-wide unassigned actions')).toBeVisible();
});
```

Use fixture values labelled as test data only in the test/dev preview. Never ship mock fallback business records. Test that a failed section renders its message and Retry rather than zero or a success statement.

- [ ] **Step 2: Implement the server Home page and scope control.**

Home searchParams supports a legacy valid stage redirect before reading the overview. Scope is an explicit URL value if valid, otherwise home_scope cookie, otherwise team. Authorise with requireResearchDirector even when a layout already does so. Missing configuration may use SetupNotice; an ordinary query failure stays inside its section.

```tsx
const params = await searchParams;
if (['dormant','instructed','declined'].includes(params.stage ?? ''))
  redirect(`/portal/pursuits?stage=${params.stage}`);
const jar = await cookies();
const scope = params.scope === 'mine' || params.scope === 'team'
  ? params.scope : jar.get('home_scope')?.value === 'mine' ? 'mine' : 'team';
await requireResearchDirector();
return <HomeDashboard view={await readDashboard(scope, new Date())} />;
```

ScopeControl updates the preference cookie with path `/portal`, SameSite=Lax and a one-year max-age, then navigates to Home with the chosen scope. This is presentation preference only. Links from totals include scope explicitly. Refresh dates after confirmed action writes; do not leave an old overdue count beside a newly completed row.

- [ ] **Step 3: Build the two-thirds action layout and quieter context.**

```tsx
<div className="home-dashboard">
  <header className="home-header"><div><h1>Home</h1><p>{displayDate(view.today)}</p></div><ScopeControl scope={view.scope} /><button onClick={openNewAction}>Add action</button></header>
  <AttentionSummary result={view.actions} scope={view.scope} />
  <div className="home-work-grid">
    <section aria-labelledby="attention-heading"><h2 id="attention-heading">Actions requiring attention</h2>{actionContent}</section>
    <Agenda result={view.agenda} />
  </div>
  {commitmentExceptions}
  <div className="home-context-grid"><TeamAccountability result={view.team} /><ContextSummary kind="leads" result={view.leads} /></div>
  <div className="home-summary-grid">{workspaceSummaries}</div>
  <ProgressFeed result={view.progress} />
</div>
```

Define actionContent as the section result branch: error component, empty factual message or ActionRow list plus View all actions. commitmentExceptions renders missing lead owner/action counts, undated action count and labelled team unassigned notice. workspaceSummaries is the prospects, research and programme panels with Team totals labels where specified. These are explicit JSX branches, not fake data for loading/failure.

Use brand token values from the spec. Page background cream, section surfaces parchment only where grouping is useful; racing green for primary text and action controls, ink for task data, oxblood with text for overdue/failure. Cormorant page/section headings and Inter operational text; no new all-caps or monospaced labels. At desktop use `grid-template-columns:minmax(0,2fr) minmax(280px,1fr)` with 28 px gaps, and at widths below 900 px stack. No fixed card heights. At 390 px render action rows as vertical records and prevent the owner/date from being clipped.

Keep the first viewport devoted to attention counts and actual commitments. Do not use the date as the largest content block. The primary visual distinction is aligned action/person/date information. No percentage gauges or financial pipeline total. Source summaries link directly to their workspace, and every action count opens the matching register filter.

- [ ] **Step 4: Pass Home tests and commit.**

Run: `corepack pnpm exec vitest run src/components/portal/dashboard src/lib/dashboard` and `corepack pnpm exec tsc --noEmit`. Commit as `feat: replace Home with the directors dashboard`.

### Task 8: Separate Live leads and make navigation usable on phones

**Files:**
- Create: `src/app/(portal)/portal/pursuits/page.tsx`, `src/lib/portal/navigation.ts`, `src/components/portal/PortalNavigation.tsx`, `PortalNavigation.test.tsx`
- Modify: portal `layout.tsx`, `NavLink.tsx`, `StageList.tsx`, `PursuitShell.tsx`, pursuit not-found page, `next.config.ts`
- Modify visible terminology in `NewPursuitButton.tsx`, `PursuitForm.tsx`, `ProspectConvertButton.tsx` and research conversion controls

**Interfaces:**
- Consumes: the existing Desk and StageList with Task 5 LiveLead projections.
- Produces: `/portal/pursuits` with the existing stage workflows; shared navigation config for desktop and mobile.

- [ ] **Step 1: Test exact Home and nested Live leads selection.**

```tsx
it.each(['/portal/pursuits','/portal/pursuits/p1'])('selects Live leads at %s', path => {
  pathnameMock.mockReturnValue(path);
  render(<PortalNavigation />);
  expect(screen.getByRole('link', { name: 'Live leads' })).toHaveAttribute('aria-current','page');
  expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
});
```

Add mobile tests for menu opening, Escape closing and focus returning to its trigger. Add a server-page test that a valid legacy stage redirects and an invalid one renders Home.

- [ ] **Step 2: Move the existing board into the new route.** Move the previous Home board implementation, including deskExtras, StageList and footer. Replace its header with Live leads and New live lead. Remove the prospects seed/count calls from this page. Do not create new pursuits merely by reading it. Preserve inbox claiming, revisits, stage transitions and all dossier IDs.

```ts
export const PORTAL_NAV = [
  { href:'/portal', label:'Home', exact:true },
  { href:'/portal/actions', label:'Actions', exact:false },
  { href:'/portal/pursuits', label:'Live leads', exact:false },
  { href:'/portal/prospects', label:'Prospects', exact:false },
  { href:'/portal/programmes', label:'Programmes', exact:false },
  { href:'/portal/research', label:'Research', exact:false },
  { href:'/portal/library', label:'Library', exact:false },
] as const;
```

NavLink only needs exact/prefix matching; remove the old desk special case. Build the mobile menu with the existing native dialog pattern and clear Navigation label, close on selection and restore focus. Desktop sidebar remains 224 px, preserving the wordmark and director menu. Portal title/descriptor becomes Directors' workspace. Programme and research routes retain their existing nesting and noindex behaviour.

Update StageList Back to live leads, dossier back/delete return, pursuit not-found return, and old `/portal/leads` redirect to `/portal/pursuits`. Stage footer links use `/portal/pursuits?stage=...`. Keep sign-in landing and brand Home links at `/portal`.

- [ ] **Step 3: Align visible terminology without changing internal IDs.** New live lead, Create live lead, View live lead, Convert to live lead and Delete live lead replace the corresponding user-facing pursuit phrases. Keep historical stored activity bodies and internal variable/API names intact. Use `rg -n 'New pursuit|Create pursuit|View pursuit|Back to the desk|Open as pursuit|Convert to a pursuit' src` to locate any remaining active UI copy, then inspect before editing.

- [ ] **Step 4: Verify navigation and commit.**

Run: `corepack pnpm exec vitest run src/components/portal/PortalNavigation.test.tsx src/components/portal/Board.test.tsx src/components/portal/MoveToMenu.test.tsx`. Commit as `feat: separate Live leads from Home navigation`.

### Task 9: Related work and the questions drawer share the action record

**Files:**
- Modify: `src/app/(portal)/portal/prospects/[id]/page.tsx`, `programmes/[id]/page.tsx`, `research/investigations/[id]/page.tsx`
- Modify: `src/lib/questions/system-prompt.ts`, `questions.test.ts`, `src/app/api/portal/pursuits/[id]/questions/route.ts`
- Create: focused related-panel tests beside `RelatedActions.tsx`

**Interfaces:**
- Consumes: RelatedActions and readRelatedActions, Task 5 resolved next action.
- Produces: linked action creation/history on each relevant record and an action-aware `buildSystemPrompt` context.

- [ ] **Step 1: Test that the questions context uses current actions, not legacy text.**

```ts
it('includes the recorded assignee and status of the current action', () => {
  const prompt = buildSystemPrompt({ ...questionContextFixture,
    actions: [viewFixture({ title:'Confirm the revised scope', ownerName:'Mateo Diaz', state:'waiting', stateReason:'Client confirmation', dueDate:'2026-09-18' })],
    nextActionId: actionIdFixture,
    reviewDue: '2026-09-25',
  });
  expect(prompt).toContain('Confirm the revised scope');
  expect(prompt).toContain('Mateo Diaz');
  expect(prompt).toContain('Waiting');
  expect(prompt).not.toContain('obsolete legacy next action');
});
```

The fixture's pursuit.nextAction contains obsolete legacy next action so the negative assertion proves the cutover. Include the separate reviewDue label. Preserve existing prompt injection fencing and evidence-source boundaries.

- [ ] **Step 2: Add shared related panels with server-side relation checks.**

```tsx
const link = { kind: 'programme', id } as const;
const [rows, directory] = await Promise.all([readRelatedActions(link), readDirectorDirectory()]);
return <><ExistingProgrammeContent /><RelatedActions link={link} rows={rows} directory={directory} /></>;
```

Integrate this composition into the actual existing JSX rather than replacing it with a new ExistingProgrammeContent abstraction unless needed to keep the file clear. Programme link uses the stable programme ID. Prospect uses its existing text ID. The research investigation wrapper awaits params, authorises, validates getInvestigation(id) in QCS scope, then renders the existing ResearchWorkspace plus the separate related panel. Do not grow the research client's loosely typed row state to contain actions.

The Home research agenda opens the editor with `kind:'calendar'`; resolve its label/date server-side and keep the source qualification visible. Do not assume the investigation owner is the action assignee. Assignment must be explicitly confirmed.

- [ ] **Step 3: Update Ask context and test.** Extend `buildSystemPrompt` input with `actions:ActionView[]`, `nextActionId:string|null`, `reviewDue:string|null`. The questions route reads the same linked action views and nomination as the dossier. Include open action titles, assigned names, state, due dates and nominated action, with limited field lengths through the existing fencing. Do not infer completion from legacy activity or include unavailable research action content. Keep nextAction fields out of the prompt.

- [ ] **Step 4: Run related/Ask regression tests and commit.**

Run: `corepack pnpm exec vitest run src/lib/questions src/components/portal/actions` and `corepack pnpm exec tsc --noEmit`. Commit as `feat: share action accountability across related work`.

### Task 10: Verify the joined flows and finish on the separate branch

**Files:**
- Create: `docs/reviews/2026-09-12-home-dashboard-verification.md`
- Create: `docs/reviews/home-dashboard/` for synthetic screenshots and fixture evidence
- Modify: README with Actions/Home routes and safe verification commands

**Interfaces:**
- Consumes: all completed tasks and the approved spec's 11 acceptance checks.
- Produces: a reviewable, tested branch with no merge or deployment.

- [ ] **Step 1: Run the complete local suite and isolated database invariants.**

```sh
corepack pnpm test
HOME_TEST_CONTAINER=meritus-home-test corepack pnpm exec vitest run src/lib/db/desk-actions.integration.test.ts
corepack pnpm exec eslint src
corepack pnpm exec tsc --noEmit
env -u DATABASE_URL corepack pnpm exec next build
```

The worktree has no environment files. Verify that remains true before compilation; Next can load a local env file even when DATABASE_URL is removed from the inherited environment. Do not run the package build command, which has a migration pre-hook. Report any unavailable external service separately from test failures. Required new SQL invariants must run, not remain in the default skipped group.

- [ ] **Step 2: Exercise the approved workflows using synthetic data.** In an isolated local preview, test create, assign, waiting, reschedule with reason, complete, reopen, cancel, nominate and detach. Follow action and owner-count links and compare the resulting filtered records. Verify My work with a lead owned by one director and its action assigned to another. Simulate Clerk-directory and individual dashboard reader failures. Confirm a failed write preserves the draft.

For browser review, use the available browser tooling and screenshots, with synthetic fixtures only. Do not add a production authentication bypass. If the live Clerk sign-in cannot be used against an isolated database, render the actual HomeDashboard and action components in a local fixture harness outside production routes, using the existing bundler/test toolchain. A component preview does not prove live authentication, database migration or production acceptance; state that limit precisely.

- [ ] **Step 3: Review 1440 px and 390 px layouts and keyboard operation.** Confirm the first viewport shows meaningful commitments, long organisation names wrap, dates/owners remain legible, status has text labels, navigation works without horizontal overflow and keyboard focus remains visible. Test dialog close/return focus and reduced motion. Save screenshots in `docs/reviews/home-dashboard/`, never a session scratch directory. Review them and fix visible defects before reporting completion.

- [ ] **Step 4: Check preservation, source truth and permission boundaries.**

```sh
rg -n 'nextAction|nextActionDue' src/lib/questions src/components/portal src/lib/portal
rg -n 'ensureProspectsSeeded|expireStaleProgrammeReports' src/lib/dashboard
git diff --check
git status --short --branch
```

Inspect remaining legacy references: only migration, retired mutation compatibility and historical type fields may remain. Board/Ask views must use the action register; dormant displays must use reviewDue. A zero-result rg search is success. Document idempotent import results, clock-change tests, FK/deletion races and suppression/availability checks. Confirm the diff does not include other agents' research-source or client-access implementation.

- [ ] **Step 5: Record verification and final branch state.** The review document includes exact commit, test counts, SQL test results, screenshots, any pre-existing warnings and limitations of local fixture validation. Commit documentation as `docs: record Home dashboard verification`. Keep branch `codex/home-dashboard` separate. Do not merge, push or deploy without a further user instruction.

## Plan self-review and acceptance mapping

| Approved acceptance | Implementation and evidence |
|---|---|
| Home landing and separate Live leads selection | Tasks 7, 8 and navigation tests |
| L&Q missing action and Kubik dated commitment | Tasks 2, 5, 7 and synthetic Home fixture |
| Create/assign/complete/reopen consistency | Tasks 2, 3, 4, 9 and SQL/UI tests |
| Rescheduling/history/waiting/cancellation | Tasks 1, 2, 3, 4 |
| London date boundaries and clock changes | Tasks 1, 6 and fixed-clock tests |
| Assignee differs from lead owner | Tasks 5, 6, 7, 9 |
| Unresolved directory entries remain assigned | Tasks 3, 4, 6 |
| Counts exceed preview correctly; exact filter links | Tasks 1, 3, 6, 7 |
| Partial failures, client exclusion and research scope | Tasks 3, 6, 7, 9 |
| Idempotent import, concurrency and deletion protection | Tasks 2, 5 and isolated SQL tests |
| Desktop/mobile and keyboard quality | Tasks 4, 7, 8, 10 |

The root agent performs the final plan self-review: reconcile every interface above, inspect the migration and SQL-state requirements, and remove incomplete implementation instructions. Agent exploration supplied source facts; it did not replace the root's coverage and consistency review. Execution uses independent workers only where file ownership and dependencies permit it.
