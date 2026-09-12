# Intelligence in the Directors Workspace

12 September 2026.

`/portal/intelligence` is the workspace entrance to the full analyst desk. It retains
the watchlist, evidence, source controls, reviews, calendar, relationships, pipeline,
reports, indices and imports. Existing `/portal/research` and pursuit records retain
their existing storage and workflows.

## Deployment components

Vercel serves the workspace and its authenticated gateway. The Python service, worker,
PostgreSQL and OpenSearch need a persistent host. Vercel does not start those containers.
Until the service is configured, the workspace explicitly reports that the analyst
service is not connected. It never links directors to the developer's localhost.

The source lives in `services/analyst`. Its local Compose deployment and operator account
continue to work as before. The existing local database is not uploaded by a Git push.

For the persistent service, use Docker Compose 2.24.4 or later:

```sh
cd services/analyst
make configure
# Add private bridge and host settings to .env, using .env.example for field names.
docker compose -f compose.yaml -f compose.directors.yaml config --quiet
docker compose -f compose.yaml -f compose.directors.yaml up --build -d
```

The Directors deployment uses its own Compose project, network and volumes. It binds
the API to `127.0.0.1:8098`. A host-managed HTTPS reverse proxy must send the service
hostname to this listener and preserve the request path, query and bridge header.
Do not publish the PostgreSQL or OpenSearch ports. Configure restart, disk monitoring
and encrypted, tested backups on the selected host before relying on it operationally.

Set these private environment variables on the Vercel `meritus` project:

| Name | Value |
| --- | --- |
| `INTELLIGENCE_SERVICE_URL` | Dedicated HTTPS origin of the persistent service, without a path, credentials, query or fragment |
| `INTELLIGENCE_BRIDGE_SECRET` | Random secret of at least 32 characters, identical to the service's `MERITUS_PORTAL_BRIDGE_SECRET` |

The service requires `MERITUS_PORTAL_BRIDGE_REQUIRED=true`; the Directors Compose overlay
sets it. Set its allowed-hosts JSON list to the service hostname plus `localhost` and
`127.0.0.1` for health probes. No browser origin or cookie is forwarded by the gateway.

## Access and data

Every request, including JavaScript and CSS assets, checks the current director role
through Clerk before reaching the service. Each service request has a short-lived
proof bound to that director, method, exact target and body. Clients cannot supply
the backend identity. The backend records distinct director actors without creating
local password accounts. Setup and password login are unavailable through the bridge.
Direct HMCTS publisher delivery is also blocked by required bridge mode. Activating
that feed needs a separately authenticated publisher ingress before subscribing.

Gateway responses are private and not cached. Request bodies are capped at 1,000,000
bytes; ordinary buffered responses are capped at 3 MiB. Successful CSV and HTML report
attachments stream with backpressure so full reports are not subject to that buffer
limit. This follows [Vercel's streaming guidance](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions).
Source rights still apply at download time. The request deadline is 90 seconds within
a 120-second function budget, including the entire download. A cancelled, timed-out
or failed stream errors the transfer rather than closing as a complete file.

Before moving existing evidence, take a fresh local backup, restore it into the new
isolated service using the analyst recovery procedure, and verify current retention,
search, counts and the QCS Find Case Law grant. Keep the local installation intact
until the hosted copy has passed acceptance. Do not commit the backup, signed licence,
grant file, source credentials or account data. Evidence/licence migration must use
private storage or an authenticated host transfer, never a public build artifact.

## Release checks

Verify unauthenticated and client users cannot read the gateway. Verify a current
director can open the desk, navigate to Sources and download a permitted report.
Revoke a test director and confirm the next operation is denied. Confirm a request
sent directly to the service without a bridge proof is refused. Preserve the source
access states and describe partial collection honestly.
