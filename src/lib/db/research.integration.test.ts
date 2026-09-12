// Opt-in only. The local container has no network; Neon tests require an explicit isolated URL.
import { beforeEach, describe, it, expect, vi } from "vitest";
import { execFileSync, spawn } from "node:child_process";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { createResearchRepository, withResearchRun } from "./research";
vi.mock("@/lib/research/roles", () => ({ requireResearchDirector: vi.fn().mockResolvedValue("director") }));
const url = process.env.RESEARCH_TEST_DATABASE_URL;
const container = process.env.RESEARCH_TEST_PG_CONTAINER;
const database = process.env.RESEARCH_TEST_PG_DATABASE ?? "research_test";
const enabled = Boolean(url || container);
const source = "00000000-0000-4000-8000-000000000002";
const run = "00000000-0000-4000-8000-000000000003";
const rights = "00000000-0000-4000-8000-000000000001";
function assertIsolated() {
    if (!/^research_[a-z0-9_]*test$/.test(database)) throw new Error("isolated_research_test_database_required");
    if (url && (!/research[_-]?test/i.test(new URL(url).pathname) || url === process.env.DATABASE_URL))
        throw new Error("isolated_research_test_database_required");
    if (container && !/^qcs-research-test(?:-[a-z0-9]+)?$/.test(container))
        throw new Error("isolated_research_test_container_required");
}
async function query(statement: string): Promise<Record<string, unknown>[]> {
    assertIsolated();
    if (url)
        return await neon(url).query(statement) as Record<string, unknown>[];
    if (!container)
        throw new Error("isolated_research_test_database_required");
    const command = /^(select|with)\b/i.test(statement.trim()) ? `select coalesce(json_agg(result),'[]'::json)::text from (${statement}) result` : statement;
    const output = execFileSync("docker", ["exec", "-i", container, "psql", "-U", "research_test", "-d", database, "-v", "ON_ERROR_STOP=1", "-qAt", "--set=VERBOSITY=terse"], { input: "set client_min_messages=warning;" + command + ";", encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
    return command.startsWith("select coalesce") ? JSON.parse(output) : [];
}
async function concurrent(statement: string) {
    assertIsolated();
    if (url)
        return query(statement);
    return new Promise<string>((resolve, reject) => {
        const child = spawn("docker", ["exec", "-i", container!, "psql", "-U", "research_test", "-d", database, "-v", "ON_ERROR_STOP=1", "-qAt", "--set=VERBOSITY=terse"]);
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", b => { stdout += String(b); });
        child.stderr.on("data", b => { stderr += String(b); });
        child.on("close", code => code ? reject(new Error(stderr)) : resolve(stdout));
        child.stdin.end(statement + ";");
    });
}
const literal = (value: unknown) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
async function fixture() {
    await query(`truncate research_rights,research_runs,research_reviews,research_legacy_ch_requests cascade`);
    await query(`insert into research_rights(id,holder,material,purpose,agreement_ref,agreement_hash,effective_at,transfer_conditions,retention_instructions,withdrawal_instructions,use_assessment) values('${rights}','QCS','fixture','test','fixture','fixture',now()-interval '1 day','{}','{}','{}','test')`);
    await query(`insert into research_sources(id,label,provider,hosts,access_method,terms_url,terms_version,terms_reviewed_at,attribution,operator,purpose,rights_id,status,backfill_start,cadence_seconds,freshness_seconds,request_limit,window_seconds,daily_requests,daily_tokens,daily_pence) values('${source}','fixture','fixture','["example.com"]','public','https://example.com/terms','fixture',now(),'fixture','QCS','test','${rights}','ready','2026-01-01',60,3600,10,300,100,10000,1000)`);
    await query(`insert into research_runs(id,source_selection,versions) values('${run}','[]','{}')`);
    await query(`select research_enqueue('${source}','test','fetch','{"window":{"from":"2026-01-01","to":"2026-02-01"}}','fixture','${run}')`);
}
async function lease() { return (await query("select research_lease_job('test-worker') as job"))[0]?.job as Record<string, unknown>; }
function record(overrides: Record<string, unknown> = {}) {
    return { sourceId: source, providerId: "fixture", url: "https://example.com/record", retrievedAt: "2026-03-01T00:00:00Z", publishedAt: null, updatedAt: null, eventAt: null, contentType: "text/plain", hash: "a".repeat(64), objectKey: "meritus/research/staged/fixture", parserVersion: "1", metadata: { kind: "fixture" }, passages: [{ locator: { kind: "paragraph", value: "1" }, text: "Evidence supporting a construction claim", hash: "b".repeat(64) }], ...overrides };
}
async function stage(key = "meritus/research/staged/fixture", sha = "a".repeat(64)) { await query(`insert into research_staged_objects(object_key,source_id,size,sha256) values('${key}','${source}',42,'${sha}') on conflict do nothing`); }
async function commit(job: Record<string, unknown>, records: unknown[], cursor: string | null = null, complete = true) {
    return (await query(`select research_commit_page('${job.id}',${job.lease_token},${job.revision},${literal(records)},${cursor === null ? "NULL" : `'${cursor}'`},${literal({ complete, notes: complete ? [] : ["omitted population"] })}) as ok`))[0].ok;
}
describe.skipIf(!enabled)("isolated research SQL invariants", () => {
    beforeEach(fixture);
    it("leases once under concurrent workers and fences replaced leases", async () => {
        const attempts = await Promise.all([concurrent("select research_lease_job('a')"), concurrent("select research_lease_job('b')")]);
        const rows = await query(`select lease_token,status from research_jobs where run_id='${run}'`);
        expect(Number(rows[0].lease_token)).toBe(1);
        expect(attempts.filter(value => Array.isArray(value) ? value.length > 0 : value.trim().length > 0)).toHaveLength(1);
        await query(`update research_jobs set lease_expires_at=now()-interval '1 second' where run_id='${run}'`);
        const job = await lease();
        expect(Number(job.lease_token)).toBe(2);
        expect(await commit({ ...job, lease_token: 1 }, [])).toBe(false);
    });
    it("rolls back the first record when a second record is invalid", async () => {
        const job = await lease();
        await stage();
        await expect(commit(job, [record(), record({ sourceId: "invalid-uuid" })])).rejects.toThrow();
        expect((await query("select count(*)::int as count from research_documents"))[0].count).toBe(0);
        expect((await query("select revision::int from research_checkpoints"))[0].revision).toBe(0);
    });
    it("reuses only the current exact version, then tombstones metadata replacements", async () => {
        let job = await lease();
        await stage();
        expect(await commit(job, [record()], "page2")).toBe(true);
        job = await lease();
        expect(await commit(job, [record()], "page3")).toBe(true);
        expect((await query("select count(*)::int as count from research_versions"))[0].count).toBe(1);
        job = await lease();
        await stage("meritus/research/staged/changed");
        expect(await commit(job, [record({ metadata: { kind: "changed" }, objectKey: "meritus/research/staged/changed" })])).toBe(true);
        const versions = await query("select availability,metadata from research_versions order by created_at");
        expect(versions).toHaveLength(2);
        expect(versions[0]).toEqual({ availability: "superseded", metadata: {} });
        expect((await query("select text from research_passages p join research_versions v on p.version_id=v.id where v.availability='superseded'"))[0].text).toBe("");
        expect((await query("select count(*)::int as count from research_invalidations"))[0].count).toBe(1);
    });
    it("advances the watermark to the frozen upper bound only after terminal complete coverage", async () => {
        const job = await lease();
        expect(await commit(job, [], null, false)).toBe(true);
        expect((await query("select status from research_jobs"))[0].status).toBe("incomplete");
        expect((await query("select watermark_at from research_checkpoints"))[0].watermark_at).toBeNull();
        await fixture();
        const completeJob = await lease();
        expect(await commit(completeJob, [])).toBe(true);
        expect(String((await query("select watermark_at from research_checkpoints"))[0].watermark_at)).toMatch(/^2026-02-01/);
    });
    it("refuses writes after cancellation and rights expiry", async () => {
        const job = await lease();
        await query(`select research_cancel_run('${run}')`);
        expect(await commit(job, [])).toBe(false);
        await fixture();
        const next = await lease();
        await query(`update research_rights set expires_at=now() where id='${rights}'`);
        expect(await commit(next, [])).toBe(false);
    });
    it("limits concurrent requests and honours a genuine rolling window", async () => {
        await query(`update research_sources set request_limit=1 where id='${source}'`);
        const results = await Promise.allSettled([concurrent(`select research_reserve_request('${source}','${run}')`), concurrent(`select research_reserve_request('${source}','${run}')`)]);
        expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
        await expect(query(`select research_reserve_request('${source}','${run}')`)).rejects.toThrow(/source_rate_limit/);
        await query("update research_request_reservations set reserved_at=now()-interval '301 seconds'");
        await query(`select research_reserve_request('${source}','${run}')`);
        expect((await query("select requests::int from research_budget_days"))[0].requests).toBe(2);
    });
    it("reserves two model calls, rejects a third and conservatively settles unknown usage once", async () => {
        const a = (await query(`select research_reserve_model('${source}','${run}',100,20) as id`))[0].id;
        await query(`select research_reserve_model('${source}','${run}',100,20)`);
        await expect(query(`select research_reserve_model('${source}','${run}',100,20)`)).rejects.toThrow(/model_capacity/);
        await query(`select research_settle_model('${a}',NULL,NULL)`);
        await query(`select research_settle_model('${a}',0,0)`);
        expect((await query("select tokens::int,pence::int from research_budget_days"))[0]).toEqual({ tokens: 200, pence: 40 });
        expect((await query(`select status from research_model_reservations where id='${a}'`))[0].status).toBe("usage_unknown");
        await query(`select research_reserve_model('${source}','${run}',100,20)`);
    });
    it("withdraws text and metadata while preserving passage tombstones", async () => {
        const job = await lease();
        await stage();
        await commit(job, [record()]);
        const id = (await query("select id from research_documents"))[0].id;
        await query(`select research_withdraw('${id}','test withdrawal')`);
        expect((await query("select status,current_version_id from research_documents"))[0]).toEqual({ status: "withdrawn", current_version_id: null });
        expect((await query("select text from research_passages"))[0].text).toBe("");
        expect((await query("select metadata from research_versions"))[0].metadata).toEqual({});
        expect((await query("select count(*)::int as count from research_invalidations"))[0].count).toBe(1);
    });
    it("dispatches a source once under competing schedulers", async () => {
        const validated = await query(`select id,updated_at::text as "updatedAt" from research_sources where id='${source}'`);
        const command = `select * from research_dispatch(now(),${literal(validated)})`;
        await Promise.all([concurrent(command), concurrent(command)]);
        expect((await query("select count(*)::int as count from research_jobs where scope_key='scheduled'"))[0].count).toBe(1);
    });
});
describe.skipIf(!enabled)("isolated research lifecycle and budget boundaries", () => {
  beforeEach(fixture);
  it("retains incomplete coverage across later pages and prevents stale checkpoint writes", async () => {
    const first = await lease(); await commit(first, [], "last-page", false);
    expect(await commit(first, [])).toBe(false);
    const last = await lease(); await commit(last, []);
    expect((await query("select status from research_runs"))[0].status).toBe("incomplete");
    expect((await query("select watermark_at from research_checkpoints"))[0].watermark_at).toBeNull();
  });
  it("records current-version reuse in immutable run evidence lineage", async () => {
    let job = await lease(); await stage(); await commit(job, [record()], "page-two");
    job = await lease(); await commit(job, [record()]);
    expect((await query("select count(*)::int as count from research_run_documents"))[0].count).toBe(1);
  });
  it("distinguishes absent publisher records and requires fresh IDs after reinstatement", async () => {
    let job = await lease(); await stage(); await commit(job, [record()], "page-two");
    const old = (await query("select current_version_id as id from research_documents"))[0].id;
    job = await lease(); await commit(job, [record({ metadata: { withdrawn: true, availability: "withdrawn", httpStatus: 404 }, passages: [] })], "page-three", false);
    expect((await query("select status,current_version_id from research_documents"))[0]).toEqual({ status: "unavailable", current_version_id: null });
    job = await lease(); await stage("meritus/research/staged/returned"); await commit(job, [record({ objectKey: "meritus/research/staged/returned" })], "page-four");
    expect((await query("select current_version_id as id from research_documents"))[0].id).toBeNull();
    await query("insert into research_reviews(actor,action,target,reason,\"references\") select 'director','reinstate',id,'Reviewed publisher restoration','{}' from research_documents");
    job = await lease(); await commit(job, [record({ objectKey: "meritus/research/staged/returned" })]);
    expect((await query("select current_version_id as id from research_documents"))[0].id).not.toBe(old);
    expect((await query("select text from research_passages where version_id='" + old + "'"))[0].text).toBe("");
  });
  it("refuses silently replacing conflicting payment report rows in one snapshot", async () => {
    await query(`update research_sources set provider='payment-practices' where id='${source}'`);
    let job = await lease(); await stage(); await commit(job, [record({ metadata: { snapshotHash: "snapshot-one" } })], "page-two");
    job = await lease();
    await stage("meritus/research/staged/conflict", "c".repeat(64));
    await expect(commit(job, [record({ metadata: { snapshotHash: "snapshot-one" }, hash: "c".repeat(64), objectKey: "meritus/research/staged/conflict" })])).rejects.toThrow(/duplicate_report_in_snapshot/);
  });
  it("records late excess model usage and blocks future reservations", async () => {
    await query(`update research_sources set daily_pence=30 where id='${source}'`);
    const id = (await query(`select research_reserve_model('${source}','${run}',100,20) as id`))[0].id;
    await query(`select research_settle_model('${id}',100,40)`);
    expect((await query("select pence::int from research_budget_days"))[0].pence).toBe(40);
    await expect(query(`select research_reserve_model('${source}','${run}',1,1)`)).rejects.toThrow(/run_budget|daily_model_budget/);
  });
  it("does not refund expired model reservations and settles the original UTC day", async () => {
    const id = (await query(`select research_reserve_model('${source}','${run}',100,20) as id`))[0].id;
    await query(`update research_model_reservations set expires_at=now()-interval '1 second' where id='${id}'`);
    expect((await query("select pence::int from research_budget_days"))[0].pence).toBe(20);
    await query(`update research_budget_days set day=(now() at time zone 'UTC')::date-1`);
    await query(`update research_model_reservations set day=(now() at time zone 'UTC')::date-1`);
    await query(`select research_settle_model('${id}',80,10)`);
    await query(`select research_reserve_request('${source}','${run}')`);
    expect(await query("select requests::int,pence::int from research_budget_days order by day")).toEqual([{ requests: 0, pence: 10 }, { requests: 1, pence: 0 }]);
  });
  it("shares the Companies House rolling allowance across legacy briefs and research", async () => {
    await query(`update research_sources set provider='companies-house',request_limit=600,window_seconds=300 where id='${source}'`);
    await query("insert into research_legacy_ch_requests(reserved_at) select now() from generate_series(1,599)");
    await query(`select research_reserve_request('${source}','${run}')`);
    await expect(query("select research_reserve_ch_brief()")).rejects.toThrow(/source_rate_limit/);
    await query("update research_legacy_ch_requests set reserved_at=now()-interval '301 seconds'");
    await query("select research_reserve_ch_brief()");
  });
  it("does not replace current content with an older acquisition lacking a source update date", async () => {
    let job = await lease(); await stage(); await commit(job, [record()], "next");
    const original = (await query("select current_version_id as id from research_documents"))[0].id;
    job = await lease(); await stage("meritus/research/staged/older");
    await commit(job, [record({ retrievedAt: "2026-02-01T00:00:00Z", metadata: { kind: "older" }, objectKey: "meritus/research/staged/older" })]);
    expect((await query("select current_version_id as id from research_documents"))[0].id).toBe(original);
  });
  it("checks the exact registered object digest before accepting an evidence record", async () => {
    const job = await lease(); await stage();
    await expect(commit(job, [record({ hash: "c".repeat(64) })])).rejects.toThrow(/unregistered_object/);
    expect((await query("select count(*)::int as count from research_documents"))[0].count).toBe(0);
  });
  it("deduplicates coverage notes across pages and visibly bounds excessive notes", async () => {
    let job = await lease(); await commit(job, [], "page-two", false);
    job = await lease(); await commit(job, [], "page-three", false);
    expect((await query("select coverage->'" + source + "'->'notes' as notes from research_runs"))[0].notes).toEqual(["omitted population"]);
    job = await lease(); const notes = Array.from({ length: 100 }, (_, i) => "note-" + i);
    await query(`select research_commit_page('${job.id}',${job.lease_token},${job.revision},'[]',NULL,${literal({ complete: false, notes })})`);
    const coverage = (await query("select coverage->'" + source + "' as coverage from research_runs"))[0].coverage as { notes: unknown[]; notesTruncated: boolean };
    expect(coverage.notes).toHaveLength(50); expect(coverage.notesTruncated).toBe(true);
  });
  it("reuses unchanged rows across snapshots while retaining per-run acquisition provenance", async () => {
    let job = await lease(); await stage(); await commit(job, [record({ metadata: { kind: "fixture", snapshotHash: "snapshot-one", rowNumber: 1 } })], "page-two");
    job = await lease(); await stage("meritus/research/staged/new-export");
    await commit(job, [record({ metadata: { kind: "fixture", snapshotHash: "snapshot-two", rowNumber: 99 }, objectKey: "meritus/research/staged/new-export" })]);
    expect((await query("select count(*)::int as count from research_versions"))[0].count).toBe(1);
    expect((await query("select metadata from research_versions"))[0].metadata).toEqual({ kind: "fixture" });
    expect((await query("select metadata->>'snapshotHash' as snapshot from research_run_documents"))[0].snapshot).toBe("snapshot-one");
  });
  it("allows scheduled backfills to cross daily request windows without a cumulative cap", async () => {
    await query(`update research_sources set daily_requests=1 where id='${source}'`);
    await query(`select research_reserve_request('${source}','${run}')`);
    await query("update research_budget_days set day=day-1");
    await query("update research_request_reservations set reserved_at=now()-interval '1 day'");
    await query(`select research_reserve_request('${source}','${run}')`);
    expect((await query("select count(*)::int as count from research_request_reservations"))[0].count).toBe(2);
  });
  it("dispatches transformation, metadata and bounded reconciliation together under one source and run", async () => {
    await query(`update research_sources set provider='find-case-law' where id='${source}'`);
    const validated = await query(`select id,updated_at::text as "updatedAt" from research_sources where id='${source}'`);
    await query(`select * from research_dispatch(now(),${literal(validated)})`);
    const jobs = await query("select scope_key,run_id,source_id,payload->'selection'->>'mode' as mode from research_jobs where scope_key like 'scheduled%' order by scope_key");
    expect(jobs).toHaveLength(3); expect(new Set(jobs.map(row => row.run_id)).size).toBe(1); expect(new Set(jobs.map(row => row.source_id)).size).toBe(1);
    expect(jobs.map(row => row.scope_key)).toEqual(["scheduled", "scheduled-metadata", "scheduled-reconcile"]);
  });
  it("does not let a long metadata scan block the next fresh polling and reconciliation window", async () => {
    await query(`update research_sources set provider='find-case-law' where id='${source}'`);
    let validated = await query(`select id,updated_at::text as "updatedAt" from research_sources where id='${source}'`);
    await query(`select * from research_dispatch(now(),${literal(validated)})`);
    const metadata = (await query("select id,run_id from research_jobs where scope_key='scheduled-metadata'"))[0];
    await query("update research_jobs set status='complete' where scope_key in ('scheduled','scheduled-reconcile')");
    await query(`update research_sources set next_due_at=now()-interval '1 second' where id='${source}'`);
    validated = await query(`select id,updated_at::text as "updatedAt" from research_sources where id='${source}'`);
    await query(`select * from research_dispatch(now(),${literal(validated)})`);
    expect((await query("select count(*)::int as count from research_jobs where scope_key='scheduled-metadata'"))[0].count).toBe(1);
    expect((await query("select id,run_id from research_jobs where scope_key='scheduled-metadata'"))[0]).toEqual(metadata);
    expect((await query("select count(*)::int as count from research_jobs where scope_key in ('scheduled','scheduled-reconcile') and status='queued'"))[0].count).toBe(2);
  });
  it("marks a run finished when its final expired lease exhausts all retries", async () => {
    await lease(); await query("update research_jobs set attempts=5,lease_expires_at=now()-interval '1 second'");
    await lease();
    expect((await query("select status,error_code from research_jobs"))[0]).toEqual({ status: "failed", error_code: "attempts_exhausted" });
    const result = (await query("select status,finished_at from research_runs"))[0];
    expect(result.status).toBe("incomplete"); expect(result.finished_at).not.toBeNull();
  });
  it("retains documentary passage ordering and rotates absent-record reconciliation", async () => {
    let job = await lease(); await stage(); await commit(job, [record({ metadata: { kind: "fixture", passageOrder: ["paragraph:1"] } })], "next");
    expect((await query("select metadata->'passageOrder' as ordering from research_versions"))[0].ordering).toEqual(["paragraph:1"]);
    await query("update research_documents set availability_checked_at=now()-interval '2 days'");
    job = await lease(); await commit(job, [record({ metadata: { withdrawn: true, httpStatus: 404 }, passages: [] })]);
    expect((await query("select availability_checked_at>now()-interval '1 minute' as checked from research_documents"))[0].checked).toBe(true);
  });
  it("keeps independent source scopes from poisoning each other's watermark", async () => {
    await query(`select research_enqueue('${source}','other','fetch','{"window":{"from":"2026-01-01","to":"2026-02-01"}}','other','${run}')`);
    const first = await lease(); await commit(first, [], null, false);
    const second = await lease(); await commit(second, []);
    expect((await query("select watermark_at from research_checkpoints where scope_key='" + second.scope_key + "'"))[0].watermark_at).not.toBeNull();
    expect((await query("select coverage->'" + source + "'->>'complete' as complete from research_runs"))[0].complete).toBe("false");
    expect((await query("select status from research_runs"))[0].status).toBe("incomplete");
  });
  it("accepts genuine registered import provenance and refuses a forged source key", async () => {
    await stage("meritus/research/staged/original-import"); await stage();
    let job = await lease();
    await commit(job, [record({ url: "research-object:meritus/research/staged/original-import", metadata: { import: true, sourceObjectKey: "meritus/research/staged/original-import" } })], "next");
    expect((await query("select canonical_url from research_documents"))[0].canonical_url).toBe("research-object:meritus/research/staged/original-import");
    job = await lease();
    await expect(commit(job, [record({ providerId: "forged", url: "research-object:meritus/research/staged/missing", metadata: { import: true, sourceObjectKey: "meritus/research/staged/missing" } })])).rejects.toThrow(/invalid_record/);
  });
  it("shares the Find Case Law allowance across separately configured source records", async () => {
    await query(`update research_sources set provider='find-case-law',request_limit=2000 where id='${source}'`);
    await query(`insert into research_request_reservations(source_id,run_id) select '${source}','${run}' from generate_series(1,1000)`);
    await expect(query(`select research_reserve_request('${source}','${run}')`)).rejects.toThrow(/source_rate_limit/);
  });
  it("licence termination prevents new reservations and tombstones evidence", async () => {
    const job = await lease(); await stage(); await commit(job, [record()], "later");
    await query(`select research_terminate_source('${source}','licence terminated')`);
    expect((await query("select status from research_sources"))[0].status).toBe("paused");
    expect((await query("select status from research_documents"))[0].status).toBe("withdrawn");
    await expect(query(`select research_reserve_request('${source}','${run}')`)).rejects.toThrow(/source_unavailable/);
    expect(await commit(job, [])).toBe(false);
  });
});

describe.skipIf(!enabled || !process.env.RESEARCH_TEST_WITH_WORKFLOW)("commissioned investigation integration", () => {
  beforeEach(fixture);
  it("completes an actual commissioned run without inheriting its Queued coverage placeholder", async () => {
    const scope = { sources: [source] };
    const payloads = { [source]: { window: { from: "2026-01-01", to: "2026-02-01" }, selection: {} } };
    const result = (await query(`select research_commission('director','00000000-0000-4000-8000-000000000099','test-hash','Commissioned question',${literal(scope)},' {"maxRequests":10,"maxTokens":1000,"maxCostPence":100}',${literal(payloads)}) as commissioned`))[0].commissioned as { investigationId: string; runId: string };
    const job = await lease(); expect(job.run_id).toBe(result.runId);
    await commit(job, []);
    expect((await query("select status,coverage->'" + source + "'->>'complete' as complete from research_runs where id='" + result.runId + "'"))[0]).toEqual({ status: "complete", complete: "true" });
    expect((await query("select latest_completed_run_id as run from research_investigations where id='" + result.investigationId + "'"))[0].run).toBe(result.runId);
  });
});

describe.skipIf(!enabled || !process.env.RESEARCH_TEST_WITH_WATCHLISTS)("durable watchlist refresh integration", () => {
  const watchId = "00000000-0000-4000-8000-000000000071";
  const memberId = "00000000-0000-4000-8000-000000000072";
  const entityId = "00000000-0000-4000-8000-000000000073";
  beforeEach(async () => {
    await fixture(); await query("truncate research_watchlists,research_entities cascade");
    await query(`update research_sources set provider='companies-house' where id='${source}'`);
    await query(`insert into research_entities(id,kind,display_name,confirmed) values('${entityId}','company','Confirmed Construction Limited',true)`);
    await query(`insert into research_identifiers(entity_id,scheme,value,source_id,verified) values('${entityId}','uk-company-number','SC000123','${source}',true)`);
    const proofJob = await lease(); await stage(); await commit(proofJob, [record()]);
    await query(`insert into research_rights select (jsonb_populate_record(null::research_rights,to_jsonb(r)||'{"id":"00000000-0000-4000-8000-000000000075"}'::jsonb)).* from research_rights r where id='${rights}'`);
    await query(`insert into research_sources select (jsonb_populate_record(null::research_sources,to_jsonb(s)||'{"id":"00000000-0000-4000-8000-000000000074","rights_id":"00000000-0000-4000-8000-000000000075"}'::jsonb)).* from research_sources s where id='${source}'`);
    await query("update research_documents set source_id='00000000-0000-4000-8000-000000000074'");
    await query(`insert into research_identifier_evidence(identifier_id,document_id,version_id,passage_id,reviewed_by,reason) select i.id,p.document_id,p.version_id,p.passage_id,'director','Confirmed company identifier' from research_identifiers i cross join research_available_passages p where i.entity_id='${entityId}'`);
    await query(`insert into research_watchlists(id,label,owner,cadence_seconds,timezone,sources,signal_preferences,enabled,revision) values('${watchId}','Watch','director',3600,'Europe/London','["${source}"]','[]',true,0)`);
    await query(`insert into research_watchlist_members(id,watchlist_id,entity_id,next_refresh_at) values('${memberId}','${watchId}','${entityId}',now()-interval '1 second')`);
  });
  async function candidate(error: string | null = null) {
    const m = (await query(`select m.updated_at::text as "updatedAt",e.updated_at::text as "entityUpdatedAt",s.updated_at::text as "sourceUpdatedAt",now()::text as now from research_watchlist_members m,research_entities e,research_sources s where m.id='${memberId}' and e.id='${entityId}' and s.id='${source}'`))[0];
    const payload = { window: { from: "2026-01-01T00:00:00Z", to: m.now }, selection: { companyNumber: "SC000123" }, watchlistId: watchId, watchlistMemberId: memberId, entityId };
    return { now: m.now, members: [{ id: memberId, watchlistId: watchId, revision: 0, updatedAt: m.updatedAt, entityId, entityUpdatedAt: m.entityUpdatedAt, sources: [{ id: source, updatedAt: m.sourceUpdatedAt, payload: error ? null : payload, error }] }] };
  }
  it("enqueues once under competing schedulers and advances the member cadence atomically", async () => {
    const c = await candidate(); const command = `select research_dispatch_watchlists('${c.now}',${literal(c.members)})`;
    await Promise.all([concurrent(command), concurrent(command)]);
    expect((await query("select count(*)::int as count from research_jobs where scope_key='watchlist:" + memberId + "'"))[0].count).toBe(1);
    expect((await query("select next_refresh_at>now()+interval '50 minutes' as scheduled from research_watchlist_members"))[0].scheduled).toBe(true);
  });
  it("records unavailable configuration without manufacturing a successful run", async () => {
    const c = await candidate("credential_missing"); await query(`select research_dispatch_watchlists('${c.now}',${literal(c.members)})`);
    expect((await query("select status,reason from research_watchlist_refreshes"))[0]).toEqual({ status: "unavailable", reason: "credential_missing" });
    expect((await query("select count(*)::int as count from research_jobs where scope_key like 'watchlist:%'"))[0].count).toBe(0);
  });
  it("rejects stale watchlist revisions and changed verified identifiers", async () => {
    const c = await candidate(); await query("update research_watchlists set revision=1");
    await query(`select research_dispatch_watchlists('${c.now}',${literal(c.members)})`);
    expect((await query("select count(*)::int as count from research_watchlist_refreshes"))[0].count).toBe(0);
    await query("update research_watchlists set revision=0"); await query("update research_identifiers set verified=false");
    await query(`select research_dispatch_watchlists('${c.now}',${literal(c.members)})`);
    expect((await query("select reason from research_watchlist_refreshes"))[0].reason).toBe("verified_company_number_required");
  });
  it("rejects an identifier whose proof rights expired while its verified flag remains true", async () => {
    const c = await candidate();
    await query("update research_rights set expires_at=now()-interval '1 second' where id='00000000-0000-4000-8000-000000000075'");
    expect((await query("select verified from research_identifiers"))[0].verified).toBe(true);
    await query(`select research_dispatch_watchlists('${c.now}',${literal(c.members)})`);
    expect((await query("select reason from research_watchlist_refreshes"))[0].reason).toBe("verified_company_number_required");
    expect((await query("select count(*)::int as count from research_jobs where scope_key like 'watchlist:%'"))[0].count).toBe(0);
  });
  it("cancels work and fences its writer when a member is removed", async () => {
    const c = await candidate(); await query(`select research_dispatch_watchlists('${c.now}',${literal(c.members)})`);
    await query(`delete from research_watchlist_members where id='${memberId}'`);
    expect((await query("select status,lease_token::int as token from research_jobs where scope_key='watchlist:" + memberId + "'"))[0]).toEqual({ status: "cancelled", token: 1 });
    expect((await query("select count(*)::int as count from research_watchlist_refreshes"))[0].count).toBe(0);
  });
});

describe.skipIf(!url)("Neon HTTP repository adapter", () => {
    it("uses the same request context and atomic lease API as production", async () => {
        assertIsolated();
        await fixture();
        const repository = createResearchRepository(drizzle(neon(url!)));
        await withResearchRun(run, () => repository.reserveSourceRequest(source));
        const job = await repository.leaseResearchJob("neon-http-worker");
        expect(job?.sourceId).toBe(source);
        expect(job?.revision).toBe(0);
        await repository.cancelResearchRun(run);
        expect(await repository.commitResearchPage({ jobId: job!.id, leaseToken: job!.leaseToken, expectedRevision: job!.revision, page: { records: [], nextCursor: null, coverage: { complete: true, notes: [] } }, records: [] })).toBe(false);
    });
});
