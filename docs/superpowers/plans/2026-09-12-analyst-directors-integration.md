# Analyst desk in the Directors Workspace

12 September 2026. The user authorised integration, commit and push to main.

## Design

Preserve existing Research and its data. Add Intelligence at `/portal/intelligence`, hosting the completed analyst interface within the workspace. Import the reviewed standalone source at commit `5983460981062545092b78510330f7bccf32df1f` into `services/analyst`; exclude runtime data, accounts, secrets and the signed licence.

Every proxied operation rechecks the director's current Clerk authority. Vercel signs a short-lived request bound to the verified director, HTTP method, target path and body. The Python service validates the proof and records that director as the actor. Browser credentials, backend secrets and local operator sessions never cross the gateway. Local operation continues to use its existing account and CSRF protection.

The embedded UI uses an explicit base path and the workspace sign-in. PostgreSQL, OpenSearch and worker require a persistent service. Existing Vercel functions cannot run those containers. Do not use localhost as a production target or put the new workload onto the capacity-constrained VeriCase fleet without a hosting decision.

## Tasks

- [x] Import the full source with a provenance record and isolated service configuration.
- [x] Implement and test signed per-request backend director authentication, preserving local operation.
- [x] Implement and test the Clerk-protected proxy, path/body limits, origin checks and private cache controls.
- [x] Add the responsive Intelligence entry and embedded interface, including direct exports.
- [x] Verify Python, web, portal tests, typecheck, lint, production build and independent security review.
- [ ] Commit only intended code and documentation; fetch current main, integrate safely and push without force.
- [ ] Verify the deployed workspace route and report the persistent runtime's actual state.
