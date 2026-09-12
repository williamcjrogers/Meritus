# Experience reset progress

Plan: `docs/superpowers/plans/2026-09-12-meritus-experience-reset.md`
Spec: `docs/superpowers/specs/2026-09-12-meritus-experience-reset-design.md`
Baseline: `efd8849cac66cf8db622260983249482ca9c4f7c`
Approval: William Rogers, 12 September 2026, “just do it”.

## Preflight

| Task/interface | Check | Result |
|---|---|---|
| Access internal consistency | Pure destination tests agree with role boundaries and unavailable semantics | Consistent |
| Workspace internal consistency | Tokens and primitive contracts retain callers while replacing visual treatment | Consistent |
| Public internal consistency | Public routes and form contracts preserved; visual and navigation replacement permitted | Consistent |
| Access / Workspace | Root layout fonts and Clerk owned by Access; globals/primitives owned by Workspace | Documented font variables and CSS contract |
| Access / Public | HeaderAuth/MobileAuth owned by Access; parents owned by Public | Preserve existing import names and prop signatures |
| Workspace / Public | Global sheet imports public sheet; shared Button owned by Workspace | Public creates its own stylesheet and consumes shared semantics |
| All / Verification | Existing services preserved; no DB migration needed; local build database-free | Full tests and review follow integration |

## Status

- Setup: isolated branch created from verified production; frozen-lock dependencies installed.
- Baseline tests: running.
- Task 1: ready.
- Task 2: ready.
- Task 3: ready.
- Task 4: pending implementation.

## Decisions

- Existing company-wide client sharing remains unchanged and will be explicit in the interface, as approved.
- Home remains Home, preserving the user's prior product decision. Pursuits and specialist tools remain separate views.
- Work is performed in one isolated checkout with non-overlapping worker ownership; all source changes receive independent review.
