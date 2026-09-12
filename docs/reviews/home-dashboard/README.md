# Home dashboard review

12 September 2026

Implemented on `codex/home-dashboard` in the isolated `home-dashboard` worktree. The branch is unmerged and has not been pushed or deployed.

## Delivered behaviour

Home now gives directors an overview of commitments: overdue actions, work due today, the next seven days, missing assignments and dates, team accountability, upcoming dates and recorded progress. Live leads has its own workspace, with commercial stage summaries and direct links from Home. Prospects, research and programme analysis remain separate workspaces with compact summaries.

The action register supports named assignees, explicit due dates, waiting reasons, completion, reopening, history and version conflict review. The same action records appear on their related lead, prospect, programme or research record. Ask receives the current open actions, their statuses and reasons, and the selected next action.

Team is the default Home scope. My work follows the action assignee; the accountability table remains explicitly team-wide. Dates use the London calendar. An action due today is overdue only after that date has passed. Dormant lead review dates are separate from action deadlines.

Legacy next actions are preserved as unassigned action records with their exact text and dates. The prior lead owner is a suggestion, never an inferred assignee. Stage changes preserve unfinished actions. Restrictive database references prevent deleting a lead or its child programme while linked actions remain; database deletion succeeds before blob cleanup starts.

## Validation

- 701 distinct tests passed, including 17 isolated action SQL tests and seven dashboard SQL tests.
- 54 existing opt-in tests remained skipped.
- TypeScript, ESLint and production compilation passed; 47 pages generated.
- Independent reviews passed after correcting lifecycle, replay, conflict, migration ordering, action-link and aggregation findings.

See [full test results](verification-test-results.md).

## Visual review

Browser checks exercised the production React components at 1440px desktop and 390px mobile using clearly labelled synthetic local fixtures. No production data was fetched or changed. These checks covered sparse, busy, empty and partial-failure views, action creation, completion, filter navigation, mobile navigation and the editor.

- [Desktop, sparse](desktop-sparse.png)
- [Desktop, busy](desktop-busy.png)
- [Desktop, one unavailable section](desktop-partial-failure.png)
- [Mobile, busy](mobile-busy.png)
- [Mobile, empty](mobile-empty.png)
- [Mobile, action register](mobile-register.png)

The local fixture preview can be started from this worktree with:

```sh
node docs/reviews/home-dashboard/preview/serve.mjs
```

Then open `http://127.0.0.1:4318/`. Add `?scenario=sparse`, `?scenario=empty` or `?scenario=error` for the reviewed states. The fixture wrapper and fake save functions are outside production routes. Preview records reset when the page reloads and are not a persistence test; database persistence was tested separately in isolated PostgreSQL.

## Deployment boundary

Migration 0009 and its legacy reconciliation have been tested locally, including migration selection on a database already through 0008. They have not been applied to production. Review production reconciliation before any later deployment. This delivery deliberately stops at the tested, unmerged branch as requested.
