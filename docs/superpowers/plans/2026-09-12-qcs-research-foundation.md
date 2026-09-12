# QCS Research Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide director-only, source-traceable QCS research storage, safe acquisition and durable jobs inside the existing portal.

**Architecture:** Use the existing Neon HTTP driver, Drizzle schema and shared S3 bucket. Lease and page-commit operations execute as complete SQL statements or database functions, so database locks never need to survive an HTTP round trip. Provider adapters and director intelligence consume the interfaces below through the companion plans.

**Tech Stack:** TypeScript, Next.js 15, Clerk, Drizzle/Postgres, Neon HTTP, AWS S3, Node HTTPS/DNS, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-12-qcs-research-design.md`, particularly sections 4, 7, 8 and 11.

## Global constraints

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

This is a proposed plan for design approval. Execute no production-code changes, migrations, commits or deployment as part of preparing it. The existing baseline is 411 passing tests; TypeScript has existing `clientDomainId` fixture mismatches; source ESLint has zero errors and seven warnings. Re-establish that baseline during execution and report unrelated failures separately.

## Files and integration boundaries

Create `src/lib/research/{contracts,errors,roles,safe-fetch,evidence,runner,dispatch}.ts`, `src/lib/db/{research-schema,research}.ts`, `src/app/api/internal/research/route.ts` and their colocated tests. Modify only the necessary exports in `src/lib/db/schema.ts`, existing portal gates in `src/lib/portal/auth.ts`, director filtering in `src/lib/portal/directors.ts`, `src/middleware.ts` and each portal page loader. Do not restructure unrelated code.

Generate `drizzle/0003_qcs_research_foundation.sql` and matching metadata only if 0003 remains unused; if client-domain work has occupied that number, regenerate under the next free number without renaming anyone else's migration. This foundation owns sources, rights, entities, identifiers, investigations, runs, documents, versions, passages, jobs, checkpoints, reviews, invalidations, budgets and model reservations. The workflow plan owns relationships, claims, signals, watches, calendars, reports, suppressions and outcomes.

Every test command below uses `corepack pnpm --config.verify-deps-before-run=false exec node node_modules/vitest/vitest.mjs run FILE`. SQL integration tests require `RESEARCH_TEST_DATABASE_URL` for an isolated disposable database and must reject equality with `DATABASE_URL` before opening a connection.

### Task 1: Establish contracts and schema

**Files:** create `src/lib/research/contracts.ts`, `src/lib/db/research-schema.ts`, `src/lib/db/research-schema.test.ts`; modify `src/lib/db/schema.ts` by appending `export * from "./research-schema";` only.

**Interfaces:** adapters consume the following exact contracts. Extra evidence types describe the parser output; source-specific facts remain observations until the workflow verifier handles them.

- [ ] Add the contracts without changing the agreed field names:

```ts
export const QCS_WORKSPACE_ID = "51435300-0000-4000-8000-000000000001";
export type SourceRecord = { id:string; provider:string; hosts:string[]; status:"ready"|"unavailable"|"paused"; credentialRef:string|null };
export type SourceEnvelope = { sourceId:string; providerId:string; url:string; retrievedAt:string; publishedAt:string|null; updatedAt:string|null; eventAt:string|null; contentType:string; body:Uint8Array; metadata:Record<string,unknown> };
export type ConnectorContext = { source:SourceRecord; cursor:string|null; window:{from:string;to:string}; signal:AbortSignal };
export type ConnectorPage = { records:SourceEnvelope[]; nextCursor:string|null; coverage:{complete:boolean;notes:string[]} };
export type SourceConnector = { provider:string; fetchPage(context:ConnectorContext):Promise<ConnectorPage> };
export type Locator = { kind:"paragraph"|"page"|"field"; value:string };
export type ExtractedEvidence = { passages:{locator:Locator;text:string}[]; facts:{predicate:string;value:unknown;locator:Locator;status:"observation"|"allegation"|"inference"}[]; coverage:{complete:boolean;notes:string[]} };
export type StagedRecord = Omit<SourceEnvelope,"body"> & { hash:string; objectKey:string; parserVersion:string; passages:{locator:Locator;text:string;hash:string}[] };
export type Lease = { id:string; sourceId:string; scopeKey:string; runId:string; payload:Record<string,unknown>; cursor:string|null; leaseToken:number; revision:number; attempts:number };
```

- [ ] Write the schema test and run it, expecting module-not-found before implementation:

```ts
import { describe,it,expect } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as s from "./research-schema";
describe("research schema",()=>{ it("scopes evidence and separates client documents",()=>{
  expect(getTableConfig(s.researchVersions).columns.map(c=>c.name)).toContain("workspace_id");
  expect(getTableConfig(s.researchDocuments).name).toBe("research_documents");
  expect(getTableConfig(s.researchJobs).indexes.map(i=>i.config.name)).toContain("research_one_active_scope");
}); });
```

- [ ] Implement the schema below. Add the index and FK declarations specified after it in the same migration; do not replace existing upload tables.

```ts
import { pgTable,uuid,text,jsonb,timestamp,integer,bigint,boolean,index,uniqueIndex,customType } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { QCS_WORKSPACE_ID } from "@/lib/research/contracts";
const base=()=>({id:uuid("id").primaryKey().defaultRandom(),workspaceId:uuid("workspace_id").notNull().default(QCS_WORKSPACE_ID),createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow()});
const time=(name:string)=>timestamp(name,{withTimezone:true});
const vector=customType<{data:string}>({dataType:()=>"tsvector"});
export const researchRights=pgTable("research_rights",{...base(),holder:text("holder").notNull(),material:text("material").notNull(),purpose:text("purpose").notNull(),agreementRef:text("agreement_ref").notNull(),agreementHash:text("agreement_hash").notNull(),effectiveAt:time("effective_at").notNull(),expiresAt:time("expires_at"),transferConditions:jsonb("transfer_conditions").notNull(),retentionInstructions:jsonb("retention_instructions").notNull(),withdrawalInstructions:jsonb("withdrawal_instructions").notNull(),useAssessment:text("use_assessment").notNull()});
export const researchSources=pgTable("research_sources",{...base(),label:text("label").notNull(),provider:text("provider").notNull(),hosts:jsonb("hosts").$type<string[]>().notNull(),accessMethod:text("access_method").notNull(),termsUrl:text("terms_url").notNull(),termsVersion:text("terms_version").notNull(),termsReviewedAt:time("terms_reviewed_at").notNull(),attribution:text("attribution").notNull(),operator:text("operator").notNull(),purpose:text("purpose").notNull(),rightsId:uuid("rights_id").notNull().references(()=>researchRights.id),credentialRef:text("credential_ref"),status:text("status").notNull().default("unavailable"),cadenceSeconds:integer("cadence_seconds").notNull(),freshnessSeconds:integer("freshness_seconds").notNull(),lastSuccessAt:time("last_success_at"),nextDueAt:time("next_due_at").notNull().defaultNow(),requestLimit:integer("request_limit").notNull(),windowSeconds:integer("window_seconds").notNull(),dailyRequests:integer("daily_requests").notNull(),dailyTokens:bigint("daily_tokens",{mode:"number"}).notNull(),dailyPence:integer("daily_pence").notNull()});
export const researchEntities=pgTable("research_entities",{...base(),kind:text("kind").notNull(),displayName:text("display_name").notNull(),jurisdiction:text("jurisdiction"),confirmed:boolean("confirmed").notNull().default(false)});
export const researchIdentifiers=pgTable("research_identifiers",{...base(),entityId:uuid("entity_id").notNull().references(()=>researchEntities.id),scheme:text("scheme").notNull(),value:text("value").notNull(),sourceId:uuid("source_id").notNull().references(()=>researchSources.id),verified:boolean("verified").notNull().default(false)});
export const researchInvestigations=pgTable("research_investigations",{...base(),question:text("question").notNull(),scope:jsonb("scope").notNull(),owner:text("owner").notNull(),status:text("status").notNull().default("draft"),budget:jsonb("budget").notNull(),latestCompletedRunId:uuid("latest_completed_run_id")});
export const researchRuns=pgTable("research_runs",{...base(),investigationId:uuid("investigation_id").references(()=>researchInvestigations.id),sourceSelection:jsonb("source_selection").notNull(),status:text("status").notNull().default("queued"),startedAt:time("started_at"),finishedAt:time("finished_at"),versions:jsonb("versions").notNull(),reservedPence:integer("reserved_pence").notNull().default(0),actualPence:integer("actual_pence").notNull().default(0),actualTokens:bigint("actual_tokens",{mode:"number"}).notNull().default(0),coverage:jsonb("coverage").notNull().default({}),errorSummary:text("error_summary")});
export const researchDocuments=pgTable("research_documents",{...base(),sourceId:uuid("source_id").notNull().references(()=>researchSources.id),providerId:text("provider_id").notNull(),currentVersionId:uuid("current_version_id"),canonicalUrl:text("canonical_url").notNull(),status:text("status").notNull().default("available"),availabilityCheckedAt:time("availability_checked_at").notNull()},t=>[uniqueIndex("research_document_identity").on(t.workspaceId,t.sourceId,t.providerId)]);
export const researchVersions=pgTable("research_versions",{...base(),documentId:uuid("document_id").notNull().references(()=>researchDocuments.id),hash:text("hash").notNull(),sourceUpdatedAt:time("source_updated_at"),retrievedAt:time("retrieved_at").notNull(),eventAt:time("event_at"),publishedAt:time("published_at"),objectKey:text("object_key"),contentType:text("content_type").notNull(),availability:text("availability").notNull().default("available"),parserVersion:text("parser_version").notNull(),metadata:jsonb("metadata").notNull()},t=>[index("research_version_hash").on(t.documentId,t.hash)]);
export const researchPassages=pgTable("research_passages",{...base(),versionId:uuid("version_id").notNull().references(()=>researchVersions.id),locator:jsonb("locator").notNull(),text:text("text").notNull(),hash:text("hash").notNull(),search:vector("search").generatedAlwaysAs(sql`to_tsvector('english', text)`)},t=>[index("research_passage_search").using("gin",t.search),uniqueIndex("research_passage_identity").on(t.versionId,t.hash)]);
export const researchJobs=pgTable("research_jobs",{...base(),type:text("type").notNull(),sourceId:uuid("source_id").notNull().references(()=>researchSources.id),scopeKey:text("scope_key").notNull(),runId:uuid("run_id").notNull().references(()=>researchRuns.id),dedupeKey:text("dedupe_key").notNull().unique(),payload:jsonb("payload").notNull(),status:text("status").notNull().default("queued"),cursor:text("cursor"),attempts:integer("attempts").notNull().default(0),nextAttemptAt:time("next_attempt_at").notNull().defaultNow(),leaseOwner:text("lease_owner"),leaseToken:bigint("lease_token",{mode:"number"}).notNull().default(0),leaseExpiresAt:time("lease_expires_at"),cancelledAt:time("cancelled_at"),errorCode:text("error_code")},t=>[uniqueIndex("research_one_active_scope").on(t.workspaceId,t.sourceId,t.scopeKey).where(sql`status in ('queued','running','retry')`),index("research_jobs_due").on(t.status,t.nextAttemptAt)]);
export const researchCheckpoints=pgTable("research_checkpoints",{...base(),sourceId:uuid("source_id").notNull().references(()=>researchSources.id),scopeKey:text("scope_key").notNull(),cursor:text("cursor"),watermarkAt:time("watermark_at"),revision:bigint("revision",{mode:"number"}).notNull().default(0)},t=>[uniqueIndex("research_checkpoint_scope").on(t.workspaceId,t.sourceId,t.scopeKey)]);
export const researchReviews=pgTable("research_reviews",{...base(),actor:text("actor").notNull(),action:text("action").notNull(),target:uuid("target").notNull(),reason:text("reason").notNull(),references:jsonb("references").notNull()});
export const researchInvalidations=pgTable("research_invalidations",{...base(),documentId:uuid("document_id").notNull().references(()=>researchDocuments.id),versionId:uuid("version_id").notNull().references(()=>researchVersions.id),reason:text("reason").notNull(),status:text("status").notNull().default("pending"),attempts:integer("attempts").notNull().default(0)},t=>[uniqueIndex("research_invalidation_version").on(t.versionId)]);
```

- [ ] Add SQL FKs from document current-version to version and investigation latest-run to run after both tables exist. Add checks restricting source status to `ready/unavailable/paused`, lease tokens to non-negative values, cadence/freshness/window/request limit to positive integers and budget values to non-negative integers. Add uniqueness `(workspace_id,scheme,value)` on verified identifiers only for `uk-company-number`, `lei` and `ocid`; no universal name or identifier uniqueness.
- [ ] Add source polling selection as `selection:jsonb("selection").$type<Record<string,unknown>>().notNull().default({})` and expose an optional `selection:z.record(z.string(),z.unknown()).default({})` in `sourceRegistration`. This stores company/query/import parameters for scheduled source jobs; provider-specific Zod schemas validate them before enqueueing. Add `updated_at` indexes on the source, entity, document and investigation tables for freshness and list queries.
- [ ] Generate and inspect the migration diff, preserving the dirty client-domain additions. Run the schema test. Do not apply the migration to the connected application database.

### Task 2: Atomic leasing, evidence commit and cursor advancement

**Files:** create `src/lib/db/research.ts`, `src/lib/db/research.integration.test.ts`; append SQL functions to the foundation migration.

**Interfaces:** `leaseResearchJob(owner:string):Promise<Lease|null>`; `commitResearchPage(input:{jobId:string;leaseToken:number;page:ConnectorPage;records:StagedRecord[];expectedRevision:number}):Promise<boolean>`; `cancelResearchRun(runId:string):Promise<void>`.

- [ ] Add the integration test first. Apply the inspected migrations only to the explicit disposable test URL; use the same Neon HTTP adapter as production.

```ts
import { neon } from "@neondatabase/serverless";
import { it,expect,beforeEach } from "vitest";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { createResearchRepository } from "./research";
const testUrl=process.env.RESEARCH_TEST_DATABASE_URL;
if(!testUrl||testUrl===process.env.DATABASE_URL)throw new Error("isolated_research_test_database_required");
const testSql=neon(testUrl);
const {leaseResearchJob,commitResearchPage,cancelResearchRun}=createResearchRepository(drizzle(testSql,{schema}));
beforeEach(async()=>{
 await testSql`truncate research_rights cascade`;
 await testSql`insert into research_rights(id,holder,material,purpose,agreement_ref,agreement_hash,effective_at,transfer_conditions,retention_instructions,withdrawal_instructions,use_assessment) values('00000000-0000-4000-8000-000000000001','QCS','fixture','test','fixture','fixture',now()-interval '1 day','{}','{}','{}','test')`;
 await testSql`insert into research_sources(id,label,provider,hosts,access_method,terms_url,terms_version,terms_reviewed_at,attribution,operator,purpose,rights_id,status,cadence_seconds,freshness_seconds,request_limit,window_seconds,daily_requests,daily_tokens,daily_pence) values('00000000-0000-4000-8000-000000000002','fixture','fixture','["example.com"]','public','https://example.com/terms','fixture',now(),'fixture','QCS','test','00000000-0000-4000-8000-000000000001','ready',60,3600,10,300,100,10000,1000)`;
 await testSql`insert into research_runs(id,source_selection,versions) values('00000000-0000-4000-8000-000000000003','[]','{}')`;
 await testSql`insert into research_checkpoints(source_id,scope_key) values('00000000-0000-4000-8000-000000000002','test')`;
 await testSql`insert into research_jobs(type,source_id,scope_key,run_id,dedupe_key,payload) values('fetch','00000000-0000-4000-8000-000000000002','test','00000000-0000-4000-8000-000000000003','test','{}')`;
});
it("allows one lease, rejects a stale writer and rolls back a bad page",async()=>{
  const leases=await Promise.all([leaseResearchJob("worker-a"),leaseResearchJob("worker-b")]);
  expect(leases.filter(Boolean)).toHaveLength(1);
  const job=leases.find(Boolean)!;
  const before=await testSql`select revision from research_checkpoints where source_id=${job.sourceId}`;
  expect(await commitResearchPage({jobId:job.id,leaseToken:job.leaseToken+1,page:{records:[],nextCursor:"bad",coverage:{complete:true,notes:[]}},records:[],expectedRevision:job.revision})).toBe(false);
  expect(await testSql`select revision from research_checkpoints where source_id=${job.sourceId}`).toEqual(before);
  await cancelResearchRun(job.runId);
  expect(await commitResearchPage({jobId:job.id,leaseToken:job.leaseToken,page:{records:[],nextCursor:null,coverage:{complete:true,notes:[]}},records:[],expectedRevision:job.revision})).toBe(false);
});
```

- [ ] Implement lease acquisition as one statement. The short `SKIP LOCKED` lock is wholly inside the statement, not held between HTTP calls. Expired leases are eligible; each acquisition increases the fencing token.

```sql
WITH candidate AS (
 SELECT j.id FROM research_jobs j JOIN research_sources s ON s.id=j.source_id JOIN research_rights r ON r.id=s.rights_id
 WHERE j.cancelled_at IS NULL AND j.attempts<5 AND s.status='ready'
 AND r.effective_at<=now() AND (r.expires_at IS NULL OR r.expires_at>now())
 AND ((j.status IN ('queued','retry') AND j.next_attempt_at<=now()) OR (j.status='running' AND j.lease_expires_at<now()))
 ORDER BY j.next_attempt_at,j.id FOR UPDATE OF j SKIP LOCKED LIMIT 1
), leased AS (
 UPDATE research_jobs j SET status='running',lease_owner=$1,lease_token=j.lease_token+1,
 lease_expires_at=now()+interval '120 seconds',attempts=j.attempts+1,updated_at=now()
 FROM candidate c WHERE j.id=c.id RETURNING j.*
) SELECT l.*,c.revision FROM leased l JOIN research_checkpoints c ON c.source_id=l.source_id AND c.scope_key=l.scope_key;
```

- [ ] Implement page commit as a database function. JSON records are the staged records from Task 6. Its exception path rolls back all evidence, invalidations and checkpoint changes together.

```sql
CREATE FUNCTION research_commit_page(p_job uuid,p_token bigint,p_revision bigint,p_records jsonb,p_cursor text,p_coverage jsonb) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE j research_jobs; c research_checkpoints; r jsonb; p jsonb; d uuid; v uuid; old_v uuid; old_time timestamptz; doc research_documents;
BEGIN
 SELECT * INTO j FROM research_jobs WHERE id=p_job FOR UPDATE;
 IF NOT FOUND OR j.status<>'running' OR j.cancelled_at IS NOT NULL OR j.lease_token<>p_token OR j.lease_expires_at<=now() THEN RETURN false; END IF;
 SELECT * INTO c FROM research_checkpoints WHERE source_id=j.source_id AND scope_key=j.scope_key FOR UPDATE;
 IF NOT FOUND OR c.revision<>p_revision THEN RETURN false; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p_records) LOOP
  IF (r->>'sourceId')::uuid<>j.source_id THEN RAISE EXCEPTION 'source_mismatch'; END IF;
  INSERT INTO research_documents(source_id,provider_id,canonical_url,availability_checked_at) VALUES(j.source_id,r->>'providerId',r->>'url',now())
  ON CONFLICT(workspace_id,source_id,provider_id) DO UPDATE SET canonical_url=excluded.canonical_url,availability_checked_at=now() RETURNING id,current_version_id INTO d,old_v;
  SELECT * INTO doc FROM research_documents WHERE id=d;
  IF doc.status='withdrawn' AND NOT EXISTS(SELECT 1 FROM research_reviews WHERE target=d AND action='reinstate' AND created_at>doc.updated_at) THEN CONTINUE; END IF;
  SELECT source_updated_at INTO old_time FROM research_versions WHERE id=old_v;
  IF old_time IS NOT NULL AND (r->>'updatedAt')::timestamptz<old_time THEN CONTINUE; END IF;
  SELECT id INTO v FROM research_versions WHERE id=old_v AND hash=r->>'hash' AND parser_version=r->>'parserVersion' AND metadata=r->'metadata' AND availability='available';
  IF v IS NULL THEN
   INSERT INTO research_versions(document_id,hash,source_updated_at,retrieved_at,event_at,published_at,object_key,content_type,parser_version,metadata)
   VALUES(d,r->>'hash',(r->>'updatedAt')::timestamptz,(r->>'retrievedAt')::timestamptz,(r->>'eventAt')::timestamptz,(r->>'publishedAt')::timestamptz,r->>'objectKey',r->>'contentType',r->>'parserVersion',r->'metadata') RETURNING id INTO v;
  ELSE UPDATE research_versions SET retrieved_at=(r->>'retrievedAt')::timestamptz,source_updated_at=coalesce((r->>'updatedAt')::timestamptz,source_updated_at),metadata=metadata||(r->'metadata') WHERE id=v;
  END IF;
  IF old_v IS DISTINCT FROM v AND old_v IS NOT NULL THEN
   UPDATE research_versions SET availability='superseded' WHERE id=old_v;
   UPDATE research_passages SET text='' WHERE version_id=old_v;
   INSERT INTO research_invalidations(document_id,version_id,reason) VALUES(d,old_v,'replaced') ON CONFLICT(version_id) DO NOTHING;
  END IF;
  UPDATE research_documents SET current_version_id=v,status='available',updated_at=now() WHERE id=d;
  FOR p IN SELECT value FROM jsonb_array_elements(r->'passages') LOOP
   INSERT INTO research_passages(version_id,locator,text,hash) VALUES(v,p->'locator',p->>'text',p->>'hash') ON CONFLICT(version_id,hash) DO NOTHING;
  END LOOP;
 END LOOP;
 UPDATE research_checkpoints SET cursor=p_cursor,watermark_at=CASE WHEN p_cursor IS NULL AND (p_coverage->>'complete')::boolean THEN (j.payload->'window'->>'to')::timestamptz ELSE watermark_at END,revision=revision+1,updated_at=now() WHERE id=c.id;
 UPDATE research_jobs SET cursor=p_cursor,status=CASE WHEN p_cursor IS NULL THEN 'complete' ELSE 'queued' END,attempts=0,lease_owner=NULL,lease_expires_at=NULL,updated_at=now() WHERE id=j.id;
 UPDATE research_runs SET coverage=coverage||jsonb_build_object(j.source_id::text,p_coverage),status='running' WHERE id=j.run_id;
 IF NOT EXISTS(SELECT 1 FROM research_jobs WHERE run_id=j.run_id AND status<>'complete') THEN
  UPDATE research_runs SET status='complete',finished_at=now() WHERE id=j.run_id;
  UPDATE research_investigations SET latest_completed_run_id=j.run_id,updated_at=now() WHERE id=(SELECT investigation_id FROM research_runs WHERE id=j.run_id);
 END IF;
 IF p_cursor IS NULL AND (p_coverage->>'complete')::boolean THEN UPDATE research_sources SET last_success_at=now() WHERE id=j.source_id; END IF;
 RETURN true;
END $$;
```

- [ ] Put statements in a `createResearchRepository(db:ReturnType<typeof requireDb>)` factory and export production methods from `createResearchRepository(requireDb())` lazily at call time. Tests bind `drizzle(neon(testUrl))` directly to that factory. Map database snake-case lease fields explicitly into `Lease`, converting token/revision to numbers. Page commit uses `db.execute(sql\`select research_commit_page(${input.jobId}::uuid,${input.leaseToken},${input.expectedRevision},${JSON.stringify(input.records)}::jsonb,${input.page.nextCursor},${JSON.stringify(input.page.coverage)}::jsonb) as committed\`)`. Return `rows[0].committed===true`. Cancellation uses one `WITH cancelled AS (UPDATE research_jobs SET cancelled_at=now(),status='cancelled',lease_token=lease_token+1 WHERE run_id=$1 RETURNING id) UPDATE research_runs SET status='cancelled',finished_at=now() WHERE id=$1` statement.
- [ ] Extend the test with a valid staged record followed by an invalid UUID and assert no document and no cursor survive; replay one valid page and assert one document/version; expire the lease, reacquire and assert the former token cannot commit. Run the isolated integration file and schema test.

### Task 3: Director isolation and source registration

**Files:** create `src/lib/research/roles.ts`, `src/lib/research/roles.test.ts`; modify portal auth, middleware, directors and portal page loaders; extend `src/lib/db/research.ts`.

**Interfaces:** `readResearchActor(userId:string):Promise<{userId:string;role:"director"|"client"|"unknown"}>`; `requireResearchDirector():Promise<string>`; `registerSource(input:SourceRegistration):Promise<SourceRecord>`; `createInvestigation(input:{question:string;scope:Record<string,unknown>;budget:Record<string,number>}):Promise<string>`.

- [ ] Write a mocked Clerk test rejecting `role="client"`, missing metadata and a backend timeout; accept only an explicit `publicMetadata.role="director"`. Run `src/lib/research/roles.test.ts`, expecting missing-module failure first.
- [ ] Implement the gate and reuse it in existing portal route/action gates. Middleware calls `readResearchActor` with its own authenticated user ID; clients redirect to `/client`, unknown roles receive 403, lookup outages receive 503. Page loaders call `requireResearchDirector` before querying any data; return their established setup notice only when Clerk itself is unconfigured.

```ts
import { auth,clerkClient } from "@clerk/nextjs/server";
export async function readResearchActor(userId:string){
 const client=await clerkClient(); let timer:ReturnType<typeof setTimeout>|undefined;
 const user=await Promise.race([client.users.getUser(userId),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error("actor_unavailable")),8000);})]).finally(()=>clearTimeout(timer));
 const role=user.publicMetadata.role;
 return {userId,role:role==="director"||role==="client"?role:"unknown" as const};
}
export async function requireResearchDirector(){const {userId}=await auth();if(!userId)throw new Error("unauthenticated");if((await readResearchActor(userId)).role!=="director")throw new Error("forbidden");return userId;}
```

- [ ] Filter `listDirectors` by explicit director metadata before mapping, and paginate Clerk users until `totalCount` is covered. Existing invited directors need explicit metadata assigned through the existing Clerk administration before enabling this gate; never infer their role from client absence or a domain.
- [ ] Implement the source registration boundary with Zod, using the schema's insert object, and keep secrets out of input and output:

```ts
import { z } from "zod";
export const sourceRegistration=z.object({label:z.string().min(1),provider:z.string().min(1),hosts:z.array(z.string().regex(/^[a-z0-9.-]+$/)).min(1),accessMethod:z.string().min(1),termsUrl:z.url(),termsVersion:z.string().min(1),termsReviewedAt:z.iso.datetime(),attribution:z.string().min(1),operator:z.literal("QCS"),purpose:z.string().min(1),rightsId:z.uuid(),credentialRef:z.string().regex(/^RESEARCH_[A-Z0-9_]+$/).nullable(),status:z.enum(["ready","unavailable","paused"]),cadenceSeconds:z.number().int().positive(),freshnessSeconds:z.number().int().positive(),requestLimit:z.number().int().positive(),windowSeconds:z.number().int().positive(),dailyRequests:z.number().int().nonnegative(),dailyTokens:z.number().int().nonnegative(),dailyPence:z.number().int().nonnegative()}).strict();
export type SourceRegistration=z.infer<typeof sourceRegistration>;
```

- [ ] `registerSource` calls `requireResearchDirector`, parses input, verifies the rights row is in the QCS workspace and effective, stores the row plus a review in one `db.batch`, and returns only the five `SourceRecord` fields. An absent referenced environment variable forces `unavailable`. `createInvestigation` obtains the owner from the same gate and returns its UUID. Test a submitted secret-value field fails strict validation, expired rights reject registration, and a missing credential produces `unavailable` without logging the reference's value.

### Task 4: Safe fetch with connection-time DNS validation

**Files:** create `src/lib/research/errors.ts`, `src/lib/research/safe-fetch.ts`, `src/lib/research/safe-fetch.test.ts`.

**Interfaces:** exact `safeFetch(url:string,options:{source:SourceRecord;signal:AbortSignal;maxBytes:number}):Promise<{url:string;contentType:string;body:Uint8Array;status:number}>`; `registerProviderHeaders(provider:string,headers:(secret:string)=>Record<string,string>):void` for adapter-owned authentication.

- [ ] Test redirect-to-loopback, DNS-to-private-address, oversized streamed body, aborted request, URL credentials and cross-host authentication stripping using injected DNS and HTTPS mocks. Assert no network connection occurs after a rejected address. Run the file expecting missing implementation first.
- [ ] Add `ResearchFetchError` with public `code:string`, `status:number|null`, `retryAfterMs:number|null`; it never stores a response body or secret-bearing URL. Implement fetch using Node's HTTPS request and a pinned lookup result, not a DNS precheck followed by ordinary `fetch`:

```ts
export class ResearchFetchError extends Error { constructor(public code:string,public status:number|null,public retryAfterMs:number|null){super(code);this.name="ResearchFetchError";} }
```

```ts
import { request } from "node:https";
import { lookup } from "node:dns/promises";
import { BlockList,isIP } from "node:net";
import { reserveSourceRequest } from "@/lib/db/research";
import type { SourceRecord } from "./contracts";
import { ResearchFetchError } from "./errors";
const deny=new BlockList();
for(const [ip,bits] of [["0.0.0.0",8],["10.0.0.0",8],["100.64.0.0",10],["127.0.0.0",8],["169.254.0.0",16],["172.16.0.0",12],["192.0.0.0",24],["192.0.2.0",24],["192.168.0.0",16],["198.18.0.0",15],["198.51.100.0",24],["203.0.113.0",24],["224.0.0.0",4],["240.0.0.0",4]] as const)deny.addSubnet(ip,bits,"ipv4");
for(const [ip,bits] of [["2001:db8::",32],["2001::",32],["2002::",16]] as const)deny.addSubnet(ip,bits,"ipv6");
export function publicAddress(ip:string){if(isIP(ip)===4)return !deny.check(ip,"ipv4");return isIP(ip)===6&&/^[23][0-9a-f]{3}:/i.test(ip)&&!deny.check(ip,"ipv6");}
const headersByProvider=new Map<string,(secret:string)=>Record<string,string>>();
export function registerProviderHeaders(provider:string,headers:(secret:string)=>Record<string,string>){headersByProvider.set(provider,headers);}
export async function safeFetch(value:string,options:{source:SourceRecord;signal:AbortSignal;maxBytes:number}){
 const signal=AbortSignal.any([options.signal,AbortSignal.timeout(20000)]); const initial=new URL(value).hostname;
 if(options.source.status!=="ready")throw new ResearchFetchError("source_unavailable",null,null);
 for(let redirects=0;redirects<=3;redirects++){
  const url=new URL(value);if(url.protocol!=="https:"||url.username||url.password||(url.port&&url.port!=="443")||!options.source.hosts.includes(url.hostname))throw new ResearchFetchError("url_blocked",null,null);
  const addresses=await lookup(url.hostname,{all:true});if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw new ResearchFetchError("address_blocked",null,null);
  signal.throwIfAborted();await reserveSourceRequest(options.source.id);const pinned=addresses[0];
  const ref=options.source.credentialRef;const secret=ref?process.env[ref]:undefined;
  if(ref&&!secret)throw new ResearchFetchError("credential_missing",401,null);
  const headers=url.hostname===initial&&secret?headersByProvider.get(options.source.provider)?.(secret):{};
  if(secret&&url.hostname===initial&&!headers)throw new ResearchFetchError("auth_adapter_missing",401,null);
  const result=await new Promise<{status:number;location?:string;contentType:string;body:Uint8Array;retry:string|undefined}>((resolve,reject)=>{
   const req=request(url,{agent:false,autoSelectFamily:false,signal,headers,lookup:((_host:unknown,_opts:unknown,cb:(error:Error|null,address:string,family:number)=>void)=>cb(null,pinned.address,pinned.family)) as never},res=>{
    let size=0;const chunks:Buffer[]=[];res.on("data",(chunk:Buffer)=>{size+=chunk.length;if(size>options.maxBytes){res.destroy(new ResearchFetchError("body_too_large",res.statusCode??null,null));return;}chunks.push(chunk);});
    res.on("error",reject);res.on("end",()=>resolve({status:res.statusCode??502,location:res.headers.location,contentType:res.headers["content-type"]??"application/octet-stream",body:Buffer.concat(chunks),retry:res.headers["retry-after"]}));
   });req.on("error",reject);req.end();
  });
  if([301,302,303,307,308].includes(result.status)&&result.location){value=new URL(result.location,url).href;continue;}
  if(result.status>=400&&![404,410].includes(result.status)){const retry=result.retry?Math.max(0,/^\d+$/.test(result.retry)?Number(result.retry)*1000:Date.parse(result.retry)-Date.now()):null;throw new ResearchFetchError("http_failure",result.status,Number.isFinite(retry)?retry:null);}
  return {url:url.href,contentType:result.contentType,body:result.body,status:result.status};
 }throw new ResearchFetchError("redirect_limit",null,null);
}
```

- [ ] Add checks for positive finite `maxBytes` with a 32 MB absolute ceiling, reject compressed responses unless a separately bounded decompressor is introduced, and clear credentials permanently after a cross-host redirect. Resolve DNS using a race against the same abort signal so DNS stalls cannot exceed the request budget. Source XML parsers must reject `DOCTYPE` and `ENTITY`; reader HTML must be sanitised in the sources plan. Run the fetch tests with mocked transport only.

### Task 5: Shared request and model budgets

**Files:** extend the foundation migration, `research-schema.ts`, `research.ts`; create `src/lib/db/research-budget.integration.test.ts`.

**Interfaces:** `reserveSourceRequest(sourceId:string):Promise<void>`; `reserveResearchModel(input:{sourceId:string;runId:string;tokens:number;pence:number}):Promise<string>`; `settleResearchModel(id:string,usage:{tokens:number;pence:number}|null):Promise<void>`. A null usage result retains the full reservation conservatively.

- [ ] Add operational tables and atomic reservation SQL. Every row carries the QCS workspace UUID. Mirror these definitions with Drizzle `pgTable` exports using the existing `base()` helper.

```sql
CREATE TABLE research_budget_days(workspace_id uuid NOT NULL DEFAULT '51435300-0000-4000-8000-000000000001',source_id uuid REFERENCES research_sources(id),day date NOT NULL,requests bigint NOT NULL DEFAULT 0,tokens bigint NOT NULL DEFAULT 0,pence bigint NOT NULL DEFAULT 0,PRIMARY KEY(source_id,day));
CREATE TABLE research_request_reservations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL DEFAULT '51435300-0000-4000-8000-000000000001',source_id uuid NOT NULL REFERENCES research_sources(id),run_id uuid NOT NULL REFERENCES research_runs(id),reserved_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX research_request_window ON research_request_reservations(source_id,reserved_at);
CREATE TABLE research_model_reservations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL DEFAULT '51435300-0000-4000-8000-000000000001',source_id uuid NOT NULL REFERENCES research_sources(id),run_id uuid NOT NULL REFERENCES research_runs(id),day date NOT NULL,tokens bigint NOT NULL,pence bigint NOT NULL,actual_tokens bigint,actual_pence bigint,status text NOT NULL DEFAULT 'reserved',expires_at timestamptz NOT NULL DEFAULT now()+interval '120 seconds');
CREATE FUNCTION research_reserve_request(p_source uuid,p_run uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE s research_sources; b research_budget_days; request_cap bigint;
BEGIN
 SELECT * INTO s FROM research_sources WHERE id=p_source FOR UPDATE;
 IF NOT FOUND OR s.status<>'ready' THEN RAISE EXCEPTION 'source_unavailable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM research_rights WHERE id=s.rights_id AND effective_at<=now() AND (expires_at IS NULL OR expires_at>now())) THEN RAISE EXCEPTION 'rights_unavailable'; END IF;
 IF (SELECT count(*) FROM research_request_reservations WHERE source_id=p_source AND reserved_at>now()-make_interval(secs=>s.window_seconds))>=s.request_limit THEN RAISE EXCEPTION 'source_rate_limit'; END IF;
 PERFORM 1 FROM research_runs WHERE id=p_run AND status IN ('queued','running') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'run_unavailable'; END IF;
 SELECT coalesce((i.budget->>'maxRequests')::bigint,s.daily_requests) INTO request_cap FROM research_runs r LEFT JOIN research_investigations i ON i.id=r.investigation_id WHERE r.id=p_run;
 IF (SELECT count(*) FROM research_request_reservations WHERE run_id=p_run)>=request_cap THEN RAISE EXCEPTION 'run_request_budget'; END IF;
 INSERT INTO research_budget_days(source_id,day) VALUES(p_source,(now() AT TIME ZONE 'UTC')::date) ON CONFLICT DO NOTHING;
 SELECT * INTO b FROM research_budget_days WHERE source_id=p_source AND day=(now() AT TIME ZONE 'UTC')::date FOR UPDATE;
 IF b.requests>=s.daily_requests THEN RAISE EXCEPTION 'daily_request_budget'; END IF;
 INSERT INTO research_request_reservations(source_id,run_id) VALUES(p_source,p_run);
 UPDATE research_budget_days SET requests=requests+1 WHERE source_id=p_source AND day=b.day;
END $$;
```

- [ ] Implement model reservation in a SQL function with `pg_advisory_xact_lock(hashtext('qcs:research:model'))`, then lock the source and budget-day row in that order. Count reservations with `status='reserved' AND expires_at>now()` across QCS; reject at two. Reject when requested tokens/pence plus existing reserved-and-used totals exceed either daily source cap or the run investigation's `maxTokens` and `maxCostPence`. `maxRequests` is enforced by the request function using the current run context. Insert a reservation and increment counters together. Reject negative or non-integer requested units before SQL.
- [ ] Implement settlement by locking its reservation first, returning immediately if already settled, and updating source-day/run totals by `actual-reserved`. For null usage, charge the reserved values and mark `usage_unknown`; for late reported usage above the reservation, record the actual excess and block future dispatch when over budget. An expired reservation releases the concurrency slot but never silently refunds known or unknown usage.

```sql
CREATE FUNCTION research_reserve_model(p_source uuid,p_run uuid,p_tokens bigint,p_pence bigint) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE s research_sources; b research_budget_days; limits jsonb; used_tokens bigint; used_pence bigint; reservation uuid;
BEGIN
 IF p_tokens<0 OR p_pence<0 THEN RAISE EXCEPTION 'invalid_budget'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('qcs:research:model'));
 IF (SELECT count(*) FROM research_model_reservations WHERE status='reserved' AND expires_at>now())>=2 THEN RAISE EXCEPTION 'model_capacity'; END IF;
 SELECT * INTO s FROM research_sources WHERE id=p_source FOR UPDATE;
 IF NOT FOUND OR s.status<>'ready' THEN RAISE EXCEPTION 'source_unavailable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM research_rights WHERE id=s.rights_id AND effective_at<=now() AND (expires_at IS NULL OR expires_at>now())) THEN RAISE EXCEPTION 'rights_unavailable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM research_runs WHERE id=p_run AND status IN ('queued','running')) THEN RAISE EXCEPTION 'run_unavailable'; END IF;
 SELECT i.budget INTO limits FROM research_runs r LEFT JOIN research_investigations i ON i.id=r.investigation_id WHERE r.id=p_run;
 SELECT coalesce(sum(coalesce(actual_tokens,tokens)),0),coalesce(sum(coalesce(actual_pence,pence)),0) INTO used_tokens,used_pence FROM research_model_reservations WHERE run_id=p_run;
 IF used_tokens+p_tokens>coalesce((limits->>'maxTokens')::bigint,s.daily_tokens) OR used_pence+p_pence>coalesce((limits->>'maxCostPence')::bigint,s.daily_pence) THEN RAISE EXCEPTION 'run_budget'; END IF;
 INSERT INTO research_budget_days(source_id,day) VALUES(p_source,(now() AT TIME ZONE 'UTC')::date) ON CONFLICT DO NOTHING;
 SELECT * INTO b FROM research_budget_days WHERE source_id=p_source AND day=(now() AT TIME ZONE 'UTC')::date FOR UPDATE;
 IF b.tokens+p_tokens>s.daily_tokens OR b.pence+p_pence>s.daily_pence THEN RAISE EXCEPTION 'daily_model_budget'; END IF;
 UPDATE research_budget_days SET tokens=tokens+p_tokens,pence=pence+p_pence WHERE source_id=p_source AND day=b.day;
 INSERT INTO research_model_reservations(source_id,run_id,day,tokens,pence) VALUES(p_source,p_run,b.day,p_tokens,p_pence) RETURNING id INTO reservation;
 UPDATE research_runs SET reserved_pence=reserved_pence+p_pence WHERE id=p_run; RETURN reservation;
END $$;
CREATE FUNCTION research_settle_model(p_id uuid,p_tokens bigint,p_pence bigint) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r research_model_reservations; tokens_used bigint; pence_used bigint;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('qcs:research:model'));SELECT * INTO r FROM research_model_reservations WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR r.status<>'reserved' THEN RETURN; END IF;
 tokens_used:=coalesce(p_tokens,r.tokens);pence_used:=coalesce(p_pence,r.pence);
 IF tokens_used<0 OR pence_used<0 THEN RAISE EXCEPTION 'invalid_usage'; END IF;
 UPDATE research_budget_days SET tokens=tokens+tokens_used-r.tokens,pence=pence+pence_used-r.pence WHERE source_id=r.source_id AND day=r.day;
 UPDATE research_model_reservations SET actual_tokens=tokens_used,actual_pence=pence_used,status=CASE WHEN p_tokens IS NULL OR p_pence IS NULL THEN 'usage_unknown' ELSE 'settled' END WHERE id=p_id;
 UPDATE research_runs SET reserved_pence=reserved_pence-r.pence,actual_pence=actual_pence+pence_used,actual_tokens=actual_tokens+tokens_used WHERE id=r.run_id;
END $$;
```

- [ ] Add `const researchRunContext=new AsyncLocalStorage<string>()` in `research.ts` and export `withResearchRun<T>(runId:string,work:()=>Promise<T>):Promise<T>` as `researchRunContext.run(runId,work)`. `reserveSourceRequest(sourceId)` requires `researchRunContext.getStore()` and calls the SQL function with that run ID. The runner wraps its entire connector/staging operation in `withResearchRun(job.runId,async()=>...)`; background adapters therefore receive no extra fields in the locked connector contract. Map PostgreSQL quota errors into `ResearchFetchError` with delay to the oldest live reservation plus its rolling window, or next UTC day for daily caps.
- [ ] Test parallel request reservations at a cap of one, requests straddling a rolling-window boundary, two accepted model calls and a rejected third, idempotent settlement, UTC midnight boundaries, null usage charging, cancellation, licence expiry and a failed HTTP response consuming its allocation. Termination pauses the source and revokes its rights effective window before another lease or reservation is possible. Run only the isolated budget test file.

### Task 6: Evidence objects, text search and lifecycle

**Files:** create `src/lib/research/evidence.ts`, `src/lib/research/evidence.test.ts`; extend `research.ts`; use `src/lib/portal/s3.ts` without reading client objects.

**Interfaces:** `stageResearchPage(page:ConnectorPage,extract:(e:SourceEnvelope)=>Promise<ExtractedEvidence>):Promise<StagedRecord[]>`; `searchResearchPassages(query:string):Promise<{id:string;documentId:string;locator:unknown;text:string}[]>`; `withdrawResearchDocument(documentId:string,reason:string):Promise<void>`; `processResearchInvalidation(id:string,invalidateDependants:(versionId:string)=>Promise<void>):Promise<void>`.

- [ ] Implement staging and test that a client object key is never accepted as a public-source envelope, parser failure returns no staged page, and repeated source bytes produce the same identity hash. `parserVersion` is supplied in extraction metadata by the source pipeline and must be a non-empty string.

```ts
import { createHash,randomUUID } from "node:crypto";
import { putObject } from "@/lib/portal/s3";
import type { ConnectorPage,ExtractedEvidence,SourceEnvelope,StagedRecord } from "./contracts";
const hash=(bytes:Uint8Array|string)=>createHash("sha256").update(bytes).digest("hex");
export async function stageResearchPage(page:ConnectorPage,extract:(e:SourceEnvelope)=>Promise<ExtractedEvidence>):Promise<StagedRecord[]>{
 const result:StagedRecord[]=[];
 for(const e of page.records){
  if(!/^https:\/\//.test(e.url)||e.providerId.startsWith("meritus/clients/"))throw new Error("research_source_required");
  const parsed=await extract(e);if(!parsed.coverage.complete)throw new Error("parse_incomplete");
  const parserVersion=e.metadata.parserVersion;if(typeof parserVersion!=="string"||!parserVersion)throw new Error("parser_version_required");
  const digest=hash(e.body);const saved=await putObject(`research/staged/${e.sourceId}/${randomUUID()}/${digest}`,Buffer.from(e.body),e.contentType);
  const {body,...envelope}=e;
  result.push({...envelope,hash:digest,objectKey:saved.key,parserVersion,metadata:{...e.metadata,facts:parsed.facts},passages:parsed.passages.map(p=>({...p,hash:hash(JSON.stringify(p.locator)+"\n"+p.text)}))});
 }return result;
}
```

- [ ] Record every staged object in a `research_staged_objects(id,workspace_id,object_key,created_at,claimed_at)` table before commit; page commit marks referenced keys claimed. Delete unclaimed objects older than 24 hours through an authenticated cleanup job. This compensates failed/stale commits without ever deleting `meritus/clients/*` or existing director upload keys. On replay, reuse an existing available version's key and delete the newly staged duplicate after commit.
- [ ] Implement search as the following parameterised query after `requireResearchDirector`; bound the input to 500 characters and the result to 50 passages:

```sql
SELECT p.id,d.id AS "documentId",p.locator,p.text FROM research_passages p
JOIN research_versions v ON v.id=p.version_id JOIN research_documents d ON d.current_version_id=v.id
JOIN research_sources s ON s.id=d.source_id JOIN research_rights r ON r.id=s.rights_id
WHERE d.workspace_id=$1 AND d.status='available' AND v.availability='available'
AND r.effective_at<=now() AND (r.expires_at IS NULL OR r.expires_at>now())
AND p.search @@ websearch_to_tsquery('english',$2)
ORDER BY ts_rank(p.search,websearch_to_tsquery('english',$2)) DESC,p.id LIMIT 50;
```

- [ ] Withdrawal is one SQL transaction: lock document; set status `withdrawn`; null its current-version FK; mark every version unavailable; blank passage text and version metadata; enqueue each version in `research_invalidations`. Keep passage IDs, locators, identifiers, timestamps, hashes and the permitted reason so downstream FKs remain valid. The worker calls `invalidateDependants(versionId)` before deleting every affected S3 object, nulling object keys and setting invalidation complete. On any failure retain pending status and retry. The workflow plan implements the callback for claims, report objects, caches and linked pursuit summaries; until wired, withdrawal cannot claim completion. Reinstatement requires an explicit `reinstate` review and creates a fresh version UUID even when an old hash recurs, so old invalidation jobs cannot delete reactivated content.
- [ ] Add authenticated source readers with `Cache-Control: private, no-store` and `X-Robots-Tag: noindex, nofollow`; recheck current availability and rights on every read, including object downloads. Test replacement hiding the old version, rights expiry hiding results, duplicate upload cleanup, delete failure leaving invalidation pending, and report invalidation preceding completion. Document backup restoration purging against the current tombstone set before serving restored data.

- [ ] Export `readResearchObject(objectKey:string,signal:AbortSignal):Promise<Uint8Array>` and `readResearchObjectStream(objectKey:string,signal:AbortSignal,startByte=0):Promise<AsyncIterable<Uint8Array>>` from `evidence.ts`. The former consumes the latter with a 32 MB buffer ceiling. Both first query `research_staged_objects` or an available `research_versions` row in the QCS workspace, enforce the configured `meritus/research/` prefix, and require the associated source's rights to remain effective. The staged-object table also stores `source_id`, `size` and `sha256`. Require an integer `0<=startByte<=size`; S3 `GetObjectCommand` uses `Range: "bytes="+startByte+"-"` when nonzero and `{abortSignal:signal}`. The stream counts bytes against `registeredSize-startByte` and the configured 1 GiB snapshot ceiling; mismatch or abort destroys the stream. The sources plan retains original CSV headers and complete-record byte offsets so each chunk resumes without scanning previous rows. These APIs never accept a client or ordinary portal-document key.

### Task 7: Large official snapshots without buffering or manual splitting

**Files:** extend `safe-fetch.ts` and `evidence.ts`; create `src/lib/research/snapshot.test.ts`; add `scripts/research-worker.ts` and a `tsx` development dependency for a supervised Node entry point when a transfer exceeds the hosted request budget. The service command is `corepack pnpm exec tsx scripts/research-worker.ts`, with a fixed working directory and restart policy on the configured worker host.

**Interfaces:** `downloadResearchSnapshot(url:string,options:{source:SourceRecord;signal:AbortSignal;maxBytes:number;lease:{jobId:string;leaseToken:number}}):Promise<{objectKey:string;bytes:number;sha256:string;contentType:string}>`; `renewResearchLease(jobId:string,leaseToken:number):Promise<boolean>`. Sources consume this for the official Payment Practices CSV, then parse the registered stored stream in bounded chunks.

- [ ] Extract `openValidatedResearchResponse(url:string,options:{source:SourceRecord;signal:AbortSignal}):Promise<{body:AsyncIterable<Uint8Array>;contentType:string}>` from Task 4's validated transport. It uses identical host, DNS-at-connection, redirect, credential, status and rolling-budget checks, with a 20-second connection/header deadline and the caller's abort signal for streamed transfer. `safeFetch` supplies its 20-second total signal and buffers at most 32 MB; snapshots use the hosted 90-second deadline or a supervised 15-minute transfer deadline and stream to S3. No Range support or Content-Length header is assumed. A raw source's Content-Length, when present, is checked but never trusted as the sole size check.
- [ ] Implement the multipart loop below inside `downloadResearchSnapshot`. `s3` is constructed from `readS3Config()` and `S3Client`; the key is `objectKey("research/staged/"+source.id+"/"+randomUUID())`. `response` is the validated response above. Every command carries `{abortSignal:signal}` except best-effort abort, which uses a fresh ten-second signal. Register the completed object's exact bytes and hash in `research_staged_objects` before returning it.

```ts
const created=await s3.send(new CreateMultipartUploadCommand({Bucket:bucket,Key:key,ContentType:response.contentType,ServerSideEncryption:"AES256"}),{abortSignal:signal});
if(!created.UploadId)throw new Error("multipart_id_missing");
const parts:{ETag:string;PartNumber:number}[]=[];let pending=Buffer.alloc(0),bytes=0;const digest=createHash("sha256");
const upload=async(body:Buffer)=>{const PartNumber=parts.length+1;const result=await s3.send(new UploadPartCommand({Bucket:bucket,Key:key,UploadId:created.UploadId,PartNumber,Body:body}),{abortSignal:signal});if(!result.ETag)throw new Error("part_etag_missing");parts.push({PartNumber,ETag:result.ETag});};
try{
 for await(const chunk of response.body){signal.throwIfAborted();bytes+=chunk.length;if(bytes>options.maxBytes)throw new Error("snapshot_too_large");digest.update(chunk);pending=Buffer.concat([pending,chunk]);while(pending.length>=8*1024*1024){await upload(pending.subarray(0,8*1024*1024));pending=pending.subarray(8*1024*1024);}}
 if(pending.length)await upload(pending);if(bytes===0)throw new Error("empty_snapshot");
 if(!await renewResearchLease(options.lease.jobId,options.lease.leaseToken))throw new Error("lease_lost");
 await s3.send(new CompleteMultipartUploadCommand({Bucket:bucket,Key:key,UploadId:created.UploadId,MultipartUpload:{Parts:parts}}),{abortSignal:signal});
}catch(error){await s3.send(new AbortMultipartUploadCommand({Bucket:bucket,Key:key,UploadId:created.UploadId}),{abortSignal:AbortSignal.timeout(10000)}).catch(()=>undefined);throw error;}
```

- [ ] Validate `maxBytes` against `RESEARCH_SNAPSHOT_MAX_BYTES` (default 1,073,741,824), and enforce backpressure at each awaited part. Renew every 30 seconds with `UPDATE research_jobs SET lease_expires_at=now()+interval '120 seconds' WHERE id=$1 AND lease_token=$2 AND status='running' AND cancelled_at IS NULL AND lease_expires_at>now() RETURNING id`; a missing row aborts transfer. Also check source status/rights on renewal. The hosted runner aborts at 90 seconds; the supervised Node worker may continue while its lease remains valid and its configured transfer deadline has not elapsed. Both use the same fencing token and commit function.
- [ ] Test an unknown-length stream above 32 MB, over-limit abort, a source closing mid-part, cancellation, lease theft and retry after an incomplete upload. Verify no cursor advancement and no partially completed evidence record. Test exact-byte replay produces a reusable current version and that abandoned multipart uploads have an S3 lifecycle cleanup rule confined to the research prefix. The source plan's automated full-export job must pass without requiring a director to split the CSV.

### Task 8: Testable runner and scheduled dispatcher

**Files:** create `src/lib/research/runner.ts`, `src/lib/research/dispatch.ts`, their tests and `src/app/api/internal/research/route.ts`; extend `research.ts`; create `vercel.json` only if absent, otherwise merge its cron entry.

**Interfaces:** `getConnector(provider:string,selection:unknown):SourceConnector|null` and `extractEnvelope(envelope:SourceEnvelope):Promise<ExtractedEvidence>` are defined by the sources plan. The runner takes them as injected dependencies. `enqueueResearchJob(input:{sourceId:string;scopeKey:string;type:string;payload:Record<string,unknown>;dedupeKey:string;runId:string}):Promise<string|null>` inserts checkpoint and job atomically, returning null on duplicate active scope or dedupe key.

- [ ] Export `updateResearchJobPayload(jobId:string,leaseToken:number,payload:Record<string,unknown>):Promise<boolean>` from `research.ts` using `UPDATE research_jobs SET payload=$3::jsonb,updated_at=now() WHERE id=$1 AND lease_token=$2 AND status='running' AND cancelled_at IS NULL AND lease_expires_at>now() RETURNING id`. Before connector creation, invoke source-owned `prepareSourceJob({source,jobId,leaseToken,payload,signal})`, which returns the prepared payload and persists it through this function. A lost lease returns false and aborts preparation. Payment snapshots therefore remain attached to the immutable run before chunk parsing; the locked `ConnectorContext` does not grow lease fields.

- [ ] Write the runner cancellation and parse-failure tests with in-memory dependency stubs; assert `commit` is never called after cancellation or extraction failure. Then implement this bounded execution core:

```ts
import type { ConnectorPage,ExtractedEvidence,Lease,SourceConnector,SourceEnvelope,SourceRecord,StagedRecord } from "./contracts";
export type RunnerDeps={lease():Promise<Lease|null>;source(id:string):Promise<SourceRecord>;prepare(input:{source:SourceRecord;jobId:string;leaseToken:number;payload:Record<string,unknown>;signal:AbortSignal}):Promise<Record<string,unknown>>;connector(provider:string,payload:unknown):SourceConnector|null;extract(e:SourceEnvelope):Promise<ExtractedEvidence>;stage(page:ConnectorPage,extract:(e:SourceEnvelope)=>Promise<ExtractedEvidence>):Promise<StagedRecord[]>;commit(input:{jobId:string;leaseToken:number;page:ConnectorPage;records:StagedRecord[];expectedRevision:number}):Promise<boolean>;fail(job:Lease,error:unknown):Promise<void>;cancelled(id:string):Promise<boolean>};
export async function runResearchChunk(deps:RunnerDeps,parent:AbortSignal,budgetMs=90000){
 const job=await deps.lease();if(!job)return {status:"idle"};
 const controller=new AbortController();const signal=AbortSignal.any([parent,controller.signal,AbortSignal.timeout(budgetMs)]);
 const watcher=setInterval(()=>{void deps.cancelled(job.id).then(value=>{if(value)controller.abort();}).catch(()=>controller.abort());},1000);
 try{
  const source=await deps.source(job.sourceId);const payload=await deps.prepare({source,jobId:job.id,leaseToken:job.leaseToken,payload:job.payload,signal});const connector=deps.connector(source.provider,payload);
  if(!connector)throw new Error("connector_unavailable");
  const window=job.payload.window as {from:string;to:string};if(!window||!Number.isFinite(Date.parse(window.from))||!Number.isFinite(Date.parse(window.to)))throw new Error("invalid_window");
  signal.throwIfAborted();const page=await connector.fetchPage({source,cursor:job.cursor,window,signal});
  signal.throwIfAborted();const records=await deps.stage(page,deps.extract);
  signal.throwIfAborted();if(await deps.cancelled(job.id))throw new Error("cancelled");
  return {status:await deps.commit({jobId:job.id,leaseToken:job.leaseToken,page,records,expectedRevision:job.revision})?"committed":"lease_lost"};
 }catch(error){await deps.fail(job,error);return {status:"failed"};}finally{clearInterval(watcher);}
}
```

- [ ] `fail` updates only `WHERE id=job.id AND lease_token=job.leaseToken AND status='running'`. Access failures become failed/unavailable; parse failure stores only a redacted error code plus coverage notes and keeps the cursor; cancellation stays cancelled. For transient failures schedule `max(Retry-After,min(3600000,1000*2**(attempts-1)))` milliseconds with at most five attempts. Never overwrite a replacement worker's state.
- [ ] `dispatchDueResearch(now)` is a SQL function locking due source rows with `SKIP LOCKED`, inserting one run, checkpoint and deduplicated job per due source/scope, then moving `next_due_at` only when enqueue succeeds. Payload stores an immutable `{window:{from:checkpoint.watermarkAt-overlap,to:now},selection}`; use a default one-hour overlap and preserve configured provider selection. For the first run use the configured backfill start. A terminal successful window advances the checkpoint watermark to its frozen upper bound, never to wall-clock completion. `lastSuccessAt` remains an operational health timestamp. Test a backfill completing days after its upper bound so intervening updates are not skipped. Sources lacking a valid selection or credential become visibly unavailable, with no fake empty run. A due active scope returns the existing job and retains its due date.
- [ ] Add a Node route with `export const maxDuration=120`, constant-time comparison of `Authorization: Bearer ${process.env.CRON_SECRET}`, 503 when the secret is unset, `GET` dispatch plus at most one worker chunk, and JSON counts. The source plan supplies connector/extractor wiring; no dynamic code or provider names come from the request. Configure `{"crons":[{"path":"/api/internal/research","schedule":"* * * * *"}]}` on a scheduler plan supporting that cadence. A local equivalent calls the same authenticated route; verify actual invocations in the scheduler before calling monitoring operational.
- [ ] Test two concurrent dispatches enqueue once, missing credentials create no job, cancellation interrupts a pending connector, and shutdown leaves an expiring lease rather than a false success. Add a protected operational status response listing due/running/failed counts and last source success; never expose keys, raw source bodies or client file metadata.

### Task 9: Review, isolated validation and handoff

**Files:** update `README.md` with research setup and restore/purge instructions; add `docs/research-operations.md` with exact scheduler, source-status, cancellation and withdrawal procedures.

- [ ] Run each new focused test, then the existing suite once: `corepack pnpm --config.verify-deps-before-run=false exec node node_modules/vitest/vitest.mjs run`.
- [ ] Run TypeScript and ESLint without a production build. Resolve new diagnostics; record the pre-existing `clientDomainId` fixture issue separately unless its owner has already fixed it.
- [ ] In the isolated database prove: stale leases cannot write; invalid second item rolls back the first; replay creates one version; checkpoint changes exactly once; concurrent source reservations respect caps; withdrawal removes searchable passages and dependent outputs; cancelled jobs cannot commit. Use test fixtures, never live paid APIs.
- [ ] Review the schema migration, role changes and worker tests with a fresh reviewer. Verify each portal page/API/action is covered by a director gate, and source readers do not import client file extraction or client document repositories.
- [ ] Before operational acceptance, record a real scheduler invocation, one permitted source-page import, source coverage, budget totals and a test withdrawal through all registered dependent artefacts. Deployment and external distribution remain separate authorised actions.

The sources plan consumes the fixed connector and safe-fetch interfaces. The workflow plan consumes investigations, evidence/search, run status and the invalidation callback. This foundation provides no claim-verification shortcut, no automatic distress label and no outbound messaging.
