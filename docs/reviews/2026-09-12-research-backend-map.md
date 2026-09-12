# QCS directors' research backend: evidence and integration map

Date: 12 September 2026
Repository: `/Users/williamrogers/Projects/Meritus`
Purpose: Map the current directors' backend and the additions required for the full QCS research system.
Status: Source review and proposed integration, not implementation or production verification.

## Finding

The existing backend provides a useful foundation for the full QCS directors' research system: an authenticated pursuit desk, company research briefs, conversational research, documents, programmes and prospect conversion. The signal acquisition, evidence management and monitoring system described in the supplied strategy still needs to be built.

QCS owns the software. The intended product is QCS research operating inside the existing directors' backend. This review imposes no separate Meritus legal-entity or branding requirement. Existing client deposits remain a static document hold; expanding directors' public and licensed research does not require reading or processing those client deposits.

All source references below are relative to the repository path above. Line references describe the working tree inspected on 12 September 2026. Exploration was read-only. No AGENTS.md was found in the repository or its filesystem ancestors. No secrets, database state or production configuration were read. Tests, builds and migrations were not run. The existing dirty `src/lib/db/schema.ts` and other contributors' work were preserved.

## Current capability map

| Area | Verified capability and integration points |
|---|---|
| Platform | Next.js 15, React 19, Clerk, Neon/Postgres, Drizzle, AI SDK, Resend and AWS S3: `package.json:17-54`. The current application can supply the research interface and API surface. |
| Authentication | Middleware protects `/portal` and `/api/portal`: `src/middleware.ts:6-18`. `requirePortalUser` and `requireActionUser` require a signed-in Clerk user but do not check a director role: `src/lib/portal/auth.ts:5-24,44-55`. |
| Directors | Every returned Clerk user becomes a director, limited to the first 50, with a five-minute cache and eight-second timeout: `src/lib/portal/directors.ts:27-29,70-73,84-111`. There is no explicit role check. |
| Navigation | Home, Prospects, Programmes and Library: `src/app/(portal)/portal/layout.tsx:45-57`. No standalone Research or Signals workspace exists. |
| Pursuits | Firm, contact, website, company number, advised party, counterparty, dispute type, value, forum, summary, owner, stage and next action: `src/lib/db/schema.ts:51-84`. Six stages are defined at `:13-22`. |
| Intake | Public enquiries are validated, deduplicated against unowned enquiries within 24 hours, stored with activity, then alerted through Resend: `src/app/api/contact/route.ts:45-75,99-165`. Throttles are five per email per day, twenty per IP per hour and sixty alert emails per hour: `src/lib/db/throttle.ts:7-15`. |
| Pursuit operations | Server actions return plain results and revalidate the portal: `src/lib/portal/actions.ts:29-61`. Assignment uses an atomic `owner_id is null` guard: `src/lib/db/pursuits.ts:146-157`. |
| Dossier | Loads directors, activities, documents, latest research run, latest completed brief, question history, related pursuits and programme reports: `src/app/(portal)/portal/pursuits/[id]/page.tsx:43-91`. This is the principal integration point for QCS research outcomes. |
| Company research | Direct Companies House company profile, charges count, officers and name search: `src/lib/research/companies-house.ts:183-226`. HTTP requests have ten-second aborts at `:33-46`. |
| Brief | On-demand research about the advised party, otherwise the enquiring firm: `src/lib/brief/run-brief.ts:112-119`. Sequence: company matching, register facts, web research, structured analysis, provenance normalisation, persistence and activity: `:221-302`. |
| AI providers | Language model is `openai/gpt-5.4`; research model is `perplexity/sonar`: `src/lib/ai/model.ts:3-11`. `searchWeb` makes one model request and collects provider source URLs: `src/lib/research/search-web.ts:4-15`. These are source configuration values, not confirmation of live availability. |
| Brief persistence | `briefs` stores status, facts, analysis, summary, URL list, error, creator and creation time: `src/lib/db/schema.ts:132-149`. There is no source snapshot, claim-to-extract link, prompt/model version or research coverage record. |
| Questions drawer | Three tools: `search_web`, `read_brief`, `read_document`: `src/app/api/portal/pursuits/[id]/questions/route.ts:69-135`. It can search company people, projects, news, insolvency and disputes, but remains attached to one pursuit. |
| Questions context | Latest brief, twenty activities, pursuit document list and directors are loaded: questions route `:53-67`. Generation stops after four tool steps with a 45-second tool timeout: `:137-143`. Answers and source labels are persisted at `:146-170`. |
| Documents | Pursuit/library scope, S3 locator, filename, MIME, integer byte size, extracted text, uploader and timestamp: `src/lib/db/schema.ts:102-116`. Director uploads have a 4 MB cap: `src/lib/portal/files.ts:3-5`. |
| Extraction | PDF, DOCX, EML and TXT text extraction, clipped to 50,000 characters; XLSX, images and MSG remain unreadable to the questions drawer: `src/lib/research/extract-text.ts:7-17,60-69`. No OCR or indexed retrieval was found in the reviewed research path. |
| S3 | Uses the existing bucket under configurable `meritus/` prefix, AES256 uploads and authenticated downloads: `src/lib/portal/s3.ts:21-31,56-90`; `src/app/api/portal/documents/[id]/route.ts:14-34`. Current downloads buffer the entire object. |
| Prospects | Static seeded target list with conflict classifications, four judgement scores, evidence category, notes and outreach status: `src/lib/db/schema.ts:173-226`; `src/lib/prospects/model.ts:25-30`. The page seeds the database on first load: `src/app/(portal)/portal/prospects/page.tsx:34-39`. |
| Prospect conversion | Converts a prospect into an owned enquiry with notes copied to its summary: `src/lib/portal/prospect-actions.ts:53-89`. Currently stamps `sourceDetail: "Prospects · BREE ranking"` at `:68`. |
| Programmes | Existing deterministic schedule ingestion and analysis, separate from LLM research: `src/lib/programme/run.ts:18-47`. Formats and method vocabulary: `src/lib/programme/types.ts:9-45`. Programme upload/report endpoints use 60-second functions and cached results: `src/app/api/portal/programmes/route.ts:20-21,79-145`. |
| Jobs | Brief generation uses Next `after()` inside a 120-second route: `src/app/api/portal/pursuits/[id]/brief/route.ts:9-11,58-67`. No durable ingestion queue, scheduled source ingestion, source cursor or monitoring service was found in the reviewed source tree. |

## Confirmed limitations and their implications

### 1. Director isolation is not implemented

Current portal gates authorise any authenticated Clerk user. Current enquiry alerts also send to every `listDirectors()` entry: `src/app/api/contact/route.ts:78-93`. Client onboarding therefore requires explicit director/client checks in middleware, route handlers, server actions and page loaders. This is a source finding; live Clerk access mode and user population were not inspected.

### 2. The evidence model needs claim-level attribution

Brief URL validation confirms that a URL appeared in the research output; it does not validate that a source passage supports the associated claim: `src/lib/brief/facts.ts:88-122`. Question sources collapse multiple pages from the same host into the first URL; document citations retain only titles: `src/lib/questions/sources.ts:20-49`. That helper does not collect the source material returned by `read_brief`.

The research system should preserve source IDs, exact pages, extracts, retrieval times and claim links. Provider-generated research text and a source URL list are useful inputs but do not alone constitute a reproducible evidence record.

### 3. The Companies House client is a snapshot lookup

The implemented client does not fetch filing history, accounts documents, PSC changes, insolvency records or streamed events. Officers are read from only the first twenty returned entries, then resigned entries are removed: `src/lib/research/companies-house.ts:200-214`. A company with many historic appointments can therefore have an incomplete current-officer list. Monitoring requires pagination, stable external identities, change detection and source cursors.

### 4. Research runs need durable, atomic orchestration

The brief endpoint reads the latest run, then inserts another in separate operations: `src/app/api/portal/pursuits/[id]/brief/route.ts:58-66`. Concurrent requests can both start. Stale runs are marked failed after two minutes only when a caller invokes the expiry function: `src/lib/db/briefs.ts:33-45`. Full source monitoring requires unique job keys, leases, retries and resumable checkpoints.

### 5. Confidential context can reach the web provider

Although the full enquiry summary is excluded from the initial research request, dispute nature, approximate value and forum are included: `src/lib/brief/facts.ts:177-183,271-294`. The questions drawer also permits the model to construct a web query from the dossier: `src/app/api/portal/pursuits/[id]/questions/route.ts:80-100`. Introduce deliberate outbound query construction and provider-specific data handling.

### 6. Prompt protection is partial

Named brief, activity and document blocks are fenced, but the pursuit header and document titles are inserted directly into the system prompt: `src/lib/questions/system-prompt.ts:65-99,192-220`. Publicly supplied firm, contact and summary fields can therefore sit outside the named material blocks. Fence all material and validate client-supplied conversation structure at the API boundary.

### 7. Legacy prospect logic needs a separate research decision model

“Approachable” means only `latent_conflict`: `src/lib/db/prospects.ts:12-19`. New prospect records must carry a conflict tier and a ranked/excluded source classification. The prospect page itself says these classifications derive from the BREE tracker and are not an independent conflict check: `src/app/(portal)/portal/prospects/page.tsx:83-86`.

Full QCS research needs separate signal strength, commercial suitability and director conflict decisions. Existing historical classifications should not silently become universal research or eligibility rules.

### 8. Client schema work is incomplete

The pre-existing dirty `src/lib/db/schema.ts` adds `clientDomains` and `documents.clientDomainId` at `:106,118-130`. No corresponding migration or client flow existed in the inspected checkout. `documents.size` remains Postgres `integer` at `:112`, which cannot store the proposed 50 GB byte size. This edit was preserved without modification.

## Specifications and operating boundaries

- The latest owner specification is dated 12 September 2026 and marked “for William Rogers to review”: `docs/superpowers/specs/2026-09-12-owner-requirements-design.md:3-6`.
- It retains the directors' pursuit desk while making client deposits a static hold: `:10,27`.
- It specifies client multipart uploads up to 50 GB, server verification, 24-hour abort handling and short-lived download redirects above 100 MB: `:28-29`. These are documented requirements, not verified implemented capabilities or externally validated platform limits.
- It specifies explicit director/client roles, server-side document scope and a dedicated IAM principal restricted to `meritus/*`: `:37-40`.
- The client-file handover identifies Meritus as the product repository and VeriCase as storage only: `docs/HANDOVER-client-files.md:7-9,55-71`.
- The current user clarification authorises full QCS research within the directors backend. Older exclusions on new research are historical scope decisions and do not block the current research design.
- Preserve static client deposits. Public/licensed research evidence should have its own provenance and access model, without automatically reading client files.
- **Builds apply database migrations:** `package.json:7`; `scripts/migrate.mjs:7-20`. Migration files inspected stopped at `0002_programmes.sql`. A production-connected build must not be used merely as a validation command.
- This review makes no assertion about deployed readiness, live providers, storage credentials or source licensing. Source-specific access and usage validation belong to the wider research review.

## Proposed integration

The complete capability set can be delivered through the existing application. The additions below describe the proposed boundary and integration points, not files already implemented.

| Proposed capability | Integration boundary |
|---|---|
| Research workspace | Add `/portal/research`, watchlists, a signal inbox, organisation/project dossiers, saved investigations and director review. Add navigation in `src/app/(portal)/portal/layout.tsx`; retain pursuit dossiers as the instruction handoff. |
| Source acquisition | Extend `src/lib/research/companies-house.ts`; add adapters under `src/lib/research/sources/` for Gazette, judgments/listings, procurement, payment practices, building safety/remediation, capital programmes, RNS/accounts, recruitment signals and permitted commercial construction/credit feeds. Persist actual coverage and failure states. |
| Structured evidence | Add research entities, external identities, projects, source records, fetched evidence, claims, signals, research runs and review decisions through `src/lib/db/schema.ts`, numbered migrations and separate `src/lib/db/research*.ts` repositories. |
| Durable operations | Persist jobs, source checkpoints, idempotency keys, retries, per-provider rate budgets, change detection and explicit refresh requests. Use scheduled dispatch plus a durable runner suited to source ingestion; keep interactive request handlers short. |
| Entity resolution | Distinguish legal organisation, trading name, group relationship, project and person. Retain candidate matches until reviewed. Reuse exact-match safeguards from the brief without promoting a name match into a group-wide finding. |
| Signal assessment | Classify events, distinguish primary evidence from reported allegations and model inference, deduplicate syndicated stories, identify independent corroboration, decay stale signals and expose reasons for priority scores. |
| Director decisions | Review, correct, dismiss, suppress, watch, assign and convert a lead into a pursuit. Keep contact recommendations reviewable and require a specific director's authorisation before an outbound action. |
| Research assistant | Generalise the current brief/questions components to use evidence IDs, page-level citations and typed research tools, with explicit subject scope, query controls, provider budgets and reproducible run metadata. |
| Outputs | Evidence-led investigation reports, company/project timelines, saved comparisons and director digests, showing source dates, unresolved identities, coverage gaps and review status. |

This integration should preserve existing enquiries, director uploads, programme analysis and pursuit workflows. It does not require moving the product into WR2.0, changing VeriCase application code, creating a separate Meritus entity or automatically processing static client uploads.

## Existing validation and new acceptance criteria

Existing tests provide useful starting points:

- Brief matching, provenance and schema: `src/lib/brief/facts.test.ts`.
- Brief orchestration, timeouts and failure handling: `src/lib/brief/run-brief.test.ts`.
- URL allowlists, prompt blocks and source collection: `src/lib/questions/questions.test.ts`.
- Portal mutations, intake, directors, uploads, extraction and S3: `src/lib/portal/*.test.ts`.
- Programme ingestion, engine, cache and views: `src/lib/programme/*.test.ts`.
- API and component coverage exists for contact, document uploads and several portal components.
- Test command: `package.json:14`; Vitest includes `src/**/*.test.{ts,tsx}` at `vitest.config.mts:7-12`.

New acceptance tests should cover role isolation, evidence attribution, ambiguous identity, independent-source counting, pagination, stale or failed connectors, resumable jobs, concurrent run requests, private-data query controls and reviewed conversion into a pursuit. Integration checks must establish that existing static client deposits remain unread and unchanged by the new research pipeline.

No test result is claimed by this source review.
