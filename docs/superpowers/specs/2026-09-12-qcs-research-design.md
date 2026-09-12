# QCS directors' research system

Date: 12 September 2026

Status: approved by William Rogers on 12 September 2026 and implemented in `codex/qcs-research`. See the [implementation and acceptance record](../../reviews/2026-09-12-qcs-research-delivery.md) for delivered behaviour, tests and deployment boundaries. This design remains the acceptance reference; it does not claim live deployment.

Owner and operator: Quantum Commercial Solutions Limited (QCS). William Rogers confirmed that QCS owns the software and that this research is for QCS. The existing Meritus repository and directors' portal are the delivery surface. A separate Meritus ownership or licensing obstacle must not be invented.

## 1. Outcome

Directors can commission an investigation, find and inspect primary records, follow companies and projects, receive a ranked research inbox, examine every supporting passage, investigate case law, and convert a reviewed opportunity into the existing pursuit desk. The system can reproduce the research in the supplied strategy, with corrections, transparent coverage and repeatable updates.

The system supports the entire research scope. Individual providers can be unavailable because an endpoint, credential, commercial subscription or separate source permission is absent. That must be displayed precisely, without disguising a missing integration as a working connector or disabling unrelated capabilities.

The source strategy is a hypothesis and requirements input, not a verified dataset. Its named longlist must not be imported as proven distressed companies or confirmed conflicts.

## 2. Evidence and existing system

Read these accompanying reviews before implementation:

- [Forensic review and licence assessment](../../reviews/2026-09-12-qcs-research-review.md).
- [Claim verification register](../../reviews/2026-09-12-research-claims-audit.md).
- [Data source feasibility](../../reviews/2026-09-12-research-data-sources.md).
- [Existing backend evidence map](../../reviews/2026-09-12-research-backend-map.md).

Reuse Next.js, TypeScript, Postgres/Neon, Drizzle, Clerk, S3 and the existing AI Gateway. Existing briefs provide Companies House lookups and web research. The questions drawer provides conversational tools. Neither constitutes a durable evidence archive or monitoring engine.

The source strategy's proposed Python/Docker/OpenSearch stack is not the stack of this repository. It is unnecessary to introduce a second application framework or search cluster for the first operational system.

## 3. Approaches considered

| Approach | Advantage | Limitation | Decision |
|---|---|---|---|
| Extend the current brief prompt and search provider only | Small change; useful one-off research | No reliable ingestion, source versioning, corroboration, monitoring or recovery | Insufficient for the request |
| QCS research modules in the existing application, durable Postgres jobs, S3 source objects and native text search | Reuses the portal, permissions and pursuit flow; complete evidence chain; incremental delivery | Requires carefully bounded background jobs and source adapters | Recommended |
| Separate Python workers, OpenSearch and a new service API | Useful for a large national corpus or sustained streams | Additional infrastructure and duplicated access/lifecycle logic before volume justifies it | Keep a worker interface that permits this migration later |

## 4. Global constraints

- QCS owns and operates the research service; QCS is the holder of the supplied Find Case Law licence.
- Use British English, DD Month YYYY for displayed dates, GBP by default and no em dashes.
- Preserve the current uncommitted client-domain schema work and other contributors' changes.
- Keep client-deposited files static; research processes public records, licensed records and material deliberately added to a research investigation.
- Do not send outreach, publish a digest externally, buy a subscription, push or deploy as a side effect of research.
- Require a director role at every portal page, route and server action; a signed-in client is not a director.
- Keep credentials server-side; store secret references rather than secret values in research configuration.
- Every factual assertion must link to an available source record and a supporting passage or structured field. Model citations alone do not verify a claim.
- Every provider failure, incomplete page, omitted population and stale source must remain visible in coverage.
- Do not apply migrations to production during tests. The existing build command runs migrations.

## 5. Capability inventory and acceptance contract

| ID | Capability | Completed behaviour |
|---|---|---|
| R01 | Research commissioning | Create an investigation for an organisation, project, topic, legal issue, sector or referral channel; record question, geography, period, expected output, owner and budget |
| R02 | Companies House | Search and confirm identities; ingest profiles, paginated officers, filings, charges and insolvency; detect changes; preserve company numbers as strings |
| R03 | Procurement | Ingest Find a Tender and Contracts Finder releases; link buyer, supplier, awards, contract changes, performance and termination notices; keep award value distinct from contract value |
| R04 | Payment practices | Import the official register CSV, revisions and reporting periods; compare like-for-like periods and retain retention fields when published |
| R05 | Insolvency and Gazette | Discover and read permitted notices; classify petition, order, appointment and outcome separately; link to Companies House identities and verified project relationships |
| R06 | Full case-law research | Search legal issues, courts, dates, parties and citations; retrieve current judgments; cite paragraphs; compare authorities; track judicial treatment and appeal status with supporting evidence; summarise decisions and reasoning |
| R07 | Court listings | Retain listing date, case reference, hearing type and parties from an authorised route; distinguish listing, hearing, judgment and outcome |
| R08 | Building safety | Track aggregate Gateway metrics with cohorts and windows, developer remediation progress and named published decisions; support project-specific Gateway research when actual project evidence is supplied |
| R09 | Capital programmes | Maintain dated programme and procurement facts for AMP8, roads, rail, energy, grid, housing and Gulf projects; relate named awards to companies without asserting inevitable disputes |
| R10 | Accounts, RNS, news and recruitment | Retrieve issuer/publication records; extract provisions, financial changes, project dates and hiring signals; use recruitment as weak contextual evidence |
| R11 | Commercial data | Import licensed CSV/JSON extracts and configure documented provider feeds for construction, credit and project intelligence; preserve source-specific distribution terms |
| R12 | Entities and relationships | Separate legal companies, aliases, corporate groups, people, projects, contracts, cases and advisers; queue uncertain joins for review; support non-UK identifiers |
| R13 | Evidence archive | Keep retrieval time, publication/event time, exact URL, provider ID, version hash, locator, source rights and claim links; allow correction and withdrawal |
| R14 | Signals and prioritisation | Explain every component of a configurable priority score; deduplicate copied stories; separate observed facts, allegations and inference; show freshness and missing data |
| R15 | Legal and commercial calendars | Record practical completion, retention and proposed limitation dates with source, jurisdiction, rule and review state; distinguish contractual reminders from a concluded legal deadline |
| R16 | Referral research | Map funders, insurers, administrators, solicitors, chambers, surveyors, frameworks and complementary experts; record observed engagements and director-confirmed relationships |
| R17 | Director workflow | Assign, annotate, verify, dismiss, merge, suppress, watch, revisit and convert a finding to a pursuit; preserve source links and review history |
| R18 | Research assistant | Use typed tools for search, source reading, comparison, case-law lookup and evidence-backed drafting; support follow-up investigations outside an existing pursuit |
| R19 | Reports and indexes | Produce citation-linked investigation reports, weekly internal watchlists, referral briefs and methodology-led adjudication/Gateway indexes; offer Markdown, CSV and print-ready HTML exports |
| R20 | Monitoring and operations | Schedule and resume work, enforce budgets, retry transient failures, cancel jobs, inspect health, reprocess changed sources and reconcile withdrawals |
| R21 | Outcome measurement | Record conversations, proposals and instructions following reviewed signals; report denominators, attribution period and source mix; treat the strategy's 5% threshold as an experiment |

## 6. Workspace and director journey

Add a Research navigation item at `/portal/research`. Its primary views are Investigations, Watchlist, Signals, Case law, Sources and Runs. A director starts with a company/project/topic or a natural-language question. The system produces a research plan showing the relevant sources and expected coverage, then starts the job with the director's selected budget.

An investigation contains its question, answer, evidence table, timeline, entities, relationships, unresolved points, source coverage and run history. Each finding opens the precise source passage or structured record. Pages from the same publisher remain distinct. Dismissing a signal requires a reason; it does not delete its public source.

The watchlist is a list of subjects and subscribed signal types, with cadence and owner. The Signals view sorts by research priority, not a purported probability of litigation. Single-source facts remain visible. Two independent underlying events are the default threshold for a corroborated recommendation; a director can record an exception for a compelling single event.

Case law provides full search and reading with current-version indicators, paragraph links, issue lists, holdings, quotations, related authorities and appeal/treatment status. Automated treatment suggestions are labelled unverified until tied to an express passage and reviewed. Published cases are an incomplete sample of court work, not a universal citator or conflict database.

Conversion creates a pursuit through a dedicated research conversion function. It never stamps the existing BREE-specific source label onto an unrelated lead. It copies a concise reviewed summary and links evidence IDs; it does not detach copies of judgment text that would escape withdrawal controls.

## 7. Data architecture

Use a dedicated `src/lib/db/research-schema.ts`, re-exported by `schema.ts`, so the existing client upload work can proceed independently. Use UUID primary keys and indexed timestamps. All research records carry the QCS workspace identifier; investigation-specific access remains director-only.

| Table | Required fields and invariants |
|---|---|
| `research_sources` | ID, label, provider, hosts, access method, terms URL/version/review date, attribution, operator, purpose, rights record, credential reference, status, cadence, last success, freshness interval |
| `research_rights` | Holder, material, stated purpose, agreement reference/hash, effective date, expiry, transfer conditions, retention/withdrawal instructions, operator's recorded use assessment |
| `research_entities` | Kind, canonical display name, jurisdiction, confirmed state, created/updated timestamps; no inferred distress flag |
| `research_identifiers` | Entity FK, scheme, exact string, source FK, verified flag; unique scheme and identifier only where the scheme guarantees uniqueness |
| `research_relationships` | Subject, predicate, object, valid dates, evidence FK, confidence and reviewer; group membership does not transfer liability or conflict |
| `research_investigations` | Question, scope JSON, owner, status, budget, created date and latest completed run |
| `research_watchlists` / `research_watchlist_members` | Owner, label, cadence, subject FK, signal preferences and next refresh |
| `research_documents` | Source FK, provider ID, current version FK, canonical URL, document status and latest availability check; unique source/provider ID |
| `research_versions` | Document FK, SHA-256, source update time, retrieved time, event/publication dates, private object key, content type, availability and parser version; reuse only the current available version with identical content, source metadata and parser version; give a changed or explicitly reinstated version a fresh ID |
| `research_passages` | Version FK, locator (paragraph/page/field), text, text hash and native text-search vector |
| `research_claims` / `research_claim_evidence` | Claim text, fact/allegation/inference, verified/disputed/unverified, claim date, entity FK; evidence join stores supporting/contradicting context and exact passage ID |
| `research_signals` | Entity, event type/date, underlying event key, claim IDs, confidence, scoring version, component score, stale/retracted flags |
| `research_runs` | Investigation, source selection, status, started/finished times, prompt/model/adapter versions, cost reservation and actual usage, coverage and error summary |
| `research_jobs` | Type, dedupe key, payload, status, cursor, attempts, next attempt, lease owner/token/expiry, cancellation, error code and timestamps |
| `research_checkpoints` | Source/scope, successful cursor, completed-window watermark, revision and update time; advance only with committed evidence; source completion time is separate from the data watermark |
| `research_reviews` | Actor, action, target, reason, before/after references, timestamp; do not store full withdrawn judgment content here |
| `research_calendar` | Subject, event kind, proposed date, source, applicable rule/jurisdiction, assumptions, reviewer and verified/provisional state |
| `research_reports` / `research_report_evidence` | Investigation/run, audience, draft/reviewed/stale, claim and passage references, output object and reviewer |
| `research_suppressions` | Target, scope, reason, expiry and actor; checked again on conversion and export |
| `research_outcomes` | Signal/pursuit link, conversation/proposal/instruction date and actor; supports measured conversion with clear denominators |

Keep a versioned reference to raw evidence where terms permit. A withdrawal or replaced judgment removes the superseded content from objects, passages, indexes, caches and generated reports. Include research-derived pursuit summaries and conversation content in the dependency graph; activity history stores action/target IDs, not retained source quotations. Preserve only a minimal tombstone and permitted audit facts. Historical hashes are not a licence to retain removed content.

## 8. Acquisition, queue and recovery

Interactive endpoints enqueue and return `202` with a run ID. A scheduled, authenticated dispatcher inserts due jobs idempotently. A worker invocation leases a job with a monotonically increasing fencing token, performs a bounded page or processing chunk, commits evidence and cursor atomically, then yields. Do not use `after()` as the durable queue.

Use the existing Neon HTTP driver for atomic SQL statements/batches. Do not assume callback transactions or a long-held `FOR UPDATE` lock survives an HTTP request. Implement the conditional page commit as a database function that verifies the lease token, writes records and advances the checkpoint in one transaction. A superseded worker cannot commit.

The reference hosted runner is an authenticated Next route with a 120-second maximum, stopping acquisition at 90 seconds to leave write headroom. Cadence is configurable; a documented scheduler must actually invoke it. Continuous Companies House streams and large snapshot transfers can use a separately supervised Node worker with the same durable jobs and fenced lease renewal, not an unbounded Vercel request. The initial Companies House connector uses bounded watchlist polling.

Defaults: one active job per source/scope, two concurrent research model calls, five transient attempts, exponential retry capped at one hour, and explicit daily request/token/currency budgets. These are adjustable operating settings, not licence restrictions. Reserve cost before dispatch; failed calls retain known usage. Cancellation aborts HTTP/model work and suppresses subsequent writes. Missing credentials produce `unavailable`, not a zero-result success.

Respect `Retry-After` where returned. Record 401/403 as access failure, 404/410 as availability events subject to source policy, 429 as rate limiting and 5xx/timeouts as transient. Parse failure does not advance a cursor. A malformed item is quarantined with a redacted sample and a visible coverage gap. All retries use source IDs and hashes to avoid duplicates.

## 9. Provider implementations

Companies House: preserve number prefixes and leading zeroes. Paginate officers and filings. Fetch only the necessary watchlist population initially. Use a shared limiter across company search, profile and event endpoints. Distinguish a director resignation from a specifically evidenced finance-director departure. Add a stream connector behind the same adapter contract if justified by volume.

Procurement: use the documented OCDS endpoints and their own schemas, not a made-up universal query. Snapshot the upper time bound of a run, follow next links under a host allowlist, overlap the next refresh window and deduplicate releases. Support supplier identity schemes, notice revisions, cancelled awards, non-GBP values and separate awards/contracts. Map performance fields only after fixture validation; an ordinary award is not poor performance.

Payment practices: use the official CSV export, content hashing and source row identifiers. Retain report-period start/end and revisions. Compare equivalent periods; null is not zero. Stream complete snapshots to private S3 storage, then parse bounded batches with resumable record-boundary checkpoints. Do not assume the provider supports byte ranges: the read-only check returned HTTP 200 without a range response. Use a streaming CSV parser with size and row limits, quoted-newline support and formula-safe exports. An incomplete download is never a complete snapshot and cannot trigger deletion reconciliation.

Gazette: separate public discovery, single notices and commercial delivery. Use the documented permitted route, current robot policy, UK request window and per-source rate limit. Do not assume technical exposure of XML overrides the delivery policy. Support an authorised commercial feed or uploaded export through the same notice normaliser.

Find Case Law: implement Atom and LegalDocML support, source-provided stable document URIs, all supplied identifiers, paragraph structure, dates and hashes. New document URIs must not be parsed as neutral citations. Use transformation ordering for text changes and a separate metadata refresh for other changes. Include PDF-only records in coverage. A vanished record is hidden pending reconciliation; rate-limit failures are not treated as withdrawals.

QCS's signed licence is recorded as the existing agreement, not as an application still to be made. Its stated Claims Toolkit purpose, current-version and removal requirements, attribution and other conditions remain in the source record. Ownership is resolved by the user; software does not infer that the licence is invalid because the repository is named Meritus. The review identifies the extent of the purpose wording without inventing an express ban on business development that the document does not state.

Court listings: implement a separate provider and agreement record. The QCS judgment licence does not purport to be the HMCTS Third-Party Courts and Tribunals Data Licence. Show the actual source access state. Manual director research and a licensed import remain available when automated delivery is not configured.

BSR/remediation: import the source's category, reporting period, application state and denominator. Keep monthly Gateway statistics separate from named developer progress. Never attach an aggregate median delay to a particular project. Store actual project submission, validation, extension and determination dates only from evidence about that project.

RNS/accounts/programmes/news/recruitment: use issuer and programme-owner publications first, permitted feeds second and search discovery third. A search result is a lead until its source is retrieved. Record page/table context, accounting period and currency; a provision or hiring advert is not proof of a dispute.

Commercial/devolved/local planning data: implement a director import wizard with mapping preview, validation report, source agreement and deduplication. Provider-specific APIs can be added only against supplied, documented contracts; do not fabricate endpoints. The import path must work and have tests even when a commercial API subscription is absent.

## 10. Research, identity and scoring

Acquisition yields source records; structured extraction yields proposed claims; a verifier checks quoted passages, field values, dates, entities and contradiction links. A model may propose a conclusion but cannot mark its own proposal as director-verified. Store prompt/model/parser versions and the source version IDs used.

An exact authoritative company number can establish a company match. Name-only, shared-address and group-name matches remain candidates. Non-UK parties use appropriate identifier schemes or internal entity IDs. A court party name alone never produces a guaranteed Companies House match.

Use a transparent initial priority heuristic, version `qcs_priority_v1`: direct legal/procurement/insolvency event 40; evidenced project-specific financial or programme change 25; comparable payment deterioration 15; contextual recruitment/sector news 5. Multiply by evidence-confidence and `2 ** (-ageDays / halfLifeDays)`, using event-specific half lives recorded in configuration. Cap each underlying event at its highest component and the overall score at 100. Missing event dates produce a provisional item, not a fabricated fresh event.

These weights are engineering defaults for triage, not statistically validated probabilities. Count distinct underlying events for corroboration. Companies House and Gazette reports of the same appointment count once. Three websites quoting one announcement count once. Dismissed, suppressed or withdrawn signals do not contribute to actionable recommendations.

A competitor's appearance in a case becomes an observed engagement with a date and source. Conflict clearance remains a director decision with its own parties, scope, date and rationale. No model assigns a permanent conflict or infers that losing a case creates dissatisfaction with advisers.

Legal calendar calculations require an evidenced cause of action, accrual assumption, contract/deed status, jurisdiction, relevant legislation and any standstill or extension. Proposed dates are reminders for review. Practical completion alone is not a universal limitation start date.

## 11. Source integrity, privacy and exports

All retrieved text, uploaded research material and user-provided names are data, never instructions. Fence the entire material, validate tool inputs and conversation roles, prohibit model-chosen arbitrary network destinations and check permissions on every read. Public research queries contain only the selected public subject and approved search terms. Client document text is not sent to the web search provider.

Use allowlisted provider URLs with HTTPS, bounded redirects, DNS/IP checks at connection time, timeouts, size limits and safe content parsing. Block loopback, private/link-local destinations, credentials in URLs and cross-host redirect credential forwarding. Disable XML external entities/DTDs and sanitise source HTML in the reader.

Public personal information still needs a recorded lawful purpose and minimisation. Keep contact objections and suppressions effective throughout research, conversion and export. Do not collect protected characteristics for prioritisation. Reports expose evidence and uncertainty without publishing reputational allegations as facts.

Judgment views require source attribution and an approved partial-coverage notice, private authenticated access, `noindex`, no shared public cache and no public download route. Withdrawal handling reaches every dependent artefact. A future provider deployment must document source email/takedown handling, backups, restoration purge and expiry/termination treatment.

Internal reports are drafts until reviewed. External distribution is a separate director action that evaluates source-specific permissions and personal information. Ordinary CSV exports neutralise spreadsheet formula prefixes. Exports include dates, version IDs, methodology and coverage. Public indexes must describe court/publication selection bias and must not claim to measure all adjudications from enforcement judgments.

## 12. Delivery units and validation

Implement three cohesive units, each separately testable:

1. Evidence foundation and durable operations: schema, director isolation, source configuration, safe retrieval, jobs and lifecycle.
2. Source research: all adapters and imports, case-law reader/search, identities and extraction.
3. Director intelligence: investigations, signals, calendars, referral research, assistant, reports, pursuit conversion and outcomes.

Plans are [foundation](../plans/2026-09-12-qcs-research-foundation.md), [sources](../plans/2026-09-12-qcs-research-sources.md) and [director workflow](../plans/2026-09-12-qcs-research-workflow.md). They retain the original execution checklist. The implementation and acceptance record is the current delivery status; related checks were consolidated into cohesive test files.

Acceptance includes: client cannot read research; duplicate jobs cannot run concurrently; stale leases cannot write; replay does not duplicate evidence; failure does not advance a cursor; source replacement invalidates old claims/reports; an ambiguous company is not auto-merged; syndication is not corroboration; legal outcomes have exact passages; aggregate BSR data never creates a named-project delay; no silent source failure; cancellation stops work; source suppression prevents conversion; duplicate conversions return the same pursuit; all displayed citations resolve; no client deposit is processed; all budgets and source rights are visible.

Original pre-implementation baseline: 411 tests in 30 files passed. TypeScript reports an existing fixture mismatch caused by the uncommitted `clientDomainId` schema addition. No production-connected build or migration was run. See the review for exact commands and limitations.
