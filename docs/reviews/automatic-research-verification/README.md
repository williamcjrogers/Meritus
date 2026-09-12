# Automatic research verification

12 September 2026

Final checks passed on the frozen `sources-clarity` worktree. No application source was changed during this verification.

| Check | Result |
| --- | --- |
| Fresh database installation, migrations 0000 through 0009 | All 10 applied successfully in one transaction |
| Updated cancellation function | Confirmed `research_cancel_run(uuid)` contains quick-question cancellation |
| Five existing SQL test files against migration 0009 | 53 passed; 1 Neon HTTP adapter test skipped |
| New automatic research SQL test file | 16 passed |
| Full default Vitest run | 767 passed; the 70 opt-in SQL tests were skipped in this run |
| TypeScript | Passed |
| ESLint | Passed |
| Whitespace checks | Passed |

Across the default and isolated SQL runs, 836 unique tests passed. The remaining test requires an external isolated Neon HTTP database URL, which was deliberately not supplied. There were no failing application tests in the final runs. The default run emitted the existing Node module-type warning for `split-csv.ts`.

SQL checks used PostgreSQL 15.19 in the local `qcs-research-test-automtxvfwau` container with Docker network mode `none`. Six uniquely named disposable databases were created, then removed. A subsequent database query confirmed that no verification databases remained. No production database credentials or live model calls were used.

The existing SQL harnesses hard-code several database names, and the intelligence harness normally recreates only migrations 0000 through 0006. Verification-only copies redirected these names to disposable databases and changed that cutoff to 0009. Relative imports and mocks pointed back to the original application modules. Test assertions were unchanged. The copies and their temporary Vitest configuration were removed after the run. The reproducible SQL runner below applies these adaptations automatically.

The first harness invocation accidentally included original tests alongside the copies because configuration merging concatenated the include arrays. This caused synthetic fixture collisions. The verification configuration was corrected to replace the include list and apply an explicit directory filter; the final run above used fresh disposable databases and passed.

Commands, executed from the worktree root:

```sh
corepack pnpm exec node docs/reviews/automatic-research-verification/verify-sql.mjs
corepack pnpm exec vitest run
corepack pnpm exec tsc --noEmit --incremental false
corepack pnpm lint
git diff --check
```

The default Vitest command ran with database, opt-in SQL, Clerk, AI and mail service environment variables removed. The SQL runner removes service credentials and sets only its explicit local test configuration. The production build and migration script were not run as part of this verification.

Detailed results are in `sql-integration.log`, `sql-verification.json`, `full-vitest.log`, `typescript.log` and `lint.log` alongside this report.
