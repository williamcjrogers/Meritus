# Meritus Via Analyst Desk

Meritus is a private, single-operator construction intelligence desk. It keeps source
evidence, scoring inputs, analyst decisions and exports on the local installation. The
application does not buy subscriptions, request licences or send messages on the operator's
behalf.

The local installation is available at <http://localhost:8088>. This source repository
contains no operator account, collected evidence, source credentials or licence grant.
Create your operator account on the first visit, then use Sources to inspect current
collection and access states. Publisher permissions and reviewed operator inputs must
be recorded for the installation; the software does not imply complete market coverage.

For the hosted Directors Workspace integration, see the
[deployment instructions](../../docs/analyst-directors-operations.md). The workspace's
Intelligence page uses its existing director sign-in and a dedicated service connection.

## Start the local desk

The supported local deployment requires Docker with Compose, `uv`, and Node through Corepack.
It binds the web application to the host loopback interface only.

```sh
make configure
docker compose up --build -d
```

Open <http://localhost:8088>. On the first visit, create the single operator account. The
initial setup route is available only when no operator exists and the request comes through the
installation's exact trusted local gateway. Later requests require the authenticated session,
the configured host and origin, and CSRF protection for changes.

`make configure` creates a private `.env` containing a random PostgreSQL password if one does
not exist. It does not replace an existing file or invent source credentials. Useful checks are:

```sh
docker compose ps
docker compose logs --tail=100 app worker
make test
make lint
```

For a direct development run, create a database and start the same API with:

```sh
uv sync
MERITUS_DATABASE_URL=sqlite:///data/development.db meritus init
MERITUS_DATABASE_URL=sqlite:///data/development.db meritus serve --host 127.0.0.1 --port 8088
```

`meritus serve` also initialises the schema and reviewed source catalogue before serving.

## Source access and permissions

Source credentials stay in process environment variables. Copy names from `.env.example` and
put real values only in the ignored `.env` file. Never put a credential in a source record,
permission record, job payload, URL or import file.

The relevant environment names are:

- `MERITUS_COMPANIES_HOUSE_API_KEY` and `MERITUS_COMPANIES_HOUSE_STREAM_KEY`
- `MERITUS_ORGANISATIONAL_CONTACT` for Gazette access identification
- `MERITUS_ADZUNA_APP_ID` and `MERITUS_ADZUNA_APP_KEY`
- `MERITUS_RNS_USER`, `MERITUS_RNS_ACCESS_KEY` and `MERITUS_RNS_BASE_URL`
- `MERITUS_HMCTS_RECEIVER_TOKEN` for the dedicated approved receiver

Use the Sources screen to record the legal basis, permitted purposes, scope, expiry and
retention terms. This record is separate from possessing a credential. Retrieval and analysis
remain blocked until both the source configuration and any required permission record allow
them. Export is checked again at download time and an old snapshot cannot broaden a later
denial.

Check access locally without contacting the source, then run it only when the result is
available:

```sh
docker compose exec app meritus source-test find_tender
docker compose exec app meritus run-source find_tender
```

Find a Tender, Contracts Finder and listed government publications use public endpoints subject
to their recorded terms and runtime availability. Companies House, Gazette, Adzuna and other
credentialled adapters remain blocked without their named configuration. Find Case Law and
HMCTS require the relevant approved access and permission record. RNS requires licensed access.
Construction Index access must remain disabled unless its terms and the intended use have been
reviewed. No command bypasses these gates, and `source-test` makes no external request.

Procurement collection uses at most 20 pages of
100 releases per source per job. A saved resume cursor and partial-coverage status identify
unfinished collection; the source console is the current authority for coverage.

## Analyst workflow

Start with the Watchlist and open an entity to inspect its current score contributions and
source records. Use Review queue to confirm evidence, correct identifiers or merge a reviewed
identity. Name similarity alone never verifies a company. The Pipeline records review,
shortlist, introduction considered, contacted, conversation, instruction, dismissed and snoozed
actions, with both conversation-rate denominators shown explicitly.

Calendar entries distinguish forecasts, confirmed practical completion and provisional legal
review dates. An illustrative date calculation remains a preview until explicitly saved, and
only confirmed entries enter the actionable list. Relationships retain their matter, evidence
and effective dates. Introduction and conflict-clearance prompts require verified identities
and human review.

Opportunity calculations use at most 5,000 relationship and insolvency inputs and 10,000
results per category. If a limit is reached, the screen states that totals are lower bounds;
select an entity to narrow the calculation. Ordinary result pagination retains complete totals
for the calculated cohort.

Reports saves weekly watchlists and fortnightly digests, then downloads CSV or printable HTML.
Each export obeys both the saved permission boundary and current rights. Historical dates do
not revive expired access. Exported retention and distribution conditions accompany the data.

## Jobs, search and recovery

The worker stores leased jobs in PostgreSQL. Source failures are recorded against that job and
do not terminate the worker. The weekly command queues the durable weekly workflow. Repeated
commands in the same Europe/London scheduling week return the existing job rather than creating
duplicate snapshots:

```sh
docker compose exec app meritus weekly
docker compose exec app meritus worker
```

The normal Compose deployment already runs one worker. Do not start a second command merely to
make a slow job run faster. Expired leases are recovered within the worker's bounded retry
policy.

OpenSearch is a derived index. Evidence remains authoritative in PostgreSQL. Rebuild a lost or
empty index with:

```sh
docker compose exec app meritus reindex
```

If search is unavailable, inspect `docker compose ps` and the OpenSearch logs, restore that
service, then run `meritus reindex`. Pending outbox rows remain in PostgreSQL for retry. Apply
retention immediately with `docker compose exec app meritus purge`.

## Backup and restore

Backups are versioned, checksummed gzip archives written with owner-only permissions inside
`MERITUS_DATA_DIR`. They contain portable rows from the database, including retained evidence,
plus deletion history. They do not import or export the installation-local managed-file deletion
manifest, and they do not grant permission to delete files on another installation. Arbitrary
managed raw files outside the database are not copied into the archive.

```sh
docker compose exec app meritus backup
docker compose exec app meritus backup --destination /app/data/backups/before-upgrade.mvbackup
```

Keep the application stopped while restoring. Place the archive inside the target managed data
directory. A restore into a database containing operational data is refused unless replacement
and its exact confirmation are both supplied:

```sh
docker compose stop app worker
docker compose run --rm app meritus restore /app/data/backups/before-upgrade.mvbackup
docker compose run --rm app meritus restore /app/data/backups/before-upgrade.mvbackup \
  --replace --confirm-replace REPLACE
docker compose up -d app worker
```

Restore rejects archives outside the managed root, symbolic links, unsafe member paths, unknown
versions, malformed rows and failed integrity checks. An accepted archive is changed to owner-only
permissions and registered with the local retention manifest. If restored evidence is already
erased or expires during restore, the archive is deleted because it contains that evidence.

The target's existing erasure ledger is preserved and merged with the archive ledger. Database
replacement and the mandatory retention purge use one transaction, so a purge failure rolls the
database back to its prior contents. Restore invalidates the old Meritus search projection before
replacement and rebuilds it from the sanitised committed database before reporting success. If
the search rebuild fails, the command reports that the database restore committed but search is
incomplete. Keep the application stopped and run `meritus reindex` before restarting it. Any
restore failure after search invalidation also requires `meritus reindex` before the application
is restarted.

## Fictional demonstration

Demo mode creates a separately marked SQLite database and data directory containing clearly
fictional organisations and figures:

```sh
meritus demo --database-url sqlite:///data/demo/meritus-demo.db \
  --data-dir data/demo/files --host 127.0.0.1 --port 8088
```

It refuses the configured live database, the live data directory, an unmarked existing database
or an invalid marker. The API reports `demo_mode: true`; demo data never falls through to the
live database.
