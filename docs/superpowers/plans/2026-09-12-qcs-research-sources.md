# QCS Research Sources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver R02 to R13 as evidence-producing source adapters, full case-law research, permitted imports, entity resolution and structured extraction inside QCS's existing application.

**Architecture:** Provider factories validate a job payload's selection, close over its subject and implement the foundation `SourceConnector`. Acquisition returns source envelopes; source-owned extraction returns passages and observed fields; the foundation atomically persists evidence and checkpoints. Workflow code consumes current version IDs and passages rather than detached source text.

**Tech Stack:** Existing Next.js, TypeScript 5.9.3, Node, Zod, Drizzle/Postgres, S3, AI SDK and Vitest; exact added dependencies `csv-parse@7.0.2`, `fast-xml-parser@5.11.1`, `parse5@8.0.1`, `fflate@0.8.3`. These four releases were verified against the npm registry on 12 September 2026; installation must still check the runtime engine constraints and imported dependency graph.

**Spec:** [QCS research design](../specs/2026-09-12-qcs-research-design.md), especially sections 5, 9, 10 and 11; [source audit](../../reviews/2026-09-12-research-data-sources.md); [foundation plan](2026-09-12-qcs-research-foundation.md).

**Status:** Approved on 12 September 2026 and executed in `codex/qcs-research`. The original checklist below records intended steps. See [implementation and acceptance](../../reviews/2026-09-12-qcs-research-delivery.md) for the current implementation, consolidated tests and explicitly separate live deployment acceptance.

## Global Constraints

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

## Integration boundary and file map

Root is `/Users/williamrogers/Projects/Meritus`; all paths below are relative to it. Foundation ownership includes `contracts.ts`, `safe-fetch.ts`, authentication, rights records, budgets, jobs, storage and lifecycle. Source implementation must not duplicate those modules.

```ts
// Import from src/lib/research/contracts.ts, do not redefine these contracts.
type SourceRecord = {id:string;provider:string;hosts:string[];status:'ready'|'unavailable'|'paused';credentialRef:string|null};
type SourceEnvelope = {sourceId:string;providerId:string;url:string;retrievedAt:string;publishedAt:string|null;updatedAt:string|null;eventAt:string|null;contentType:string;body:Uint8Array;metadata:Record<string,unknown>};
type ConnectorContext = {source:SourceRecord;cursor:string|null;window:{from:string;to:string};signal:AbortSignal};
type ConnectorPage = {records:SourceEnvelope[];nextCursor:string|null;coverage:{complete:boolean;notes:string[]}};
type SourceConnector = {provider:string;fetchPage(context:ConnectorContext):Promise<ConnectorPage>};
type ExtractedEvidence = {passages:{locator:{kind:'paragraph'|'page'|'field';value:string};text:string}[];facts:{predicate:string;value:unknown;locator:{kind:'paragraph'|'page'|'field';value:string};status:'observation'|'allegation'|'inference'}[];coverage:{complete:boolean;notes:string[]}};
```

Consume `safeFetch(url:string,options:{source:SourceRecord,signal:AbortSignal,maxBytes:number}):Promise<{url:string,contentType:string,body:Uint8Array,status:number}>` from `src/lib/research/safe-fetch.ts`. It owns every network attempt's host/DNS checks, credentials, budgets and error classification; adapters never call global `fetch`. `ResearchFetchError` from `src/lib/research/errors.ts` supplies `code`, `status` and `retryAfterMs`; 404/410 are returned for source-specific handling. Import `readResearchObject(objectKey:string,signal:AbortSignal):Promise<Uint8Array>` from `src/lib/research/evidence.ts`; it verifies research-object ownership and applies a 32 MiB limit. Never read through the client-document API.

Large snapshots consume foundation `downloadResearchSnapshot(url:string,options:{source:SourceRecord,signal:AbortSignal,maxBytes:number,lease:{jobId:string,leaseToken:number}}):Promise<{objectKey:string,bytes:number,sha256:string,contentType:string}>` and `readResearchObjectStream(objectKey:string,signal:AbortSignal,startByte?:number):Promise<AsyncIterable<Uint8Array>>` from `evidence.ts`. Source-owned `prepareSourceJob(input:{source:SourceRecord,jobId:string,leaseToken:number,payload:Record<string,unknown>,signal:AbortSignal}):Promise<Record<string,unknown>>` in `sources/prepare.ts` persists acquired snapshot selection through foundation `updateResearchJobPayload(jobId:string,leaseToken:number,payload:Record<string,unknown>):Promise<boolean>` from `src/lib/db/research.ts`; false aborts processing. The runner injects this as `RunnerDeps.prepare`, then supplies the prepared payload to the registry.

| Files created | Responsibility |
| --- | --- |
| `src/lib/research/sources/{registry,auth,selection,policy,prepare}.ts` | Validated provider factories, leased snapshot preparation, server credential headers, source-specific access decisions |
| `src/lib/research/sources/{companies-house,ocds,payment-practices,gazette,court-listings,find-case-law,building-safety,publications,commercial}.ts` | Bounded acquisition and provider-specific normalisation |
| `src/lib/research/imports/{parse,map,preview,connector}.ts` | Working CSV/JSON import, mapping errors, repeatable pages |
| `src/lib/research/case-law/{atom,legaldocml,types,service,treatment}.ts` | Stable identifiers, paragraphs, current-authority search, comparisons and reviewed treatment |
| `src/lib/research/entities/{types,resolve,relationships}.ts` | Exact identifiers, unresolved candidates, evidence-backed relationships |
| `src/lib/research/extract/{xml,html,pdf,ods,pipeline,verify}.ts` | Bounded safe extraction, meaningful locators and claim-support checks |
| `src/lib/db/research-case-law.ts` | Current-version, workspace-scoped legal search/read queries |
| `src/lib/research/**/*.test.ts` and `src/lib/research/fixtures/source-manifest.json` | Offline tests and genuine source-response provenance |

Each task uses colocated `.test.ts` files. New raw fixture material belongs under `src/lib/research/fixtures/`, only where source terms permit; licensed judgment content remains in private test storage and is not committed. No invented URL, supposedly real case, payload hash or uncreated fixture filename may stand in for evidence.

## Phase A: executable acquisition and extraction boundary

### Task 1: Register adapters, parser limits and source policies

**Files:** Create `sources/{registry,auth,selection,policy}.ts`, `extract/xml.ts`, `sources/policy.test.ts`; modify `package.json` and the package-manager lockfile under the foundation's dependency convention.
**Interfaces:** Export `getConnector(provider:string,payload:unknown):SourceConnector|null`; `registerSourceAuthentication():void`; `parseSafeXml(text:string):unknown`; `sourceMode(provider:string,hasDeliveryAgreement:boolean):'api'|'import'|'manual'`. Registry validates the job payload `{window:{from:string,to:string},selection:unknown}`, then provider-specific selection before invoking its factory, because `ConnectorContext` intentionally has no subject field. Authentication uses foundation `registerProviderHeaders(provider:string,headers:(secret:string)=>Record<string,string>):void` from `safe-fetch.ts`, leaving secret-reference resolution in foundation.
- [ ] Write the independent-policy regression:
```ts
// @vitest-environment node
import {expect,it} from 'vitest';
import {sourceMode} from './policy';
import {parseSafeXml} from '../extract/xml';
it('keeps HMCTS delivery distinct from QCS judgment access',()=>{
  expect(sourceMode('find-case-law',true)).toBe('api');
  expect(sourceMode('court-listings',false)).toBe('import');
  expect(sourceMode('bailii',false)).toBe('manual');
  expect(()=>parseSafeXml('<!DOCTYPE a [<!ENTITY b "x">]><a>&b;</a>')).toThrow();
});
```
- [ ] Run `corepack pnpm --config.verify-deps-before-run=false exec node node_modules/vitest/vitest.mjs run src/lib/research/sources/policy.test.ts`; expect missing-module failure before implementation.
- [ ] During approved implementation, establish the package-manager baseline: run `COREPACK_ENABLE_AUTO_PIN=0 corepack pnpm --version`, set `package.json`'s `packageManager` to `pnpm@` followed by that exact command result, and run `corepack pnpm import` against the existing unchanged `package-lock.json`.
- [ ] Inspect the new `pnpm-lock.yaml` for unexpected existing-package upgrades; resolve any before running `corepack pnpm install --frozen-lockfile`. Adopt pnpm explicitly by removing the legacy `package-lock.json` only once the imported lock and baseline tests pass; foundation/source workers share this one dependency task. Planning leaves both package files unchanged.
- [ ] Add exact dependencies using `corepack pnpm add --save-exact csv-parse@7.0.2 fast-xml-parser@5.11.1 parse5@8.0.1 fflate@0.8.3`; review package and lock diffs, then repeat frozen-lockfile installation. Preserve other contributors' dependency changes.
- [ ] Implement XML declaration rejection before parsing, UTF-8 decode failure, depth/node/text ceilings, order preservation and entity expansion disabled. Initial limits: 10 MiB XML, depth 100, 200,000 nodes; over-limit input becomes a visible extraction failure.
```ts
import {XMLParser} from 'fast-xml-parser';
const declaration = /<!\s*(DOCTYPE|ENTITY)\b/i;
// Inside parseSafeXml after byte/depth guards:
if (declaration.test(text)) throw new Error('XML declarations are not permitted');
const parsed = new XMLParser({preserveOrder:true,ignoreAttributes:false,processEntities:false}).parse(text);
```
- [ ] Implement `registerSourceAuthentication` by registering CH's header callback, `secret=>({Authorization:'Basic '+Buffer.from(secret+':').toString('base64'),Accept:'application/json'})`; foundation resolves only configured secret references and never forwards them cross-host. Register QCS's signed TNA agreement and purpose; do not ask QCS to reapply or invent a Meritus-holder obstacle. HMCTS and commercial delivery remain separate rights records; their live access state stays unknown/unavailable until confirmed by configuration and a successful authorised contract test.
- [ ] Repeat the test command; add invalid selections, unknown provider, missing credentials and cancelled signal tests. Review the task diff; stage only task files and create an implementation checkpoint commit after approval to execute this plan.

### Task 2: Companies House identities and complete watchlist polling, R02

**Files:** Create `sources/companies-house.ts`, `sources/companies-house.test.ts`; modify `src/lib/research/companies-house.ts` only to share the safe transport while preserving its public brief exports.
**Interfaces:** Export `createCompaniesHouseConnector(selection:{companyNumber:string}):SourceConnector`, `companyResourceUrl(companyNumber:string,resource:'profile'|'officers'|'filings'|'charges'|'insolvency',startIndex?:number):string`, `nextCompanyOffset(start:number,items:number,total:number):number|null`. Keep `searchCompanies(name,limit)` returning its existing candidates, with no first-hit identity confirmation.
- [ ] Write URL and pagination tests:
```ts
// @vitest-environment node
import {expect,it} from 'vitest';
import {companyResourceUrl,nextCompanyOffset} from './companies-house';
it('retains prefixes, resigned-officer pages and terminal boundaries',()=>{
  const u=new URL(companyResourceUrl('SC012345','officers',20));
  expect(u.pathname).toBe('/company/SC012345/officers');
  expect(u.searchParams.get('start_index')).toBe('20');
  expect(nextCompanyOffset(0,20,23)).toBe(20);
  expect(nextCompanyOffset(20,3,23)).toBeNull();
});
```
- [ ] Run `corepack pnpm --config.verify-deps-before-run=false exec node node_modules/vitest/vitest.mjs run src/lib/research/sources/companies-house.test.ts`; confirm red, then implement.
- [ ] Use `https://api.company-information.service.gov.uk`: `/search/companies?q=`, `/company/{number}`, `/officers`, `/filing-history`, `/charges`, `/insolvency`. Preserve resource responses and exact field locators. Encode cursor `{resource,startIndex}`; request one resource page per invocation; a missing insolvency resource is an observed absence for that request, not proof of solvency.
```ts
export function nextCompanyOffset(start:number,items:number,total:number):number|null {
  if(items===0 && start<total) throw new Error('Incomplete Companies House page');
  return start+items<total ? start+items : null;
}
```
- [ ] Configure one shared 600 requests/300 seconds limit across CH search, old briefs and new polling. Preserve resigned appointments and filing transaction IDs; detect overdue accounts and changes from successive versions, without calling every resignation a finance-director departure. A new charge or petition is not an adjudicated debt.
- [ ] Replay captured, authorised CH responses through a mocked `safeFetch`; test two pages, unchanged replay, malformed total, 401, 429 and cancellation. No stream in the hosted route; document separate supervised-stream expansion with two connections/account, durable timepoints and 416 reconciliation.
- [ ] Repeat the test command and existing brief tests, review and checkpoint only task files. [CH API](https://developer.company-information.service.gov.uk/), [streaming constraints](https://developer-specs.company-information.service.gov.uk/streaming-api/guides/overview).

### Task 3: Procurement releases, changes, performance and termination, R03

**Files:** Create `sources/ocds.ts`, `sources/ocds.test.ts`.
**Interfaces:** Export `createOcdsConnector(provider:'find-a-tender'|'contracts-finder'):SourceConnector`, `ocdsUrl(provider,window:{from:string,to:string}):string`, `releaseIdentity(release:{ocid:string,id:string}):string`. Preserve source `version`, `extensions`, party identifier schemes and exact paths for separate award/contract values.
- [ ] Write the provider-specific boundary test:
```ts
// @vitest-environment node
import {expect,it} from 'vitest';
import {ocdsUrl,releaseIdentity} from './ocds';
it('uses distinct clocks and composite release identities',()=>{
  const w={from:'2026-09-10T00:00:00',to:'2026-09-11T00:00:00'};
  expect(new URL(ocdsUrl('find-a-tender',w)).searchParams.has('updatedFrom')).toBe(true);
  expect(new URL(ocdsUrl('contracts-finder',w)).searchParams.has('publishedFrom')).toBe(true);
  expect(releaseIdentity({ocid:'ocds-h6vhtk-06f77f',id:'086167-2026'})).toBe('ocds-h6vhtk-06f77f:086167-2026');
});
```
- [ ] Run `corepack pnpm --config.verify-deps-before-run=false exec node node_modules/vitest/vitest.mjs run src/lib/research/sources/ocds.test.ts`; verify red.
- [ ] Implement FTS `/api/1.0/ocdsReleasePackages` and CF `/Published/Notices/OCDS/Search` on their official hosts, `limit=100`, fixed run upper bound, returned `links.next` cursor and overlap replay. Validate next-link host and unchanged window. Do not decode opaque tokens or initially filter away new stages.
```ts
export function releaseIdentity(release:{ocid:string,id:string}):string {
  return `${release.ocid}:${release.id}`;
}
```
- [ ] Preserve cancelled awards, amendments, lots, suppliers, `noticeType`, KPI ratings and termination reasons. Extract UK performance/failure extension fields only from publisher-schema-validated payloads; if absent report missing performance coverage. Ordinary performance reporting is not automatically adverse; full termination can carry the breach record instead.
- [ ] Capture the audited FTS window and CF window as permitted genuine regression fixtures with exact URL/time/hash manifest. Test differing award/contract currencies, inconsistent lot currency, missing supplier identifier, edited release, copied notice, out-of-order dates and malicious next link. Treat FTS 429/503 with Retry-After and CF rate-limit 403 as five-minute pause, leaving cursors unchanged.
- [ ] Repeat tests, review and checkpoint. [FTS contract](https://www.find-tender.service.gov.uk/apidocumentation/1.0/GET-ocdsReleasePackages), [CF contract](https://www.contractsfinder.service.gov.uk/apidocumentation/Notices/1/GET-Published-Notice-OCDS-Search).

### Task 4: Payment Practices and a real reusable import engine, R04/R11

**Files:** Create `imports/{parse,map,preview,connector,split-csv,snapshot-page}.ts`, `sources/{payment-practices,prepare}.ts`, `imports/{parse,split-csv,snapshot-page}.test.ts`, `sources/prepare.test.ts`, `scripts/research/split-csv.mts`.
**Interfaces:** `parseCsvRows(body:Uint8Array):AsyncIterable<Record<string,string>>`; `parseJsonRows(body:Uint8Array):Record<string,unknown>[]`; `previewImport(body:Uint8Array,format:'csv'|'json',mapping:Record<string,string>):Promise<{rows:Record<string,unknown>[],errors:{row:number,field:string,message:string}[]}>`; `createImportConnector(selection:{objectKey:string,format:'csv'|'json',mapping:Record<string,string>,snapshotId:string,partIndex:number,partCount:number}):SourceConnector`; `createPaymentConnector(selection:{objectKey:string,snapshotHash:string}):SourceConnector`; `splitCsv(inputPath:string,outputDir:string,maxPartBytes:number):Promise<{snapshotHash:string,parts:{filename:string,sha256:string,rowCount:number}[]}>`.
- [ ] Write an explicit parser regression using a constructed CSV string, not a claimed source report:
```ts
// @vitest-environment node
import {expect,it} from 'vitest';
import {parseCsvRows} from './parse';
it('preserves quoted newlines, exact identifiers and missing measures',async()=>{
  const body=new TextEncoder().encode('Company number,Average time to pay,Note\r\n00001234,,"line one\nline two"\r\n');
  const rows=[]; for await(const row of parseCsvRows(body)) rows.push(row);
  expect(rows).toEqual([{'Company number':'00001234','Average time to pay':'',Note:'line one\nline two'}]);
});
```
- [ ] Run `corepack pnpm --config.verify-deps-before-run=false exec node node_modules/vitest/vitest.mjs run src/lib/research/imports/parse.test.ts`; verify red.
- [ ] Implement streaming CSV iteration with 1 MiB maximum record, duplicate-header rejection, BOM support and 500,000-row ceiling; JSON accepts an array of objects only, with maximum depth 30. Retain original cell strings, never execute formula-like values, and hand formula-safe export to workflow.
```ts
import {Readable} from 'node:stream';
import {parse} from 'csv-parse';
export async function* parseCsvRows(body:Uint8Array):AsyncIterable<Record<string,string>> {
  const columns=(header:string[])=>{
    if(new Set(header).size!==header.length) throw new Error('Duplicate CSV headers');
    return header;
  };
  const parser=Readable.from([body]).pipe(parse({columns,bom:true,max_record_size:1_048_576,skip_empty_lines:true}));
  let count=0;
  for await(const row of parser) {
    if(++count>500_000) throw new Error('CSV row limit exceeded');
    yield row as Record<string,string>;
  }
}
```
- [ ] Acquire the full official `https://check-payment-practices.service.gov.uk/export/csv/` through foundation's `downloadResearchSnapshot(url,{source,signal,maxBytes,lease:{jobId,leaseToken}})` from `evidence.ts`; its result is `{objectKey,bytes,sha256,contentType}`. Use the configured initial 1 GiB ceiling, bounded streaming multipart upload, shared trusted transport, counted source requests and a lease renewed every 30 seconds. Never buffer the full CSV or invent an upstream range/export-filter endpoint: the live range request returned HTTP 200 without range metadata and HEAD returned 405.
- [ ] Implement `prepareSourceJob` using the integration signature: non-snapshot providers return the original payload; Payment Practices validates and reuses an existing immutable snapshot or downloads one, sets `selection:{objectKey,snapshotHash:sha256}`, and awaits `updateResearchJobPayload` before returning the whole prepared payload. Preserve `window` and other validated job fields. Only complete multipart uploads become readable snapshots. If acquisition cannot finish within the hosted 90-second job budget, abort visibly and run the same job in the supervised longer-running Node worker; record this runtime choice. Neither a partial transfer nor an expired lease advances a checkpoint.
- [ ] Implement `parseCsvPage(input:AsyncIterable<Uint8Array>,cursor:{nextByte:number,columns:string[]|null},limit:number):Promise<{rows:Record<string,string>[],columns:string[],nextByte:number,complete:boolean}>` in `imports/snapshot-page.ts`. Use `csv-parse` record `info.bytes` for the exact completed-record boundary, including the original BOM/header in the initial parse; retain original columns for subsequent pages. Absolute `nextByte` equals the stream's starting offset plus that record's consumed bytes. Preserve UTF-8 byte counts, never character counts or line counts.
- [ ] Read immutable snapshots with foundation `readResearchObjectStream(objectKey,signal,startByte)` and page 250 rows, applying a 1 MiB record limit. Private S3 byte ranges support resume without rereading earlier rows; this does not rely on provider Range support. Commit `{snapshotHash,objectKey,nextByte,columns,rowNumber}` atomically with row evidence. The 500,000-row preview limit above does not truncate automated full snapshots; the snapshot byte ceiling and per-page budgets bound them.
- [ ] Write the complete-record resume regression:
```ts
// @vitest-environment node
import {expect,it} from 'vitest';
import {parseCsvPage} from './snapshot-page';
async function* chunks(bytes:Uint8Array):AsyncIterable<Uint8Array> {
  for(let i=0;i<bytes.length;i+=3) yield bytes.slice(i,i+3);
}
it('resumes after quoted UTF-8 records using exact source byte offsets',async()=>{
  const prefix='\uFEFFCompany,Note\r\nQCS,"one\ntwó"\r\n';
  const bytes=new TextEncoder().encode(prefix+'Example,three\r\n');
  const first=await parseCsvPage(chunks(bytes),{nextByte:0,columns:null},1);
  expect(first.nextByte).toBe(new TextEncoder().encode(prefix).length);
  const second=await parseCsvPage(chunks(bytes.slice(first.nextByte)),{nextByte:first.nextByte,columns:first.columns},250);
  expect(second.rows).toEqual([{Company:'Example',Note:'three'}]);
  expect(second.nextByte).toBe(bytes.length);
  expect(second.complete).toBe(true);
});
```
- [ ] Run `corepack pnpm --config.verify-deps-before-run=false exec node node_modules/vitest/vitest.mjs run src/lib/research/imports/snapshot-page.test.ts`; confirm red, implement and repeat. Test interrupted download, expired lease, aborted multipart, byte ceiling, truncated final record, exact 250-row boundary, oversize record and UTF-8 across chunks. Hash-matching immutable snapshot replay must produce identical IDs and offsets.
- [ ] Implement `splitCsv` as a local streaming file utility for a director-downloaded research export, writing complete quoted CSV records with repeated headers into parts below 16 MiB; emit a full-input hash and part-hash/row-count manifest. `scripts/research/split-csv.mts` validates `--input` and `--output` arguments and calls it. Import preview accepts all manifest parts, verifies every hash and requires all parts before marking a snapshot complete; reconcile deletions only after the complete manifest has committed. Individual parts remain visibly partial. Test quoted newlines across stream chunks and an absent/tampered part.
- [ ] Key payment rows by `Report Id`; preserve `Policy Regime`, period dates, filing date, company number, percentages, invoice totals, retention fields and URL. Hash each row and reconcile revisions across complete snapshots. Compare periods only with compatible regimes/durations; financial years beginning 1 April 2025 control retention applicability.
- [ ] Test row-level errors, invalid dates/percentages, duplicate reports, corrected reports, empty values, interrupted parse, oversized file and replayed import page. Mapping preview must show rejected rows before enqueueing; foundation guards director access and research-only object keys. Repeat tests, review and checkpoint. [Export](https://check-payment-practices.service.gov.uk/export/).

## Phase B: judicial, insolvency and building-safety evidence

### Task 5: Gazette events and independently authorised court listings, R05/R07

**Files:** Create `sources/{gazette,court-listings}.ts`, `sources/gazette.test.ts`.
**Interfaces:** `createGazetteConnector(selection:{noticeTypes:string[]}):SourceConnector`; `gazetteAllowedAt(now:Date):boolean`; `classifyInsolvency(code:string):'petition'|'order'|'appointment'|'resolution'|'other'`; `normaliseListing(row:Record<string,unknown>):ExtractedEvidence`. Automated HMCTS factory is registered only after its delivered API contract has been implemented and tested; the working import factory remains available.
- [ ] Write event/window distinctions:
```ts
// @vitest-environment node
import {expect,it} from 'vitest';
import {gazetteAllowedAt,classifyInsolvency} from './gazette';
it('uses London business hours and does not turn a petition into an order',()=>{
  expect(gazetteAllowedAt(new Date('2026-09-12T12:00:00Z'))).toBe(false);
  expect(gazetteAllowedAt(new Date('2026-09-12T21:00:00Z'))).toBe(true);
  expect(classifyInsolvency('2450')).toBe('petition');
});
```
- [ ] Run `corepack pnpm --config.verify-deps-before-run=false exec node node_modules/vitest/vitest.mjs run src/lib/research/sources/gazette.test.ts`; verify red.
- [ ] Use permitted `https://www.thegazette.co.uk/insolvency/notice/data.feed`, `noticetype`, `start-publish-date`, `end-publish-date`, `results-page` and returned next links. Check robots and the 21:00 to 07:00 UK window before each job; observe at least the current ten-second crawl delay. Block disallowed structured notice paths; never substitute another route to evade the restriction.
```ts
const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',hourCycle:'h23'}).format(now));
return hour>=21 || hour<7; // body of gazetteAllowedAt
```
- [ ] Normalise notice ID, type, publication date, named company and exact company number only if present. Separate debt allegations, orders and appointments; verify project relationships separately. Treat Gazette and CH reports of one appointment as one underlying event for downstream scoring.
- [ ] Implement listing CSV/JSON mapping with case reference, court, publication/hearing date, hearing type and party strings. Required source agreement distinguishes HMCTS from TNA; manual links do not trigger crawling. Store amended/cancelled listings and leave outcomes unset unless separately evidenced.
- [ ] Test winter/summer times, blocked paths, modified notice, absent company number, 404, licence-unavailable state and CSV listing correction; repeat tests, review and checkpoint. [Gazette policy](https://www.thegazette.co.uk/fair-use-policy), [HMCTS access](https://www.gov.uk/guidance/apply-for-an-hmcts-third-party-courts-and-tribunals-data-licence).

### Task 6: Find Case Law acquisition and current LegalDocML, R06/R13

**Files:** Create `sources/find-case-law.ts`, `case-law/{atom,legaldocml,types}.ts`, `case-law/atom.test.ts`.
**Interfaces:** Export `CaseSearch {query?:string,courts?:string[],party?:string,judge?:string,from?:string,to?:string}`; `caseFeedUrl(input:CaseSearch,order:'-transformation'|'-updated'):string`; `createCaseLawConnector(selection:CaseSearch):SourceConnector`; `parseAtom(xml:string):{entries:CaseFeedEntry[],next:string|null}`; `CaseFeedEntry {uri:string,identifiers:{type:string,value:string,slug:string}[],xmlUrl:string|null,pdfUrl:string|null,publishedAt:string|null,transformedAt:string|null,contentHash:string|null}`; `parseLegalDocMl(xml:string):ExtractedEvidence`.
- [ ] Write API parameter tests without inventing an example judgment:
```ts
// @vitest-environment node
import {expect,it} from 'vitest';
import {caseFeedUrl} from './atom';
it('includes PDF-only records and uses repeated court parameters',()=>{
  const u=new URL(caseFeedUrl({query:'adjudication',courts:['uksc','ewhc/tcc']},'-transformation'));
  expect(u.searchParams.getAll('court')).toEqual(['uksc','ewhc/tcc']);
  expect(u.searchParams.get('minimum_availability')).toBe('document');
  expect(u.searchParams.get('order')).toBe('-transformation');
});
```
- [ ] Run `corepack pnpm --config.verify-deps-before-run=false exec node node_modules/vitest/vitest.mjs run src/lib/research/case-law/atom.test.ts`; verify red.
- [ ] Build `https://caselaw.nationalarchives.gov.uk/atom.xml` using documented `query`, repeated `court`, `party`, `judge`, `order`, `page`, `per_page=50`, `minimum_availability=document`. Apply requested date bounds locally to parsed decision dates; no undocumented `from`/`to` API parameters. Follow `rel=next` under source host allowlists and maintain separate transformation and metadata-refresh cursors.
```ts
const url=new URL('https://caselaw.nationalarchives.gov.uk/atom.xml');
url.searchParams.set('minimum_availability','document');
for(const court of input.courts??[]) url.searchParams.append('court',court);
```
- [ ] Prefer each feed's `application/akn+xml` alternate; documented fallback is `/{document_uri}/data.xml`. Treat `tna:uri` as stable opaque identity, including `d-...`; preserve every supplied identifier and changing preferred display identity. Do not derive court/year/citation from a URI or enforce citation uniqueness.
- [ ] Parse LegalDocML namespace-aware ordered paragraphs, paragraph numbers/eIds, tables, parties, court, handed-down date and cited authorities. Store raw byte SHA-256 separately from `tna:contenthash`; the latter hashes stripped body content. PDF-only entries use safe PDF extraction with page locators and visible paragraph limitations.
- [ ] Limit FCL to 1,000 requests per rolling 300 seconds per egress IP, shared across workers. Use the provider's `-transformation` order for XML/body changes and a separate bounded `-updated` scan for metadata changes. Do not terminate a metadata scan using the entry's transformation timestamp; exhaust its configured population/window and disclose truncation.
- [ ] Test publisher-documentation Atom examples as explicitly labelled documentation examples, real private authorised XML responses, multiple identifiers, missing XML, metadata-only updates and hostile XML. 404/410 hides content pending reconciliation; 429 never withdraws. Replacement/removal passes document IDs to foundation purge/invalidation, including reports, caches, passages, objects and restoration purge.
- [ ] Repeat tests, review and checkpoint. Preserve QCS's actual signed purpose, attribution and licensor-approved partial-coverage notice; no third-party crawling or automatic external distribution. [Official API contract](https://nationalarchives.github.io/ds-find-caselaw-docs/public).

### Task 7: Full legal research, comparisons and evidenced treatment, R06

**Files:** Create `case-law/{service,treatment}.ts`, `src/lib/db/research-case-law.ts`, `case-law/treatment.test.ts`, `src/app/(portal)/portal/research/case-law/page.tsx`, `src/app/(portal)/portal/research/case-law/[documentId]/page.tsx`, `src/components/portal/research/{CaseLawSearch,CaseLawReader}.tsx`, `src/components/portal/research/CaseLawReader.test.tsx`, `src/app/api/portal/research/case-law/route.ts`, `src/app/api/portal/research/case-law/[documentId]/route.ts`.
**Interfaces:** `CaseHit {documentId:string,versionId:string,title:string,identifiers:{type:string,value:string}[],passageIds:string[],coverage:string[]}`; `searchCaseLaw(workspaceId:string,input:CaseSearch):Promise<CaseHit[]>`; `readCaseLaw(workspaceId:string,documentId:string):Promise<CaseHit & {passages:{id:string,locator:string,text:string}[]}>`; `compareAuthorities(workspaceId:string,documentIds:string[],issue:string):Promise<{rows:{documentId:string,proposition:string,passageIds:string[]}[],unresolved:string[]}>`.
**Treatment interfaces:** `Treatment {fromDocumentId:string,toDocumentId:string,kind:'cites'|'applies'|'distinguishes'|'overrules'|'appeal',passageId:string|null,reviewed:boolean}`; `verifiedTreatment(items:Treatment[]):Treatment[]`.
- [ ] Write the false-citator protection:
```ts
// @vitest-environment node
import {expect,it} from 'vitest';
import {verifiedTreatment} from './treatment';
it('requires reviewed express evidence for treatment and appeal status',()=>{
  expect(verifiedTreatment([{fromDocumentId:'a',toDocumentId:'b',kind:'overrules',passageId:null,reviewed:false}])).toEqual([]);
  expect(verifiedTreatment([{fromDocumentId:'a',toDocumentId:'b',kind:'appeal',passageId:'p',reviewed:true}])).toHaveLength(1);
});
```
- [ ] Run `corepack pnpm --config.verify-deps-before-run=false exec node node_modules/vitest/vitest.mjs run src/lib/research/case-law/treatment.test.ts`; verify red.
- [ ] Implement parameterised Postgres full-text search across available current versions and passage text, plus exact identifier, party, court and date filters. Any requested remote discovery queues FCL jobs; a local corpus miss is incomplete coverage, not “no authority exists”. SQL always includes workspace, current-version and availability predicates.
```ts
export function verifiedTreatment(items:Treatment[]):Treatment[] {
  return items.filter(item=>item.reviewed && item.passageId!==null);
}
```
- [ ] Comparison retrieves identified passages first, then asks the existing AI Gateway for structured issue/holding/reasoning rows with allowed passage IDs. Validate quotations against source text. Model output is proposed analysis, never director review. Add separate appeal-event evidence; a citation alone means `cites`, never `overrules`.
- [ ] Implement director-gated pages and GET routes around these services; Next route/page params are awaited. Search offers legal issue, court, party, citation and dates; reader shows current version, paragraphs, identifiers, holdings/reasoning, comparison and reviewed appeal/treatment links. Private responses require `noindex`, private no-store cache policy, attribution and approved coverage text. Workflow integrates these source-owned pages/components rather than duplicating them. No public judgment download route.
- [ ] Define `CaseLawReader({title,passages}:{title:string,passages:{id:string,locator:string,text:string}[]})` using escaped React text and `id={'passage-'+passage.id}`; add the reader regression:
```tsx
import {expect,it} from 'vitest';
import {render,screen} from '@testing-library/react';
import {CaseLawReader} from './CaseLawReader';
it('renders an exact passage locator and escapes source markup',()=>{
  const {container}=render(<CaseLawReader title="Reader regression" passages={[{id:'p',locator:'paragraph 1',text:'<script>alert(1)</script>'}]}/>);
  expect(screen.getByText('paragraph 1')).toBeInTheDocument();
  expect(container.querySelector('script')).toBeNull();
  expect(container.querySelector('#passage-p')).not.toBeNull();
});
```
- [ ] Run `corepack pnpm --config.verify-deps-before-run=false exec node node_modules/vitest/vitest.mjs run src/components/portal/research/CaseLawReader.test.tsx`; confirm red, implement and repeat.
- [ ] Add isolated-DB tests for date filters, ambiguous citation identifiers, replaced versions, hidden judgments, foreign workspace, missing passages and comparison model hallucinations. Repeat focused tests, review and checkpoint; full corpus coverage or commercial citator equivalence must never be claimed.

### Task 8: BSR aggregates, named remediation and supplied project evidence, R08

**Files:** Create `sources/building-safety.ts`, `extract/{ods,pdf}.ts`, `sources/building-safety.test.ts`.
**Interfaces:** `GatewayMetric {periodFrom:string,periodTo:string,category:string,measure:string,value:number,denominator:number|null,sourceLocator:string}`; `normaliseGatewayMetric(input:GatewayMetric):StructuredFact`; define `StructuredFact=ExtractedEvidence['facts'][number]`; `parseRemediationOds(body:Uint8Array):ExtractedEvidence`; `createBuildingSafetyConnector(selection:{publicationUrl:string}):SourceConnector`.
- [ ] Write the population/project separation test:
```ts
// @vitest-environment node
import {expect,it} from 'vitest';
import {normaliseGatewayMetric} from './building-safety';
it('keeps a cohort metric distinct from a named project delay',()=>{
  const fact=normaliseGatewayMetric({periodFrom:'2026-06-01',periodTo:'2026-08-31',category:'new-build',measure:'median-approval-weeks',value:22,denominator:null,sourceLocator:'page:3'});
  expect(fact.predicate).toBe('gateway.cohortMetric');
  expect(fact.value).not.toHaveProperty('projectId');
});
```
- [ ] Run `corepack pnpm --config.verify-deps-before-run=false exec node node_modules/vitest/vitest.mjs run src/lib/research/sources/building-safety.test.ts`; verify red.
- [ ] Discover attachments from the official BSR collection and remediation publication URLs listed in the audit, not guessed API endpoints. Use existing `pdf-parse` per-page output; preserve page/table labels and extraction gaps. With `fflate`, inspect ODS ZIP entries, require `content.xml`, reject traversal, cap 200 entries/50 MiB expanded/100:1 expansion, then use the safe XML parser.
```ts
export function normaliseGatewayMetric(input:GatewayMetric):StructuredFact {
  return {predicate:'gateway.cohortMetric',value:input,locator:{kind:'page',value:input.sourceLocator},status:'observation'};
}
```
- [ ] Retain report windows, cohorts, denominators, suppressed/banded cells and methodology; do not sum overlapping programmes. Map named developer progress to developer-level facts. Import project-specific submission, validation, agreed extension and decision dates only with evidence about that project; do not calculate compensation from an aggregate median.
- [ ] Validate against the actual June to August 2026 PDF and July 2026 ODS URLs in the audit; record hashes at capture, not invented values. Add tests for workbook revisions, missing denominator, developer versus building scope, failed PDF extraction and wrong-year narrative. Repeat tests, review and checkpoint.

## Phase C: wider research, imports and evidence resolution

### Task 9: Programme owners, issuer accounts/RNS, news and recruitment, R09/R10

**Files:** Create `sources/publications.ts`, `extract/html.ts`, `sources/publications.test.ts`; reuse existing AI model configuration and web search only for discovery.
**Interfaces:** `PublicationSelection {url:string,kind:'programme'|'accounts'|'rns'|'news'|'recruitment',subjectId:string}`; `createPublicationConnector(selection:PublicationSelection):SourceConnector`; `publicationEvidenceWeight(kind:PublicationSelection['kind']):'primary'|'contextual'`; `extractHtml(body:Uint8Array):ExtractedEvidence`.
- [ ] Write the weak-signal regression:
```ts
// @vitest-environment node
import {expect,it} from 'vitest';
import {publicationEvidenceWeight} from './publications';
it('keeps recruitment contextual',()=>{
  expect(publicationEvidenceWeight('recruitment')).toBe('contextual');
  expect(publicationEvidenceWeight('accounts')).toBe('primary');
});
```
- [ ] Run `corepack pnpm --config.verify-deps-before-run=false exec node node_modules/vitest/vitest.mjs run src/lib/research/sources/publications.test.ts`; verify red.
- [ ] Validate selected source hosts and purpose before retrieval; query programme/issuer names without client text. Search results only enqueue the actual discovered URL after source registration. No invented universal RNS endpoint or assumed publisher licence. Use programme-owner and issuer documents for AMP8, roads, rail, energy, grid, housing and Gulf research; permitted publications/imports supply absent APIs.
```ts
export function publicationEvidenceWeight(kind:PublicationSelection['kind']):'primary'|'contextual' {
  return kind==='news'||kind==='recruitment' ? 'contextual' : 'primary';
}
```
- [ ] Parse HTML with `parse5`; remove script/style/iframe content, preserve headings and field locators, escape output. Accounts/RNS extraction retains accounting period, provision type, gross/net amounts, currency and page; capital programmes retain owner, geography, period, approved/proposed status and named award references. Original-versus-republication provenance must survive normalisation.
- [ ] Label proposed provisions, reported allegations, employment adverts and inferred risks separately. No automatic limitation date, impending dispute or adviser dissatisfaction from these inputs. Fetch failures remain coverage gaps; a publisher page's “primary” classification never establishes the truth of its claim without passage evidence.
- [ ] Test malicious page instructions, discovery without retrieved text, table currency context, syndicated release, expired advert and inaccessible issuer PDF. Repeat tests, review and checkpoint.

### Task 10: Commercial/devolved imports and BAILII supplementary research, R11/R06

**Files:** Create `sources/commercial.ts`, `imports/commercial.test.ts`, `docs/research/provider-contracts.md`; consume Task 4's real import engine.
**Interfaces:** `CommercialImport {provider:string,agreementId:string,distribution:'internal'|'approved-external',format:'csv'|'json',mapping:Record<string,string>}`; `validateCommercialImport(input:CommercialImport):CommercialImport`; provider API factories remain absent from the ready registry until endpoint/schema/auth/quota tests exist.
- [ ] Write the real import-contract failure test:
```ts
// @vitest-environment node
import {expect,it} from 'vitest';
import {validateCommercialImport} from '../sources/commercial';
it('requires an actual agreement reference for a licensed extract',()=>{
  expect(()=>validateCommercialImport({provider:'glenigan',agreementId:'',distribution:'internal',format:'csv',mapping:{id:'Project ID'}})).toThrow();
});
```
- [ ] Run `corepack pnpm --config.verify-deps-before-run=false exec node node_modules/vitest/vitest.mjs run src/lib/research/imports/commercial.test.ts`; verify red.
- [ ] Implement Zod validation and import preview for construction/credit/planning data; retain provider IDs, source agreement, field mapping, original row, unknown fields and declared timestamps. A valid import remains operational when no paid API credentials exist. Source rights constrain downstream exports independently of the row's format.
```ts
import {z} from 'zod';
const commercialSchema=z.object({provider:z.string().min(1),agreementId:z.string().trim().min(1),distribution:z.enum(['internal','approved-external']),format:z.enum(['csv','json']),mapping:z.record(z.string(),z.string().min(1))});
export function validateCommercialImport(input:CommercialImport):CommercialImport {
  return commercialSchema.parse(input);
}
```
- [ ] Record documented Barbour base `https://api.barbour-abi.com/v4`, project/company resources, `limit`/`offset`, 500 maximum page, 10,000 search ceiling, `project_last_published` partitions and `/projects/merges`/`companies/merges`. Implement only against the purchased Developer/Locations contract and authorised sample; preserve merge aliases. Glenigan/Creditsafe feeds require their actual contract, current documentation and samples, not guessed endpoints.
- [ ] Provide director-entered BAILII links and deliberately supplied permitted documents through research imports; record source and reuse assessment. TNA's licence does not authorise BAILII crawling. The automated BAILII copyright-page check was denied on 12 September 2026, so no automatic delivery is represented as available. Use a permitted manual route for Scotland, Northern Ireland and other supplementary authorities.
- [ ] Document Glenigan's derived-statistics/distribution restrictions and the applicable dated Barbour terms; prohibit automatic external feeds. Test missing agreement, malformed mapping, duplicates, project merges, non-UK identities and import-only operation. Repeat tests, review and checkpoint; [Barbour API](https://barbour-abi.com/api-fundamentals/), [Glenigan terms](https://www.glenigan.com/general-terms-of-business/).

### Task 11: Entity resolution, passage verification and extraction dispatch, R12/R13

**Files:** Create `entities/{types,resolve,relationships}.ts`, `extract/{pipeline,verify}.ts`, `entities/resolve.test.ts`.
**Interfaces:** `IdentityInput {kind:'company'|'group'|'person'|'project'|'contract'|'case'|'adviser',name:string,jurisdiction:string|null,identifiers:{scheme:string,value:string}[]}`; `EntityCandidate=IdentityInput & {id:string,verified:boolean}`; `Resolution {entityId:string|null,state:'matched'|'review'|'new',candidateIds:string[]}`; `resolveEntity(input:IdentityInput,candidates:EntityCandidate[]):Resolution`; `extractEnvelope(envelope:SourceEnvelope):Promise<ExtractedEvidence>`; `supportsQuotation(quotation:string,passage:string):boolean`.
- [ ] Write the ambiguous-name regression with explicitly constructed entity candidates:
```ts
// @vitest-environment node
import {expect,it} from 'vitest';
import {resolveEntity} from './resolve';
it('does not transfer an identity on name alone',()=>{
  const input={kind:'company' as const,name:'Example',jurisdiction:'GB',identifiers:[]};
  const result=resolveEntity(input,[{...input,id:'one',verified:true},{...input,id:'two',verified:true}]);
  expect(result.state).toBe('review');
  expect(result.entityId).toBeNull();
});
it('resolves an OCDS company identifier through the CH canonical scheme',()=>{
  const input={kind:'company' as const,name:'Synthetic example',jurisdiction:'GB',identifiers:[{scheme:'GB-COH',value:'00001234'}]};
  const candidate={...input,id:'one',verified:true,identifiers:[{scheme:'uk-company-number',value:'00001234'}]};
  expect(resolveEntity(input,[candidate])).toEqual({entityId:'one',state:'matched',candidateIds:['one']});
});
```
- [ ] Run `corepack pnpm --config.verify-deps-before-run=false exec node node_modules/vitest/vitest.mjs run src/lib/research/entities/resolve.test.ts`; verify red.
- [ ] Match only verified exact identifiers under schemes with known uniqueness, correct entity kind and jurisdiction; name, address and corporate-group matches remain review candidates. Canonicalise procurement `GB-COH` to foundation `uk-company-number`, retaining original provider scheme/value in envelope metadata; normalise CH formatting while retaining prefixes and leading zeroes. Verified matching and database uniqueness use this canonical scheme, so CH and procurement link one company. Non-UK identifiers retain scheme and exact string; do not coerce all companies to eight-digit UK numbers.
```ts
export function supportsQuotation(quotation:string,passage:string):boolean {
  const normalise=(value:string)=>value.normalize('NFC').replace(/\s+/g,' ').trim();
  return normalise(quotation).length>0 && normalise(passage).includes(normalise(quotation));
}
```
- [ ] Implement extractor dispatch by source provider and verified content type; set `envelope.metadata.parserVersion` to the actual non-empty pipeline version (initially `qcs-extract-v1`) and return foundation `ExtractedEvidence`, retaining locators, field paths, extraction limits and coverage errors. Foundation injects `extractEnvelope` before staging and stores facts in version metadata, passages separately; workflow promotes facts to reviewed claims. Unsupported/scanned formats return explicit incomplete coverage and a permitted manual passage path, never silent empty success.
- [ ] Relationship creation requires subject/object kinds, predicate, evidence passage/version, confidence, valid dates and reviewer. Store solicitor/expert engagement as observed participation; do not infer permanent conflict, corporate liability, project membership or debt liability from group/name matches.
- [ ] Add tests for exact CH match, conflicting schemes, aliases, shared address, copied events, source withdrawal, quotation mismatch, malicious instructions and facts without locators. Verify cancellation propagates and no static client object enters dispatch. Repeat focused tests, review and checkpoint.

## Phase D: cross-plan acceptance and handoff

- [ ] Wire foundation runner `prepareSourceJob`, `getConnector(source.provider,preparedPayload)` and `extractEnvelope`; registry validates `preparedPayload.selection` for its provider, while stored checkpoints use source/scope. No writes occur after a superseded lease or failed parse.
- [ ] Run all source unit tests with `corepack pnpm --config.verify-deps-before-run=false exec node node_modules/vitest/vitest.mjs run src/lib/research`; run isolated-DB current-version/withdrawal/search tests using the foundation test database configuration.
- [ ] Run `corepack pnpm --config.verify-deps-before-run=false exec tsc --noEmit`; separately report the pre-existing clientDomainId fixture mismatch, if still present, without suppressing new source errors. Do not run the migration-bearing build.
- [ ] Perform a director-only acceptance investigation: company identity, both procurement providers, payment periods, permitted Gazette/import, full case-law search/read/comparison, listing import, BSR aggregate, project/issuer record, commercial import and ambiguous-entity review. Every displayed fact must resolve to an active passage or structured field.
- [ ] Demonstrate unavailable provider isolation, 429 retry without withdrawal, corrupt-page checkpoint preservation, correction propagation, deleted judgment purge, missing-coverage display and cancellation. Compare no dependent reports against removed passages.
- [ ] Review new dependency versions, XML/ZIP/PDF budgets, fixture permissions and byte hashes. Genuine source payloads are recorded with URL, retrieval time and source rights; generated test data remains clearly synthetic and contains no factual allegation about a business.
- [ ] Update `docs/research/provider-contracts.md` with verified runtime contracts, access modes, dates, quotas, scopes and remaining import/manual paths. Mark an adapter ready only after its own contract tests pass; distinguish implemented import from unavailable vendor API.
- [ ] Hand service signatures and evidence types to the director-workflow plan. Complete a code review and implementation checkpoint commit only during approved execution; publication, purchasing, deployment and outreach remain separate actions.
