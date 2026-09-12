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
- Baseline tests: 998 passed, 94 skipped, 12 September 2026; baseline-tests.log.
- Task 1: 0461e5f, 8ba1051 and 3410bdc; independent access reviewer approves all scoped fixes, 74 independent tests pass.
- Task 2: 5f7d9dd, with coordinated page presentation in 8ba1051; independent experience reviewer approves draft retention and interrupted-action recovery, 8 focused tests pass.
- Task 3: 9898314 and eb5b45a; public redesign and reading-link specificity fix approved; article/legal wording preserved.
- Task 4: independent final verification at 3410bdc passes 1,092 tests, lint, database-free production build (49/49 static pages) and standalone typecheck. The 94 skipped tests require opt-in isolated PostgreSQL environments. Strict Premium raw exit 1 has nine documented parser/wrapper/fixture false positives, no application defect indicated. Final built article/legal link styles confirmed in browser. Preview and release pending.

## Decisions

- Existing company-wide client sharing remains unchanged and will be explicit in the interface, as approved.
- Home remains Home, preserving the user's prior product decision. Pursuits and specialist tools remain separate views.
- Work is performed in one isolated checkout with non-overlapping worker ownership; all source changes receive independent review.
- Credentials screen: the existing password gate accepted any non-empty value and exposed only empty placeholders. Replace it with the existing credentials-request contact flow; no real protected documents or entitlements change.
- Canonical navigation metadata in src/lib/portal/navigation.ts is owned by workspace worker, preserving existing hrefs.

## Provider configuration evidence

- Read-only FAPI inspection confirms production host clerk.meritusvia.com, application name meritus-portal, user_settings.sign_up.mode=public, hosted entry at accounts.meritusvia.com.
- This contradicts intended invite-only staff policy. Application invitation enforcement and UI are being corrected in Task 1.
- The backend instance API does not expose sign-up mode management in the installed supported SDK. Dashboard access is required for the remaining provider change.
- Clerk dashboard is signed out in the available browser. GitHub sign-in requests read-only profile/email OAuth access for williamcjrogers. User confirmation requested asynchronously before authorising this new access; no authorisation submitted yet.
- Reference: https://clerk.com/docs/guides/secure/restricting-access and https://clerk.com/docs/reference/frontend-api/2026-05-12/description/introduction .

## Verification environment

- Real Next production-build server: http://127.0.0.1:3107, no production database or Clerk keys supplied. Development browser checks preceded the build.
- Actual-component fixture: http://127.0.0.1:4319, illustrative data and mocked transport. This is visual/interaction evidence only, not live identity verification.
- Browser-confirmed corrections: readable public primary links, natural mobile headline spacing, full laptop navigation, pursuit stage reflow at 390px, Edit details focus returning to More actions.
- Browser native zoom shortcut had no effect in the available in-app browser. Verify reflow at a half-width viewport and report it as a substitute, not native 200% zoom evidence.
