# QCS research operations

12 September 2026

The committed configuration provides a dispatcher and durable worker. A cron file is not evidence that monitoring is live. Operational acceptance requires an actual authenticated scheduler invocation, permitted source-page ingestion, coverage and budget inspection, and a withdrawal exercise through dependent reports and pursuits. Production deployment remains a separate authorised action.

## Configuration and source registration

Use the application's existing `DATABASE_URL`, S3 configuration and Clerk application. Never copy production credentials into test environments. Every director needs explicit Clerk `publicMetadata.role = "director"`; client membership or an email domain does not grant that role.

Configure a high-entropy `CRON_SECRET` in the runtime and scheduler. All provider keys remain environment variables named by source `credentialRef`; source records and API responses must never contain key values. The legacy Companies House brief retains `COMPANIES_HOUSE_API_KEY` and shares its provider-wide 600-request, 300-second rolling allowance with research jobs.

A source requires an effective QCS rights record, recorded terms/version/review date, attribution, operator, purpose, exact permitted hosts, a backfill start, provider selection, cadence and freshness intervals, and non-negative daily request, token and pence limits. Register through the director-gated `registerSource` boundary. Missing credentials and invalid selection become visible unavailable sources without an empty successful run. Pausing polling does not erase still-permitted evidence. Termination uses `terminateResearchSource(sourceId, reason)` to revoke the shared rights window, cancel affected jobs and enqueue evidence withdrawal together.

The first polling window begins at `backfillStart`. Subsequent windows start one hour before the last fully completed upper bound, limited by the configured backfill start. Each job retains an immutable window and provider selection. A partial page commits its evidence and cursor together; only a fully covered terminal page advances the data watermark. Incomplete coverage never becomes a successful run. A source's `lastSuccessAt` is a health timestamp, separate from the data watermark. Normal pagination is complete coverage of that page; missing populations and genuine omissions remain incomplete across the run.

Find Case Law uses separate transformation, metadata-refresh and availability-reconciliation scopes under the same source identity. New scopes share a run when dispatched together; an existing long metadata scan keeps its own cursor and frozen window while fresh polling and reconciliation can begin. Foreground investigations and transformation feeds have priority over bulk metadata refresh. Reconciliation rotates through the 100 oldest-checked known records. Availability-check timestamps advance for absent and pending-restoration records too, preventing repeated missing records from starving the rest of the corpus.

Acquisition details such as snapshot hashes, row positions and scan order are recorded in `research_run_documents.metadata`. They are excluded from documentary version identity, so unchanged rows in a later export do not invalidate their supporting claims or reports. Documentary metadata, source dates, content bytes, passage order and parser version still determine the current version.

## Hosted scheduler

`vercel.json` schedules `/api/internal/research` every minute on a scheduler plan which supports that cadence. The route reserves request-wide headroom and defers acquisition if lifecycle processing leaves insufficient time. The route uses a constant-time comparison of `Authorization: Bearer <CRON_SECRET>`, returns 503 if no secret is configured, and returns 401 for incorrect authentication. It uses the Node runtime with a 120-second limit and a 90-second acquisition budget. The response exposes dispatch counts, chunk status, due/running/failed counts and source freshness without credentials or source bodies. Responses are private and non-cacheable.

The same authenticated GET can be called by an external scheduler. Keep the token in that scheduler's secret store; do not paste it into source code, logs or shell history. Verify successful invocations and the returned health counts in the deployed scheduler before calling monitoring operational.

## Automatic research answers

The everyday desk searches current permitted evidence already collected. It does not perform a complete internet search or automatically verify a commercial lead. The opportunity feed uses published construction context and links each displayed field to its exact source passage.

`/api/internal/research-answers` runs every minute with the same `CRON_SECRET`, independently of source ingestion. Each invocation leases one saved question, retains its cycle budget across crash recovery and uses an 80-second work budget inside the 120-second route limit. A generated answer reserves at most 30,000 tokens and £2 against existing source and run budgets. Empty searches do not call the model. Daily monitoring checks the current passage/version set and reuses the answer when that set is unchanged. At most 20 daily questions and 50 pending questions are allowed across the workspace.

Question owners must still be directors when the worker runs. Confirmed loss of that role stops the monitor and releases its slot. Cancellation fences active work. Answers remain linked to existing conversation and withdrawal records, so unavailable evidence is hidden at read time. Pausing daily updates does not remove an already completed answer.

For an application rollback, retain the additive `0010` schema and stored questions. Restore the previous application deployment and its scheduler configuration; do not drop research data. Investigate a failed migration, repeated worker failures or a failing director research flow before promoting a replacement deployment.

## Supervised worker

Transfers exceeding the hosted acquisition budget use the same queue, fencing tokens and checkpoints:

```sh
corepack pnpm exec tsx scripts/research-worker.ts
```

Set the service working directory to the deployed application checkout, load its environment from the host's secret manager, and configure the host supervisor to restart on failure. `RESEARCH_WORKER_BUDGET_MS` defaults to 900000 and must not exceed that 15-minute transfer budget. `RESEARCH_SNAPSHOT_MAX_BYTES` defaults to 1073741824 and must not exceed 1 GiB. The worker renews its lease every 30 seconds; each renewal gives 120 seconds. SIGTERM and SIGINT abort active acquisition. Abrupt process loss leaves a lease which another worker can reclaim after expiry. A replacement worker always receives a larger fencing token.

Only the next bounded source page is committed. Large official snapshots remain registered private objects and resume through complete-record byte offsets. Active jobs retain their registered snapshot keys across the 24-hour staging cleanup threshold. Configure an S3 lifecycle rule to abort incomplete multipart uploads under the configured `meritus/research/` prefix only. Do not attach this rule to client upload prefixes.

## Research file imports

The hosted portal accepts research files up to 4 MiB, with a streamed multipart envelope limit of 4,400,000 bytes below the hosting platform request ceiling. Larger CSV files must be split into complete-record parts before portal upload: `node scripts/research/split-csv.mts --input /absolute/research/export.csv --output /absolute/research/parts --max-part-bytes 4194304`. Retain the generated manifest, hashes and row counts; a supplied part is not evidence that the whole publisher population has been imported. The supervised parser and splitter may retain their 16 MiB defaults for non-portal use. Large official Payment Practices snapshots use the supervised streaming acquisition path, so this portal limit does not restrict that source.

## Watchlist refreshes

The hosted dispatcher and supervised worker both process up to ten due confirmed watchlist members per pass. Each member and source has a durable scope, a frozen acquisition window and at most one active job. Companies House refreshes require that member's verified UK company number. Other selections use the provider's supported fields; population feeds remain explicitly labelled for later evidence review. Refreshes do not create model claims automatically.

`research_watchlist_refreshes` records the source, run, last check, status and any configuration failure. A successful enqueue advances the member's configured cadence atomically. Unavailable configurations retry after at most fifteen minutes. Removing a member, disabling a list or removing a selected source cancels and fences the corresponding active work. Editing other settings is protected by watchlist and source revisions at dispatch.

## Failures, budgets and cancellation

Transient failures retry with exponential delay, respecting longer `Retry-After` instructions, up to five attempts. Access failures mark the source unavailable. Parser failures retain cursor position, a redacted error code and visible coverage notes. Investigate repeated errors before re-enabling a source; retrying without correcting invalid selection or rights is ineffective.

Request reservations are recorded before network dispatch and are consumed even if the HTTP request fails. Rolling request limits count the real preceding time interval. Daily limits use UTC dates. Scheduled backfills without an investigation have daily request caps but no invented cumulative run cap, so they can resume across later days. Deliberately commissioned investigations retain their explicit cumulative `maxRequests` budget. Model reservations cap simultaneous active calls at two and check source-day and investigation-run limits atomically. Unknown usage retains the full reservation. Late usage above reservation is recorded as actual spend and prevents later calls exceeding the cap. Expiry releases only a concurrency slot, never automatically refunds reserved cost.

A director cancels via `cancelResearchRun(runId)`. Cancellation fences every unfinished job and sets the run cancelled in one database transaction. Workers recheck cancellation before preparation, while fetching and before committing. Their subsequent writes cannot advance a checkpoint.

## Withdrawal and cleanup

A director calls `withdrawResearchDocument(documentId, reason)`. The transaction clears the current-version pointer, hides all versions, blanks extracted text and metadata, and enqueues each version in `research_invalidations`. Passage IDs, locators, hashes and permitted audit facts survive as tombstones so dependency links remain valid. A 404 is marked unavailable pending reconciliation; a 410 is treated as publisher removal. Both require a recorded director reinstatement review before returned content can become available again. Neither condition is represented as a successful source result.

Each worker invocation processes a pending invalidation through `invalidateResearchDependants` (at most three distinct dependent report objects before yielding for retry), deletes affected private evidence objects and then marks the invalidation complete. Failure leaves the outbox pending and increments attempts. Dependent report objects, claims and pursuit summaries must be invalidated before completion. Monitor pending invalidations; do not describe withdrawal as finished while any row remains pending.

Reinstatement of an explicitly withdrawn document requires a director `reinstate` review with a reason. Reingestion then creates a fresh version ID, even if bytes match an older version. Superseded versions cannot be revived merely because the old hash returns. Replayed current evidence reuses the available version; its redundant newly staged object is removed after commit. Unclaimed objects older than 24 hours are collected separately, excluding active snapshot jobs and objects referenced by any version.

## Isolated validation and restoration

The standard Vitest suite skips SQL integration tests unless an explicit test target is supplied. `RESEARCH_TEST_DATABASE_URL` must be distinct from `DATABASE_URL` and identify an isolated research test database. Apply migrations to that disposable database in numeric order before running the test. The optional Neon HTTP test uses the same adapter as production.

The locally validated alternative is a network-disabled PostgreSQL 15 container named `qcs-research-test`, with database and user `research_test`. The test file accepts it only through this explicit opt-in:

```sh
RESEARCH_TEST_PG_CONTAINER=qcs-research-test RESEARCH_TEST_PG_DATABASE=research_complete_final_test RESEARCH_TEST_WITH_WORKFLOW=1 RESEARCH_TEST_WITH_WATCHLISTS=1 corepack pnpm --config.verify-deps-before-run=false exec vitest run src/lib/db/research.integration.test.ts
```

These tests truncate research fixtures. Never point them at an application database. Do not run the production build merely to validate code: its prebuild migration script writes to the configured database. Use TypeScript, ESLint and Vitest directly.

Before serving restored backups, reconcile against the current withdrawal tombstone set and effective rights records. Purge restored withdrawn source objects, passages, metadata, report objects, caches and derived pursuit summaries; replay unresolved invalidations and verify source readers deny removed versions. A historical backup or preserved hash does not reinstate permission to serve removed content.
