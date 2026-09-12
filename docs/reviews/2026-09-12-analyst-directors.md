# Directors Workspace Intelligence integration

12 September 2026.

The full standalone analyst source is incorporated in `services/analyst` and is
available through the new `/portal/intelligence` entrance. Existing Research and
pursuit workflows remain on their existing routes and database tables.

Every gateway request, including static assets, checks current director authority.
A short-lived HMAC proof binds that actor to the exact method, path, query and body.
The backend accepts this separately from its existing local operator sessions.
Setup and password login cannot be reached through the director bridge.

The public repository contains source, synthetic test fixtures and operational
instructions. It excludes runtime accounts, collected evidence, source credentials,
private planning/verification records and the signed licence or licence registration.

## Verification

- Full Python suite: 622 passed, 2 environment-specific skips, 2 dependency warnings.
- Embedded/local analyst UI suite: 60 passed; TypeScript and production build passed.
- Full portal suite with the final integration: 1,153 passed, 94 existing skips.
- Updated streaming gateway: 63 focused tests passed, including full 14 MiB CSV/HTML
  downloads, deadlines, cancellation, response restrictions and private headers.
- Compiled embedded UI: 14 browser checks passed at 1280 and 390 pixels using
  explicit synthetic fixtures, including navigation, exports and sign-in recovery.
- Python and TypeScript accept the same byte-for-byte signature test fixture.
- Python Ruff, portal ESLint, TypeScript and production Next build passed.
- Independent review found an embedded evidence link escaping the base path and an
  environment example typo; both were fixed and rechecked.

Read-only measurement of the existing installation established a cold watchlist time
of about 29 seconds and a warm time of about 3 seconds. Existing full reports were
about 12.5 MB CSV and 13.7 MB HTML. That evidence led to a 90-second gateway deadline
and streaming report attachments instead of the initial buffered download path.
Measurements created no snapshots or records and did not change the operator account.

## Deployment boundary

The workspace release contains the entrance and protected gateway. The persistent
engine requires a separate service host and the two documented runtime environment
variables. Without them the page says the analyst desk is not connected. Git push
does not deploy PostgreSQL, OpenSearch or the worker, and does not migrate local data.

The signed-in local desk and its existing evidence remain intact. Hosted acceptance
still requires the selected host, HTTPS service, private data transfer, source/retention
verification and a live director journey. Direct HMCTS receiver delivery needs its own
authenticated ingress if that source is subsequently activated.
