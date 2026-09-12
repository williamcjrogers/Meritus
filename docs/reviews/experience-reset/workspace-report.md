# Workspace implementation report

12 September 2026. Branch: codex/meritus-experience-reset.

## Delivered

Replaced the global heritage CSS with a canonical Mineral blue, white and Flint system, separate workspace/access/client shell contracts, readable IBM Plex Sans controls, accessible field borders and visible scrollbars. Global runtime values feed Tailwind and Clerk through variables; DESIGN.md and UX-CONTRACT.md document ownership.

Migrated every portal presentation component and inventoried 27 page routes. Home retains attention, dates, ownership and progress. The rail now groups Work, Commercial and Resources; Pursuits and Prospects remain distinct. Research preserves the simple question-first service, advanced controls, source provenance and existing API semantics. Page headers are consistent; all portal pages have individual metadata. Pursuit detail puts Brief before Actions and links to Questions, Documents, Activity and Actions.

Shared Button, Field, Textarea, SearchField, PageHeader, Status and Toast primitives provide reusable controls. Existing forms and tables consume semantic classes. Research tables have 50-row paging over their loaded snapshot, explicitly labelled as loaded records. Native select/date popup behaviour remains deliberately operating-system-owned.

Fixed controlled organisation-access drafts with pre-dispatch validation and preserved selection after refused actions, app-native organisation-access confirmation, document-delete confirmation, failed document upload/delete recovery, required-field focus in Research, duplicate busy controls, stale Research reads and company-search clearing. Rejected pursuit deletion and question clearing release their busy state and retain recoverable confirmation errors. Pursuit Edit/Delete restore focus to the surviving More actions trigger. Stepper wraps into a two-column mobile sequence, preserving every stage without page overflow. No data model, schema, migration, service boundary or user record was changed.

## Verification

| Check | Command | Result |
|---|---|---|
| Portal/shared regression | `corepack pnpm exec vitest run src/components/portal src/components/ui/Primitives.test.tsx` | 150 tests pass in 27 files |
| Typecheck | `corepack pnpm exec tsc --noEmit` | Pass after correcting test fixture to latestRun |
| Scoped lint | `corepack pnpm exec eslint src/components/portal src/components/ui/{Button,Field,PageHeader,Status,Toast,Primitives.test}.tsx` | Pass |
| Official design document lint | `corepack pnpm dlx @google/design.md lint DESIGN.md` | No errors; 10 orphan-token warnings because model B references are documented in prose/runtime CSS |
| Contrast | Numeric WCAG relative-luminance checks from runtime tokens | 16 combinations pass, including text, muted, semantic status, field boundary and focus on white/chalk |
| Retired patterns | Scoped rg for native browser dialogs, grain/brackets, heritage palette utilities, serif/mono working text and sizes below 13px | No matches in portal source |
| Diff whitespace | `git diff --check` | Pass |

Exact logs and contrast values accompany this report. New regression tests prove disabled busy submit, real label/error association, search focus restoration, deduplicated live acknowledgement, primary link semantics, required Research field focus, document network failure recovery and the actual pursuit menu-to-drawer focus path. Existing tests retain service behaviours and permission-sensitive operations.

## Premium static audit interpretation

Command: `uv run python /Users/williamrogers/.codex/plugins/cache/openai-curated-remote/frontend-design-premium/1.4.0/skills/frontend-design-premium/scripts/audit_project.py . --mode strict --output docs/reviews/experience-reset/workspace-premium-audit.json`.

Raw result: exit 1, nine actionless-button findings. The two real textarea marker findings from the initial run were fixed. The remaining findings are static parser limitations: it case-folds custom `<Button>` into literal `<button>`, then ignores `href`; fixtures also intentionally render inert buttons. The actual shared Button uses Next Link for href, verified by Primitives.test.tsx. Production findings are public shared navigation CTAs and recovery links; test findings are intentionally synthetic controls. No false passing strict result is claimed. Raw JSON is retained for controller review.

## Integration and verification boundary

The access worker owns identity behaviour and provider fonts; the public worker owns marketing CSS and public composition. Both consume the shared tokens. The public generic anchor selector was narrowed by its owner after browser evidence showed it overriding primary link colour. Controller owns complete build, full repository suite, independent review, browser screenshots and deployment.

This report does not claim a real signed-in account test, production verification, completed 200% zoom, reduced-motion browser review or complete browser accessibility certification. Controller has a real-component fixture for representative desktop/mobile and error states; its final acceptance report is the evidence for those checks. No build or database migration was run by this worker.

Portal route presentation/metadata is staged by the access owner together with the independently reviewed fresh page guards, to avoid concurrent shared-path staging. This worker commit owns components, styles, navigation metadata and documentation.
