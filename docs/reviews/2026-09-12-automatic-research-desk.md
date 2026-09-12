# Simple research desk

12 September 2026

The everyday workflow is an automatically refreshed list of relevant public records and one question box. Source registration, model limits and manual evidence administration remain available separately.

Connected source collectors continue to populate the evidence library through the existing scheduler. The opportunity feed selects current, permitted construction-related records with payment, dispute, insolvency, defect or procurement context. These are leads for review, not verified commercial opportunities or findings of distress. Source identity and an exact passage remain available.

Questions use that collected library automatically. The user enters a question and may choose a daily update. A durable server queue searches relevant passages across permitted sources, writes an evidence-linked draft answer, and reports missing evidence honestly. It does not launch a complete procurement or payment-register download for each question. Daily questions are checked again, but a new AI answer is generated only when the supporting passage/version set changes. Each answer cycle is capped at £2 and 30,000 reserved tokens; existing source/day/run limits remain in force. There is no automatic outreach or automatic verification.

This workflow searches the material already collected. It must never imply a complete internet search or claim a named company is distressed merely because a record contains an insolvency-related word. Empty results and source collection problems are visible in ordinary language.

Queue creation and completion are idempotent, leases are fenced, and current evidence permissions are rechecked at completion and read time. Draft answers use the existing conversation and invalidation records, so withdrawn material is not copied into an untracked output store. The source worker and the answer worker use separately bounded invocations of the existing scheduler infrastructure.

## Reviewed behaviour

The default research route opens the simple desk. Advanced investigations remain available under More tools. Sources show human-readable collection states and setup instructions, with imports, registration and administrative details separated into deliberate tasks.

Evidence selection works at document level, retains useful labelled sibling fields and favours the company named in a question over repeated generic payment labels. The answer receives at most 12 passages from up to three relevant documents, with exact excerpts around matching terms. Selected evidence membership does not change when another question spends a source's daily allowance. The model prompt and output are bounded; unsupported quotations and references are rejected.

Opportunity excerpts expose a link for every displayed source field. Answers use current permission checks at retrieval, completion and display. Cancelling a run fences its queued or active automatic work. Retrying a monitored question pauses its previous daily updates before offering a replacement. Confirmed loss of director access releases the monitoring slot; temporary access-service failures do not silently cancel monitoring.

The local browser preview has been checked for question submission, background completion, supporting evidence, pausing daily updates, saving and filtering opportunities, and returning to source settings. Phone-width testing at 390 pixels found no horizontal page overflow. The preview explicitly labels sample data and simulated answers.

## Deployment boundary

William approved publication on 12 September 2026, including the background answer worker. The release incorporates the separately published Home dashboard without replacing its changes. Dashboard migration `0009` remains unchanged; automatic questions use additive migration `0010_qcs_research_quick`, with a strictly later journal timestamp. Source collectors retain their existing schedules. Publication adds the separately bounded `/api/internal/research-answers` cron route, using the existing cron secret and configured model. No production data or model service was used for development verification.

## Research verification before Home integration

The final production Next build passed after the source freeze with application service credentials unset, using `next build` directly so no migration script ran. It compiled successfully and generated all 49 static pages. TypeScript, ESLint and whitespace checks also passed after the final source changes.

The full application suite passed 767 tests. Its 70 opt-in SQL tests were then accounted for separately: 69 passed against fresh isolated databases with migrations `0000` to `0009`, and one external Neon HTTP adapter test remained skipped because no isolated external URL was supplied. This gives 836 unique passing tests, including all 53 existing SQL checks and 16 new automatic-research checks. No live model request was used; model responses are controlled in tests and simulated in the preview.

Independent review found no remaining material issues after the fixes. Reproduction commands and results are in [the verification report](automatic-research-verification/README.md).

## Combined release verification

The release combines automatic research with Home dashboard commit `9d6744a`. Independent integration review found no material issues. The resolved journal contains 11 migrations with unique, strictly increasing timestamps. The Home and research SQL bodies remain unchanged, and an offline Drizzle generation found no schema changes left to generate.

The full application suite passed 863 tests. Eight isolated PostgreSQL suites passed another 93 tests, including all 69 research checks and 24 Home/action checks. One external Neon HTTP adapter test remains skipped because no isolated external URL was supplied. The combined result is 956 unique passing tests. Fresh installation through `0010` and upgrades from `0008`, `0009` and `0010` were verified. TypeScript, ESLint, whitespace checks and the final Next production build passed. The local build used no application service credentials and did not invoke the migration script.

A read-only production check before publication confirmed the Home migration was applied at `1789228800006`, with matching migration hashes and all three action tables present. The production deployment immediately preceding this research release was `dpl_5RbapmPAz23ZwrrqnJTEoPcmbuvE`, from commit `9d6744a`; retain its additive database schema if an application rollback is needed.
