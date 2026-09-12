# Combined Home dashboard and automatic research verification

12 September 2026

Final checks passed on the frozen `sources-clarity` worktree after incorporating the published Home dashboard migration. Runtime application source was unchanged during verification. The migration-order test was updated to cover the combined release.

| Check | Result |
| --- | --- |
| Fresh database installation, migrations 0000 through 0010 | All 11 applied successfully in one transaction |
| Actual Drizzle migration reader and dialect | 11 unique, strictly increasing entries; only 0010 selected after the published dashboard 0009 |
| Upgrade selection regression tests | From 0008: dashboard 0009 then research 0010; from 0009: only 0010; from 0010: no migration |
| Updated cancellation function | Confirmed `research_cancel_run(uuid)` contains quick-question cancellation |
| Five existing research SQL test files against migration 0010 | 53 passed; 1 Neon HTTP adapter test skipped |
| New automatic research SQL test file | 16 passed |
| Home action persistence SQL suite | 17 passed |
| Home dashboard SQL queries | 7 passed |
| Full default Vitest run | 863 passed; the 94 opt-in SQL tests were skipped in this run |
| TypeScript | Passed |
| ESLint | Passed |
| Whitespace checks | Passed |

Across the default and isolated SQL runs, 956 unique tests passed. The isolated run passed all eight test files, with 93 passed tests and one skip. The remaining test requires an external isolated Neon HTTP database URL, which was deliberately not supplied. There were no failing application tests in the final runs. The default run emitted the existing Node module-type warning for `split-csv.ts`.

SQL checks used PostgreSQL 15.19 in the local `qcs-research-test-automtxvfwau` container with Docker network mode `none`. Eight uniquely named disposable databases were created, then removed. A subsequent database query confirmed that no verification databases remained. No production database credentials or live model calls were used.

The existing SQL harnesses hard-code several database names, and the intelligence harness normally recreates only migrations 0000 through 0006. Verification-only copies redirected these names to disposable databases and changed that cutoff to 0010. The Home adapter copies used the same isolated container with separate action and dashboard databases. Relative imports and mocks pointed back to the original application modules. SQL test assertions were unchanged. The copies and their temporary Vitest configuration were removed after the run. The reproducible SQL runner below applies these adaptations automatically.

The published dashboard migration retains timestamp `1789228800006`. Quick research is now `0010_qcs_research_quick`, timestamp `1789228800007`, with unchanged SQL hash `702c2ba6feb54de76544529ee8b3645fd160914481996b21230af2010e41c389`. The actual Drizzle migration reader and PostgreSQL dialect verified that this is the sole pending migration for a database already through the dashboard migration.

Commands, executed from the worktree root:

```sh
corepack pnpm exec node docs/reviews/automatic-research-verification/verify-sql.mjs
corepack pnpm exec vitest run
corepack pnpm exec tsc --noEmit --incremental false
corepack pnpm lint
git diff --check
```

The default Vitest command ran with database, opt-in research and Home SQL, Clerk, AI and mail service environment variables removed. The SQL runner removes service credentials and sets only its explicit local test configuration. The production build and migration script were not run by this verifier; the coordinating task owns the final Next.js build.

Detailed results are in `sql-integration.log`, `sql-verification.json`, `full-vitest.log`, `typescript.log` and `lint.log` alongside this report.
