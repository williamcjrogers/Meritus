# QCS research implementation and acceptance

12 September 2026

Implementation branch: `codex/qcs-research`, based on `772def8`. The implementation is in the isolated `qcs-research` worktree. The original checkout and its concurrent client-domain work remain separate.

## Outcome

QCS has a director research workspace at `/portal/research`, supported by durable acquisition jobs, an evidence archive, source-specific connectors, case-law research, human review, reports and conversion into the existing pursuit desk. The implementation records QCS as owner, operator and holder of the supplied Find Case Law agreement. It introduces no Meritus ownership objection or restriction on the research subject.

The forensic review corrected the research premises before implementation. The strategy remains a requirements input, rather than a verified list of distressed organisations, established adviser conflicts or proven opportunities. See the [forensic review](2026-09-12-qcs-research-review.md), [claim register](2026-09-12-research-claims-audit.md) and [source assessment](2026-09-12-research-data-sources.md).

## Delivered capabilities

| Requirement | Implementation |
| --- | --- |
| R01, research commissioning | Validated questions, subjects, jurisdictions, periods, source choices and budgets; durable investigation/run IDs; request idempotency. |
| R02, company research | Companies House profiles, officers, filings, charges and insolvency, with pagination, exact company numbers, identity confirmation and shared account request limits. |
| R03, procurement | Find a Tender and Contracts Finder OCDS acquisitions with fixed windows, release identities, bounded pagination and original award/contract fields. |
| R04, payment practices | Official CSV snapshot acquisition, streaming private storage, resumable record offsets, original reporting periods and retention fields. |
| R05, insolvency | Gazette feed discovery and source-coded events, with notice type selection, access windows and visible coverage gaps. |
| R06, case law | Atom/LegalDocML/PDF acquisition, current-version search and reader, exact paragraph references, authority comparisons and director-reviewed treatment evidence. |
| R07, court listings | Licensed mapped CSV/JSON imports with an independently recorded source agreement; listings remain distinct from judgments and outcomes. |
| R08, building safety | Bounded GOV.UK collection/publication/attachment traversal, PDF/ODS extraction and cohort-aware evidence indexes. |
| R09 and R10, programmes and publications | Registered public programme, accounts, RNS, news and recruitment documents; retained source wording and publication/event dates. |
| R11, commercial data | Source-registered CSV/JSON import, mapping preview, exact original objects, stable provider IDs and whole-record splitting with manifests. |
| R12, identities and relationships | Separate entities and exact identifiers, director confirmation, ambiguous-match handling, source-backed engagements and judicial-treatment links. |
| R13, evidence | Exact bytes, hashes, source URLs or registered import provenance, versions, passage locators, run lineage, current-version reads and withdrawal reconciliation. |
| R14, prioritisation | Transparent category weights, confidence and time decay; underlying-event deduplication; independent-event review; suppression and stale-source handling. |
| R15, calendars | Evidence-backed proposed dates, legal-rule/jurisdiction/accrual fields, provisional or reviewed state and internal calendar reminders. |
| R16, referrals | Source-backed relationship, referral channel, service offer, owner and stage. An observed appointment does not establish a professional conflict. |
| R17, director decisions | Review, dismissal, reopening, notes, assignment, revisit dates, equivalent-event decisions, watchlists and idempotent pursuit conversion. |
| R18, assistant | Typed evidence, case-law and comparison tools; bounded model requests; exact citation/quotation checks; persisted proposed answers and cancellation. |
| R19, reports | Citation-linked Markdown, CSV and print HTML reports; weekly internal digests; indexes with population, period, cohort, inclusion rules, duplicates and evidenced denominators. |
| R20, operations | Authenticated scheduled dispatcher and supervised worker; fenced leases, atomic page/cursor commits, retries, daily limits, cancellation, source health and withdrawal outbox. |
| R21, outcomes | Explicit conversation/proposal/instruction events attributed through converted signals, with reviewed-signal denominators and an attribution period. |

## Important integration corrections

- A signed-in client cannot access the directors' portal. Access requires explicit director metadata, and backend role lookup failures deny access.
- DNS validation is applied to the actual HTTPS connection. Redirects cannot reach private addresses or carry credentials to a different origin.
- Evidence objects have durable database registration before storage writes. An uncertain storage response leaves a recoverable cleanup record.
- Provider selection is validated before commissioning. Generic question fields are not appended to incompatible provider schemas.
- Snapshot hashes, row positions and scan order are acquisition history, rather than document identity. Repeated unchanged records reuse the current version.
- Find Case Law transformation, metadata and known-document reconciliation have separate cursors. A lengthy metadata scan does not block fresh acquisition.
- Import retries compare semantic input, rather than a newly generated object key. Imported rows must reference a registered original object belonging to the same source.
- Source replacement or withdrawal hides source-dependent content immediately and erases retained copies through durable cleanup. This includes research answers, reports, identifiers, treatment reviews, calendars, referral prose, derived pursuit summaries, generated briefs and saved AI answers.
- Pausing acquisition leaves still-permitted cached evidence readable. Actual rights expiry or source withdrawal controls evidence availability.
- Event-equivalence decisions reset review and independence, preventing copied reports of one event from satisfying a two-event rule.

## Verification

The production build and its TypeScript validation passed. ESLint reported no errors and seven pre-existing warnings in unrelated marketing/animation components. All nine migrations, `0000` through `0008`, installed in order in one transaction on a fresh isolated database. The final Drizzle schema snapshot was generated offline; a second generation against the complete migration metadata reported no schema changes. The optional Neon HTTP adapter exercise was not run because no separate Neon test URL was supplied.

The final full offline suite passed 582 tests in 61 files. Its 54 opt-in database checks were skipped in that offline invocation. Separately, 53 PostgreSQL integration checks passed: 35 foundation/watchlist checks, 7 source/identity/treatment checks, 8 director workflow checks and 3 intelligence lifecycle checks. Offline tests use synthetic source responses. Database checks run only in explicitly named disposable, network-disabled PostgreSQL databases. They do not connect to production.

Acceptance covers concurrent leases and conversion, cursor rollback, repeat acquisition, large snapshot streaming, cancellation, budgets, request retries, explicit director access, client denial, current citations, unsupported quotations, source expiry and withdrawal, original-object registration, event equivalence, source settings and accessible form controls. UI behaviour was tested with synthetic responses. An authenticated browser walkthrough against live Clerk, S3 and the model gateway was not performed in this isolated checkout.

The review process used parallel implementation with exclusive module ownership, root integration review and independent cross-review. The plans' illustrative individual test filenames were consolidated where the same acceptance behaviour was tested together. No test result establishes that a live provider account or production scheduler is operational.

## Operational handover

Apply the ordered migrations through `0008_qcs_research_watchlists` in the intended deployment environment, with its normal backup and rollout process. Configure the existing Clerk, database and private S3 services, explicit director roles, the AI Gateway and scheduler secret. Add the Companies House credential and Gazette notice/contact selection through the source settings and runtime environment. Sources requiring a commercial agreement or an independent court-listing route remain individually configurable imports.

The implementation includes a one-minute hosted scheduler definition and a supervised worker entry point. These files have not been deployed or connected to a production scheduler in this task. Continuous monitoring is therefore not claimed as live. Authenticated production ingestion, model usage, object storage and a withdrawal rehearsal remain deployment acceptance checks.

Full instructions are in [research operations](../research-operations.md) and the [provider contracts and coverage register](../research/provider-contracts.md). The supplied signed QCS agreement is recorded by its actual purpose, dates, attribution and SHA-256; it is not replaced with an invented application or corporate-holder gate.

Hosted research uploads accept 4 MiB per file. Split imports record part number/count and original snapshot hash, retain the uploaded part hash in retry identity, and explicitly remain partial rather than claiming the complete original population. Official Payment Practices snapshots have a separate streamed acquisition path supporting up to 1 GiB.

No external publication, outreach, subscription purchase, production migration or push is part of this implementation.
