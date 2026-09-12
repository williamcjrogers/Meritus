import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import { requireDb } from "./index";
import { QCS_WORKSPACE_ID, type Lease, type SourceRecord, type ConnectorPage, type StagedRecord } from "@/lib/research/contracts";
import { ResearchFetchError } from "@/lib/research/errors";
import { requireResearchDirector } from "@/lib/research/roles";
import { sourceRegistration, investigationRegistration, type SourceRegistration } from "@/lib/research/source-registration";
const researchRunContext = new AsyncLocalStorage<string>();
export function withResearchRun<T>(runId: string, work: () => Promise<T>): Promise<T> { return researchRunContext.run(runId, work); }
export type PageCommit = {
    jobId: string;
    leaseToken: number;
    page: ConnectorPage;
    records: StagedRecord[];
    expectedRevision: number;
};
export type StagedObjectRegistration = {
    objectKey: string;
    sourceId: string;
    size: number;
    sha256: string;
};
export type DueResearchSource = SourceRecord & {
    selection: Record<string, unknown>;
    backfillStart: string;
    updatedAt: string;
    nextDueAt: string;
};
export type ResearchInvalidation = {
    id: string;
    versionId: string;
    objectKey: string | null;
};
function units(value: number) { if (!Number.isSafeInteger(value) || value < 0)
    throw new Error("invalid_budget"); }
function databaseCode(error: unknown): {
    code: string;
    detail: string | null;
} {
    let e: unknown = error;
    for (let n = 0; n < 5 && e && typeof e === "object"; n++) {
        const item = e as {
            message?: string;
            detail?: string;
            cause?: unknown;
        };
        const code = item.message?.match(/\b(source_rate_limit|daily_request_budget|daily_model_budget|run_request_budget|run_budget|model_capacity|source_unavailable|rights_unavailable|run_unavailable)\b/)?.[1];
        if (code)
            return { code, detail: item.detail ?? null };
        e = item.cause;
    }
    return { code: "database_failure", detail: null };
}
function quotaError(error: unknown): never {
    const { code, detail } = databaseCode(error);
    if (code === "database_failure")
        throw error;
    const now = Date.now();
    const midnight = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate() + 1);
    const retry = code === "source_rate_limit" ? Math.max(1, Number(detail) || 1000) : code.startsWith("daily_") ? midnight - now : code === "model_capacity" ? 120000 : null;
    throw new ResearchFetchError(code, ["source_rate_limit", "model_capacity"].includes(code) || code.startsWith("daily_") ? 429 : 403, retry);
}
/** Bind a database only at call time, so imports and offline tests never open a production connection. */
export function createResearchRepository(db: Pick<ReturnType<typeof requireDb>, "execute">) {
    async function rows<T extends Record<string, unknown>>(query: SQL): Promise<T[]> {
        const result = await db.execute(query);
        return (Array.isArray(result) ? result : result.rows) as T[];
    }
    const one = async <T extends Record<string, unknown>>(query: SQL): Promise<T | null> => (await rows<T>(query))[0] ?? null;
    const bool = async (query: SQL) => (await one<{
        ok: boolean;
    }>(query))?.ok === true;
    const repo = {
        async leaseResearchJob(owner: string): Promise<Lease | null> {
            if (!owner.trim())
                throw new Error("lease_owner_required");
            const result = await one<{
                job: Record<string, unknown>;
            }>(sql `select research_lease_job(${owner}) as job`);
            if (!result)
                return null;
            const j = result.job;
            return { id: String(j.id), sourceId: String(j.source_id), scopeKey: String(j.scope_key), runId: String(j.run_id), payload: j.payload as Record<string, unknown>, cursor: j.cursor as string | null, leaseToken: Number(j.lease_token), revision: Number(j.revision), attempts: Number(j.attempts) };
        },
        async commitResearchPage(input: PageCommit) {
            if (input.records.length !== input.page.records.length)
                throw new Error("staged_page_mismatch");
            return bool(sql `select research_commit_page(${input.jobId}::uuid,${input.leaseToken},${input.expectedRevision},${JSON.stringify(input.records)}::jsonb,${input.page.nextCursor},${JSON.stringify(input.page.coverage)}::jsonb) as ok`);
        },
        async cancelResearchRun(runId: string) { await rows(sql `select research_cancel_run(${runId}::uuid)`); },
        async renewResearchLease(jobId: string, token: number) {
            return bool(sql `update research_jobs j set lease_expires_at=now()+interval '120 seconds',updated_at=now()
        from research_sources s,research_rights r,research_runs run
        where j.id=${jobId}::uuid and j.workspace_id=${QCS_WORKSPACE_ID}::uuid and j.lease_token=${token} and j.status='running'
        and j.cancelled_at is null and j.lease_expires_at>now() and s.id=j.source_id and s.workspace_id=j.workspace_id and s.status='ready'
        and r.id=s.rights_id and r.workspace_id=j.workspace_id and r.effective_at<=now() and (r.expires_at is null or r.expires_at>now())
        and run.id=j.run_id and run.workspace_id=j.workspace_id and run.status in ('queued','running') returning true as ok`);
        },
        async updateResearchJobPayload(jobId: string, token: number, payload: Record<string, unknown>) {
            return bool(sql `update research_jobs set payload=${JSON.stringify(payload)}::jsonb,updated_at=now()
        where id=${jobId}::uuid and workspace_id=${QCS_WORKSPACE_ID}::uuid and lease_token=${token} and status='running' and cancelled_at is null and lease_expires_at>now() and payload->'window'=${JSON.stringify(payload.window ?? null)}::jsonb returning true as ok`);
        },
        async researchJobCancelled(jobId: string) {
            return !await bool(sql `select true as ok from research_jobs j join research_sources s on s.id=j.source_id and s.workspace_id=j.workspace_id
        join research_rights r on r.id=s.rights_id and r.workspace_id=j.workspace_id join research_runs run on run.id=j.run_id and run.workspace_id=j.workspace_id
        where j.id=${jobId}::uuid and j.workspace_id=${QCS_WORKSPACE_ID}::uuid and j.status='running' and j.cancelled_at is null
        and j.lease_expires_at>now() and s.status='ready' and run.status in ('queued','running') and r.effective_at<=now() and (r.expires_at is null or r.expires_at>now())`);
        },
        async getResearchSource(id: string): Promise<SourceRecord> {
            const source = await one<SourceRecord>(sql `select id,provider,hosts,status,credential_ref as "credentialRef" from research_sources where id=${id}::uuid and workspace_id=${QCS_WORKSPACE_ID}::uuid`);
            if (!source)
                throw new Error("source_unavailable");
            return source;
        },
        async enqueueResearchJob(input: {
            sourceId: string;
            scopeKey: string;
            type: string;
            payload: Record<string, unknown>;
            dedupeKey: string;
            runId: string;
        }) {
            return (await one<{
                id: string | null;
            }>(sql `select research_enqueue(${input.sourceId}::uuid,${input.scopeKey},${input.type},${JSON.stringify(input.payload)}::jsonb,${input.dedupeKey},${input.runId}::uuid) as id`))?.id ?? null;
        },
        async failResearchJob(job: Lease, error: unknown) {
            const e = error instanceof ResearchFetchError ? error : null;
            const raw = error instanceof Error ? error.message : "unknown_failure";
            const known = /^(parse_incomplete|invalid_window|connector_unavailable|cancelled|lease_lost|snapshot_too_large|body_too_large|parser_version_required|staged_page_mismatch|invalid_source_payload)$/;
            const code = e?.code ?? (known.test(raw) ? raw : error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError") ? "aborted" : "processing_failed");
            const access = (code === "http_failure" && (e?.status === 401 || e?.status === 403)) || ["credential_missing", "auth_adapter_missing", "connector_unavailable"].includes(code);
            const transient = code === "source_rate_limit" || code === "aborted" || code === "processing_failed" || (e !== null && (e.status === null || e.status === 429 || (e.status ?? 0) >= 500));
            const status = code === "cancelled" ? "cancelled" : transient && job.attempts < 5 ? "retry" : "failed";
            const delay = Math.max(e?.retryAfterMs ?? 0, Math.min(3600000, 1000 * 2 ** Math.max(0, job.attempts - 1)));
            await rows(sql `with changed as (
        update research_jobs set status=${status},error_code=${code},next_attempt_at=now()+${delay}*interval '1 millisecond',lease_owner=null,lease_expires_at=null,updated_at=now()
        where id=${job.id}::uuid and workspace_id=${QCS_WORKSPACE_ID}::uuid and lease_token=${job.leaseToken} and status='running' and cancelled_at is null returning run_id,source_id
      ), run_changed as (
        update research_runs r set status=case when exists(select 1 from research_jobs other where other.run_id=r.id and other.id<>${job.id}::uuid and other.status in ('queued','running','retry')) then 'running' else ${status === "retry" ? "running" : status} end,error_summary=${code},coverage=r.coverage||jsonb_build_object(${job.sourceId},coalesce(r.coverage->${job.sourceId},'{}'::jsonb)||jsonb_build_object('complete',case when ${status === "retry"} then coalesce((r.coverage->${job.sourceId}->>'complete')::boolean,true) else false end,'notes',coalesce(r.coverage->${job.sourceId}->'notes','[]'::jsonb)||jsonb_build_array(${code}))),updated_at=now()
        from changed c where r.id=c.run_id returning r.id
      ) update research_sources s set status=case when ${access} then 'unavailable' else s.status end,configuration_error=case when ${access} then ${code} else s.configuration_error end,updated_at=now() from changed c where s.id=c.source_id`);
        },
        async reserveCompaniesHouseBriefRequest() {
            try {
                await rows(sql `select research_reserve_ch_brief()`);
            }
            catch (error) {
                quotaError(error);
            }
        },
        async reserveSourceRequest(sourceId: string) {
            const runId = researchRunContext.getStore();
            if (!runId)
                throw new Error("research_run_context_required");
            try {
                await rows(sql `select research_reserve_request(${sourceId}::uuid,${runId}::uuid)`);
            }
            catch (error) {
                quotaError(error);
            }
        },
        async reserveResearchModel(input: {
            sourceId: string;
            runId: string;
            tokens: number;
            pence: number;
        }) {
            units(input.tokens);
            units(input.pence);
            try {
                return (await one<{
                    id: string;
                }>(sql `select research_reserve_model(${input.sourceId}::uuid,${input.runId}::uuid,${input.tokens},${input.pence}) as id`))!.id;
            }
            catch (error) {
                return quotaError(error);
            }
        },
        async settleResearchModel(id: string, usage: {
            tokens: number;
            pence: number;
        } | null) {
            if (usage) {
                units(usage.tokens);
                units(usage.pence);
            }
            await rows(sql `select research_settle_model(${id}::uuid,${usage?.tokens ?? null}::bigint,${usage?.pence ?? null}::bigint)`);
        },
        async registerResearchStagedObject(input: StagedObjectRegistration) {
            units(input.size);
            if (!/^[a-f0-9]{64}$/.test(input.sha256) || !input.objectKey.includes("/research/") || input.objectKey.includes(".."))
                throw new Error("invalid_research_object");
            const ok = await bool(sql `insert into research_staged_objects(object_key,source_id,size,sha256)
        select ${input.objectKey},s.id,${input.size},${input.sha256} from research_sources s join research_rights r on r.id=s.rights_id and r.workspace_id=s.workspace_id
        where s.id=${input.sourceId}::uuid and s.workspace_id=${QCS_WORKSPACE_ID}::uuid and s.status='ready' and r.effective_at<=now() and (r.expires_at is null or r.expires_at>now())
        on conflict(object_key) do update set updated_at=now() where research_staged_objects.source_id=excluded.source_id and research_staged_objects.size=excluded.size and research_staged_objects.sha256=excluded.sha256 returning true as ok`);
            if (!ok)
                throw new Error("source_unavailable");
        },
        async getResearchObjectRegistration(objectKey: string): Promise<StagedObjectRegistration | null> {
            return one<StagedObjectRegistration>(sql `select st.object_key as "objectKey",st.source_id as "sourceId",st.size::float8 as size,st.sha256
        from research_staged_objects st join research_sources s on s.id=st.source_id and s.workspace_id=st.workspace_id join research_rights r on r.id=s.rights_id and r.workspace_id=st.workspace_id
        where st.object_key=${objectKey} and st.workspace_id=${QCS_WORKSPACE_ID}::uuid
        and r.effective_at<=now() and (r.expires_at is null or r.expires_at>now())
        and ((st.claimed_at is null and (st.created_at>now()-interval '24 hours' or exists(select 1 from research_jobs job where job.workspace_id=st.workspace_id and job.source_id=st.source_id and job.status in ('queued','running','retry') and jsonb_path_exists(job.payload,'$.**.objectKey ? (@ == $key)'::jsonpath,jsonb_build_object('key',st.object_key))))) or exists(select 1 from research_versions v join research_documents d on d.current_version_id=v.id
          where v.object_key=st.object_key and v.availability='available' and d.status='available' and d.workspace_id=st.workspace_id))`);
        },
        async listUnclaimedResearchObjects(keys?: string[]): Promise<StagedObjectRegistration[]> {
            if (keys && keys.length === 0)
                return [];
            return rows(sql `select st.object_key as "objectKey",st.source_id as "sourceId",st.size::float8 as size,st.sha256 from research_staged_objects st
        where st.workspace_id=${QCS_WORKSPACE_ID}::uuid and st.claimed_at is null and (${keys ? sql `st.object_key in (select jsonb_array_elements_text(${JSON.stringify(keys)}::jsonb))` : sql `st.created_at<now()-interval '24 hours'`})
        and not exists(select 1 from research_jobs job where job.workspace_id=st.workspace_id and job.source_id=st.source_id and job.status in ('queued','running','retry') and jsonb_path_exists(job.payload,'$.**.objectKey ? (@ == $key)'::jsonpath,jsonb_build_object('key',st.object_key)))
        and not exists(select 1 from research_versions v where v.object_key=st.object_key) order by st.created_at limit 100`);
        },
        async deleteResearchStagedObject(objectKey: string) {
            await rows(sql `delete from research_staged_objects st where st.object_key=${objectKey} and st.workspace_id=${QCS_WORKSPACE_ID}::uuid and not exists(select 1 from research_versions v where v.object_key=st.object_key)`);
        },
        async getResearchInvalidation(id: string): Promise<ResearchInvalidation | null> {
            return one<ResearchInvalidation>(sql `select i.id,i.version_id as "versionId",v.object_key as "objectKey" from research_invalidations i join research_versions v on v.id=i.version_id
        where i.id=${id}::uuid and i.workspace_id=${QCS_WORKSPACE_ID}::uuid and i.status='pending' and v.availability<>'available'`);
        },
        async listResearchInvalidations(): Promise<{
            id: string;
        }[]> {
            return rows(sql `select id from research_invalidations where workspace_id=${QCS_WORKSPACE_ID}::uuid and status='pending' order by updated_at,id limit 10`);
        },
        async completeResearchInvalidation(id: string) {
            await rows(sql `with target as(select v.id,v.object_key from research_versions v join research_invalidations i on i.version_id=v.id
        where i.id=${id}::uuid and i.workspace_id=${QCS_WORKSPACE_ID}::uuid and i.status='pending' and v.availability<>'available' for update of v,i),
        cleared as(update research_versions v set object_key=null,metadata='{}'::jsonb,updated_at=now() from target t where v.id=t.id returning v.id),
        registrations as(delete from research_staged_objects st using target t where st.object_key=t.object_key and not exists(select 1 from research_versions other where other.object_key=t.object_key and other.id<>t.id) returning st.id)
        update research_invalidations i set status='complete',updated_at=now() from cleared c where i.version_id=c.id`);
        },
        async failResearchInvalidation(id: string) { await rows(sql `update research_invalidations set attempts=attempts+1,updated_at=now() where id=${id}::uuid and workspace_id=${QCS_WORKSPACE_ID}::uuid and status='pending'`); },
        async withdrawResearchDocument(documentId: string, reason: string) { await rows(sql `select research_withdraw(${documentId}::uuid,${reason})`); },
        async terminateResearchSource(sourceId: string, reason: string) { await rows(sql `select research_terminate_source(${sourceId}::uuid,${reason})`); },
        async searchResearchPassages(query: string): Promise<{
            id: string;
            documentId: string;
            locator: unknown;
            text: string;
        }[]> {
            if (!query.trim() || query.length > 500)
                throw new Error("invalid_search_query");
            return rows(sql `select p.id,d.id as "documentId",p.locator,p.text from research_passages p join research_versions v on v.id=p.version_id join research_documents d on d.current_version_id=v.id
        join research_sources s on s.id=d.source_id join research_rights r on r.id=s.rights_id
        where d.workspace_id=${QCS_WORKSPACE_ID}::uuid and p.workspace_id=d.workspace_id and v.workspace_id=d.workspace_id and s.workspace_id=d.workspace_id and r.workspace_id=d.workspace_id
        and d.status='available' and v.availability='available' and r.effective_at<=now() and (r.expires_at is null or r.expires_at>now())
        and p.search @@ websearch_to_tsquery('english',${query}) order by ts_rank(p.search,websearch_to_tsquery('english',${query})) desc,p.id limit 50`);
        },
        async listDueResearchSources(now: Date): Promise<DueResearchSource[]> {
            return rows(sql `select id,provider,hosts,status,credential_ref as "credentialRef",selection,backfill_start::text as "backfillStart",updated_at::text as "updatedAt",next_due_at::text as "nextDueAt"
        from research_sources where workspace_id=${QCS_WORKSPACE_ID}::uuid and status='ready' and next_due_at<=${now.toISOString()}::timestamptz order by next_due_at,id limit 100`);
        },
        async markResearchSourceUnavailable(id: string, reason: string, updatedAt: string) {
            await rows(sql `update research_sources set status='unavailable',configuration_error=${reason},updated_at=now() where id=${id}::uuid and workspace_id=${QCS_WORKSPACE_ID}::uuid and updated_at=${updatedAt}::timestamptz`);
        },
        async dispatchValidatedResearch(now: Date, validated: {
            id: string;
            updatedAt: string;
        }[]) {
            return rows<{
                source_id: string;
                job_id: string;
                enqueued: boolean;
            }>(sql `select * from research_dispatch(${now.toISOString()}::timestamptz,${JSON.stringify(validated)}::jsonb)`);
        },
        async getResearchOperationalStatus() {
            return one(sql `select (select count(*)::int from research_sources where workspace_id=${QCS_WORKSPACE_ID}::uuid and status='ready' and next_due_at<=now()) as due,
        (select count(*)::int from research_jobs where workspace_id=${QCS_WORKSPACE_ID}::uuid and status='running') as running,
        (select count(*)::int from research_jobs where workspace_id=${QCS_WORKSPACE_ID}::uuid and status in ('failed','incomplete')) as failed,
        (select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,'status',status,'lastSuccessAt',last_success_at,'freshnessSeconds',freshness_seconds,'error',configuration_error)),'[]'::jsonb) from research_sources where workspace_id=${QCS_WORKSPACE_ID}::uuid) as sources`);
        },
        async registerSource(input: SourceRegistration, actor: string): Promise<SourceRecord> {
            const value = sourceRegistration.parse(input);
            const status = value.credentialRef && !process.env[value.credentialRef] ? "unavailable" : value.status;
            const id = randomUUID();
            const result = await one<SourceRecord>(sql `with inserted as (
        insert into research_sources(id,label,provider,hosts,access_method,terms_url,terms_version,terms_reviewed_at,attribution,operator,purpose,rights_id,credential_ref,status,selection,backfill_start,cadence_seconds,freshness_seconds,request_limit,window_seconds,daily_requests,daily_tokens,daily_pence,configuration_error)
        select ${id}::uuid,${value.label},${value.provider},${JSON.stringify(value.hosts)}::jsonb,${value.accessMethod},${value.termsUrl},${value.termsVersion},${value.termsReviewedAt}::timestamptz,${value.attribution},${value.operator},${value.purpose},r.id,${value.credentialRef},${status},${JSON.stringify(value.selection)}::jsonb,${value.backfillStart}::timestamptz,${value.cadenceSeconds},${value.freshnessSeconds},${value.requestLimit},${value.windowSeconds},${value.dailyRequests},${value.dailyTokens},${value.dailyPence},${status !== value.status ? "credential_missing" : null}
        from research_rights r where r.id=${value.rightsId}::uuid and r.workspace_id=${QCS_WORKSPACE_ID}::uuid and r.effective_at<=now() and (r.expires_at is null or r.expires_at>now()) returning *
      ), reviewed as(insert into research_reviews(actor,action,target,reason,"references") select ${actor},'register_source',id,'Source registration',jsonb_build_object('rightsId',rights_id) from inserted returning id)
      select id,provider,hosts,status,credential_ref as "credentialRef" from inserted`);
            if (!result)
                throw new Error("rights_unavailable");
            return result;
        },
        async createInvestigation(input: {
            question: string;
            scope: Record<string, unknown>;
            budget: Record<string, number>;
        }, owner: string) {
            const value = investigationRegistration.parse(input);
            return (await one<{
                id: string;
            }>(sql `insert into research_investigations(question,scope,owner,budget) values(${value.question},${JSON.stringify(value.scope)}::jsonb,${owner},${JSON.stringify(value.budget)}::jsonb) returning id`))!.id;
        },
    };
    return repo;
}
const repository = () => createResearchRepository(requireDb());
export const leaseResearchJob = (owner: string) => repository().leaseResearchJob(owner);
export const commitResearchPage = (input: PageCommit) => repository().commitResearchPage(input);
export const cancelResearchRun = async (id: string) => { await requireResearchDirector(); return repository().cancelResearchRun(id); };
export const renewResearchLease = (id: string, token: number) => repository().renewResearchLease(id, token);
export const updateResearchJobPayload = (id: string, token: number, payload: Record<string, unknown>) => repository().updateResearchJobPayload(id, token, payload);
export const getResearchSource = (id: string) => repository().getResearchSource(id);
export const researchJobCancelled = (id: string) => repository().researchJobCancelled(id);
export const failResearchJob = (job: Lease, error: unknown) => repository().failResearchJob(job, error);
export const enqueueResearchJob = (input: Parameters<ReturnType<typeof createResearchRepository>["enqueueResearchJob"]>[0]) => repository().enqueueResearchJob(input);
export const reserveSourceRequest = (id: string) => repository().reserveSourceRequest(id);
export const reserveResearchModel = (input: {
    sourceId: string;
    runId: string;
    tokens: number;
    pence: number;
}) => repository().reserveResearchModel(input);
export const settleResearchModel = (id: string, usage: {
    tokens: number;
    pence: number;
} | null) => repository().settleResearchModel(id, usage);
export const registerResearchStagedObject = (input: StagedObjectRegistration) => repository().registerResearchStagedObject(input);
export const getResearchObjectRegistration = (key: string) => repository().getResearchObjectRegistration(key);
export const listUnclaimedResearchObjects = (keys?: string[]) => repository().listUnclaimedResearchObjects(keys);
export const deleteResearchStagedObject = (key: string) => repository().deleteResearchStagedObject(key);
export const getResearchInvalidation = (id: string) => repository().getResearchInvalidation(id);
export const listResearchInvalidations = () => repository().listResearchInvalidations();
export const completeResearchInvalidation = (id: string) => repository().completeResearchInvalidation(id);
export const failResearchInvalidation = (id: string) => repository().failResearchInvalidation(id);
export const withdrawResearchDocument = async (id: string, reason: string) => { await requireResearchDirector(); return repository().withdrawResearchDocument(id, reason); };
export const terminateResearchSource = async (id: string, reason: string) => { await requireResearchDirector(); return repository().terminateResearchSource(id, reason); };
export const searchResearchPassages = async (query: string) => { await requireResearchDirector(); return repository().searchResearchPassages(query); };
export const listDueResearchSources = (now: Date) => repository().listDueResearchSources(now);
export const markResearchSourceUnavailable = (id: string, reason: string, updatedAt: string) => repository().markResearchSourceUnavailable(id, reason, updatedAt);
export const dispatchValidatedResearch = (now: Date, validated: {
    id: string;
    updatedAt: string;
}[]) => repository().dispatchValidatedResearch(now, validated);
export const getResearchOperationalStatus = () => repository().getResearchOperationalStatus();
export const registerSource = async (input: SourceRegistration) => repository().registerSource(input, await requireResearchDirector());
export const createInvestigation = async (input: {
    question: string;
    scope: Record<string, unknown>;
    budget: Record<string, number>;
}) => repository().createInvestigation(input, await requireResearchDirector());
export const reserveCompaniesHouseBriefRequest = () => repository().reserveCompaniesHouseBriefRequest();
