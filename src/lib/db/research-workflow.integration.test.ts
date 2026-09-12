import { beforeEach, describe, it, expect,vi } from "vitest";
import { parse as parseCsv } from 'csv-parse/sync';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
vi.mock('./index',()=>({requireDb:()=>({execute:async(statement:SQL)=>{const compiled=new PgDialect().sqlToQuery(statement);const body=compiled.sql.replace(/\$(\d+)/g,(_match,n)=>{const v=compiled.params[Number(n)-1];return v===null?'NULL':typeof v==='number'?String(v):typeof v==='boolean'?String(v):"'"+String(v).replaceAll("'","''")+"'";});return {rows:query(body)};}})}));
vi.mock('@/lib/research/roles',()=>({requireResearchDirector:async()=> 'director',readResearchActor:async()=>({role:'director'})}));
import { createCalendarEntry,listCalendarEntries,createReferral,listReferrals,researchEvidence,saveWatchlist,listWatchlists,deleteResearchWatchlist } from './research-workflow';
import { execFileSync, spawn } from "node:child_process";
const container = process.env.RESEARCH_WORKFLOW_TEST_CONTAINER;
function query(statement: string): Record<string, unknown>[] {
  if (!container || !/^qcs-research-test(?:-[a-z0-9]+)?$/.test(container))
    throw new Error("Isolated workflow test container required");
  const output = execFileSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "research_test",
      "-d",
      "research_workflow_test",
      "-v",
      "ON_ERROR_STOP=1",
      "-q", "--csv", "--pset", "null=__QCS_SQL_NULL__",
    ],
    {
      input: "set client_min_messages=warning;" + statement + ";",
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    },
  ).trim();
  if(!output)return [];return parseCsv(output,{columns:true,skip_empty_lines:true,cast:(v:string,context:{header:boolean})=>{if(context.header)return v;if(v==='__QCS_SQL_NULL__')return null;if(v==='t'||v==='f')return v==='t';if(/^-?\d+(?:\.\d+)?$/.test(v))return Number(v);if(v.startsWith('{')||v.startsWith('[')){try{return JSON.parse(v);}catch{return v;}}return v;}}) as Record<string,unknown>[];
}
function concurrent(statement: string) {
  return new Promise<string>((resolve, reject) => {
    const p = spawn("docker", [
      "exec",
      "-i",
      container!,
      "psql",
      "-U",
      "research_test",
      "-d",
      "research_workflow_test",
      "-v",
      "ON_ERROR_STOP=1",
      "-qAt",
    ]);
    let out = "",
      err = "";
    p.stdout.on("data", (v) => (out += v));
    p.stderr.on("data", (v) => (err += v));
    p.on("close", (code) =>
      code ? reject(new Error(err)) : resolve(out.trim()),
    );
    p.stdin.end(statement + ";");
  });
}
const ids = {
  source: "10000000-0000-4000-8000-000000000001",
  rights: "10000000-0000-4000-8000-000000000002",
  entity: "10000000-0000-4000-8000-000000000003",
  document: "10000000-0000-4000-8000-000000000004",
  version: "10000000-0000-4000-8000-000000000005",
  passage: "10000000-0000-4000-8000-000000000006",
  request: "10000000-0000-4000-8000-000000000007",
};
const json = (v: unknown) =>
  `'${JSON.stringify(v).replaceAll("'", "''")}'::jsonb`;
const refs = [
  { documentId: ids.document, versionId: ids.version, passageId: ids.passage },
];
let investigationId = "",
  runId = "",
  signalId = "",
  reviewId = "";
function commission(hash = "hash") {
  return query(
    `select research_commission('director','${ids.request}','${hash}','Test question',${json({ kind: "organisation", subject: "Synthetic Works", entityId: ids.entity, jurisdiction: "England and Wales", from: null, to: null, sources: [ids.source] })},' {"maxRequests":100,"maxTokens":100000,"maxCostPence":1000}',${json({ [ids.source]: { window: { from: "2026-01-01T00:00:00Z", to: "2026-09-12T00:00:00Z" }, selection: {} } })}) as result`,
  )[0].result as { investigationId: string; runId: string };
}
function fixture() {
  query(
    "truncate research_rights,research_runs,research_entities,research_investigations,pursuits,research_reviews cascade",
  );
  query(
    `insert into research_rights(id,holder,material,purpose,agreement_ref,agreement_hash,effective_at,transfer_conditions,retention_instructions,withdrawal_instructions,use_assessment) values('${ids.rights}','QCS','synthetic','test','test','test',now()-interval '1 day','{}','{}','{}','test')`,
  );
  query(
    `insert into research_sources(id,label,provider,hosts,access_method,terms_url,terms_version,terms_reviewed_at,attribution,operator,purpose,rights_id,status,selection,backfill_start,cadence_seconds,freshness_seconds,request_limit,window_seconds,daily_requests,daily_tokens,daily_pence) values('${ids.source}','Synthetic source','find-a-tender','["example.com"]','public','https://example.com','1',now(),'Synthetic attribution','QCS','test','${ids.rights}','ready','{}','2026-01-01',86400,172800,10,60,100,100000,1000)`,
  );
  query(
    `insert into research_entities(id,kind,display_name,confirmed) values('${ids.entity}','company','Synthetic Works',true)`,
  );
  ({ investigationId, runId } = commission());
  query(
    `insert into research_documents(id,source_id,provider_id,canonical_url,status,availability_checked_at) values('${ids.document}','${ids.source}','synthetic','https://example.com/record','available',now())`,
  );
  query(
    `insert into research_versions(id,document_id,hash,retrieved_at,event_at,content_type,parser_version,metadata) values('${ids.version}','${ids.document}','hash',now(),now(),'text/plain','1','{"title":"Synthetic record"}')`,
  );
  query(
    `update research_documents set current_version_id='${ids.version}' where id='${ids.document}'`,
  );
  query(
    `insert into research_passages(id,version_id,locator,text,hash) values('${ids.passage}','${ids.version}','{"kind":"paragraph","value":"1"}','The employer delayed payment.','hash')`,
  );
  query(
    `insert into research_run_documents(run_id,document_id,version_id) values('${runId}','${ids.document}','${ids.version}')`,
  );
  const claim = String(
    query(
      `select research_add_claim('${investigationId}','${ids.entity}',${json({ text: "The employer delayed payment.", kind: "observation", evidence: refs })},'director') as id`,
    )[0].id,
  );
  signalId = String(
    query(
      `insert into research_signals(investigation_id,entity_id,event_key,event_type,kind,occurred_at,confidence,half_life_days,independence_confirmed,scoring_version,components,score,scored_at,status,stale,revision) values('${investigationId}','${ids.entity}','synthetic-event','Payment delay','direct',now(),0.9,90,false,'qcs_priority_v1','{}',36,now(),'unreviewed',false,0) returning id`,
    )[0]?.id ?? "",
  );
  // INSERT RETURNING is selected via a CTE so the JSON wrapper preserves its row.
  if (!signalId)
    signalId = String(query("select id from research_signals")[0].id);
  query(
    `insert into research_signal_claims(signal_id,claim_id) values('${signalId}','${claim}')`,
  );
  reviewId = String(
    query(
      `select research_review_signal('${signalId}','director',0,'approve','Reviewed the supporting original record',true) as id`,
    )[0].id,
  );
}
function conversion() {
  return `select research_convert_signal('${signalId}','director','director','${reviewId}','Specific single-event exception reviewed by director')`;
}
describe.skipIf(!container)("isolated workflow SQL invariants", () => {
  beforeEach(fixture);
  it("returns the same investigation for retries and rejects a changed request body", () => {
    const again = commission();
    expect(again).toEqual({ investigationId, runId });
    expect(() => commission("changed")).toThrow(/idempotency_conflict/);
    expect(
      query("select count(*)::int as n from research_investigations")[0].n,
    ).toBe(1);
  });
  it("checks the entire citation tuple, but permits cached evidence while polling is paused", () => {
    expect(() =>
      query(
        `select research_assert_evidence(${json([{ ...refs[0], documentId: ids.entity }])})`,
      ),
    ).toThrow(/evidence_unavailable/);
    query(
      `update research_sources set status='paused' where id='${ids.source}'`,
    );
    expect(() =>
      query(`select research_assert_evidence(${json(refs)})`),
    ).not.toThrow();
  });
  it("serialises concurrent conversion without duplicate pursuits and requires corroboration or a reason", async () => {
    expect(() =>
      query(
        `select research_convert_signal('${signalId}','director','director','${reviewId}',null)`,
      ),
    ).toThrow(/single_event_reason_required/);
    const results = await Promise.all([
      concurrent(conversion()),
      concurrent(conversion()),
    ]);
    expect(results).toHaveLength(2);
    expect(query("select count(*)::int as n from pursuits")[0].n).toBe(1);
    expect(
      query("select count(*)::int as n from research_conversions")[0].n,
    ).toBe(1);
  });
  it("withdraws generated summaries, answers, briefs and marked notes while preserving manual notes and rejecting late writes", () => {
    const converted = query(conversion() + " as result")[0].result as {
        pursuitId: string;
      },
      p = converted.pursuitId;
    query(
      `update pursuits set summary='Director edited the derived quotation' where id='${p}'`,
    );
    query(
      `insert into activity(id,pursuit_id,kind,actor_id,body) values('manual','${p}','note','director','Separate manual note')`,
    );
    query(
      `select research_write_derived_note('${p}','director','Generated research note')`,
    );
    query(
      `insert into briefs(id,pursuit_id,created_by,status,summary) values('brief','${p}','director','complete','Generated brief quotation')`,
    );
    const messages = [
      { role: "user", content: "Question" },
      { role: "assistant", content: "Research quotation", sources: [] },
    ];
    query(`select research_write_pursuit_questions('${p}',${json(messages)})`);
    query(
      `update research_documents set status='withdrawn' where id='${ids.document}'`,
    );
    expect(
      query(`select research_pursuit_available('${p}') as available`)[0]
        .available,
    ).toBe(false);
    query(`select research_invalidate_workflow('${ids.version}')`);
    expect(
      query(`select summary from pursuits where id='${p}'`)[0].summary,
    ).toBeNull();
    expect(query("select count(*)::int as n from questions")[0].n).toBe(0);
    expect(query("select body from activity where id='manual'")[0].body).toBe(
      "Separate manual note",
    );
    expect(
      query(
        "select body from activity where meta->>'researchDerived'='true'",
      )[0].body,
    ).toBeNull();
    expect(
      query(
        `select research_write_pursuit_questions('${p}',${json(messages)}) as ok`,
      )[0].ok,
    ).toBe(false);
    expect(
      query(
        `select research_write_derived_note('${p}','director','Late generated quotation') as ok`,
      )[0].ok,
    ).toBe(false);
    expect(
      query(
        `select research_complete_pursuit_brief('brief','{"summary":"Late quotation"}') as ok`,
      )[0].ok,
    ).toBe(false);
    expect(
      query("select summary from briefs where id='brief'")[0].summary,
    ).toBeNull();
  });
  it("rejects late assistant writes after run cancellation or source withdrawal", () => {
    query(`update research_runs set status='running' where id='${runId}'`);
    const write = `select research_store_answer('${investigationId}','${runId}','director','Question','{"findings":[]}',${json(refs)},'test','1')`;
    query(`update research_runs set status='cancelled' where id='${runId}'`);
    expect(() => query(write)).toThrow(/run_not_running/);
    query(`update research_runs set status='running' where id='${runId}'`);
    query(
      `update research_documents set status='withdrawn' where id='${ids.document}'`,
    );
    expect(() => query(write)).toThrow(/evidence_unavailable/);
    expect(
      query("select count(*)::int as n from research_conversations")[0].n,
    ).toBe(0);
  });
});

describe.skipIf(!container)('workflow repository statements on isolated Postgres',()=>{
 beforeEach(fixture);
 it('limits investigation evidence to its recorded retrieval lineage',async()=>{expect(await researchEvidence(investigationId)).toHaveLength(1);query(`delete from research_run_documents where run_id='${runId}'`);expect(await researchEvidence(investigationId)).toHaveLength(0);});
 it('writes dates and referrals through exact evidence guards and hides them immediately on withdrawal',async()=>{await createCalendarEntry({investigationId,entityId:ids.entity,kind:'limitation',date:'2027-09-12',evidence:refs,jurisdiction:'England and Wales',rule:'A reviewed rule',accrualBasis:'Reviewed accrual basis',assumptions:'Provisional source-derived assumptions',reviewed:true});await createReferral({subjectId:ids.entity,objectId:ids.entity,predicate:'Retains adviser',evidence:refs,channel:'solicitor',serviceOffer:'Evidence review',stage:'researched',observedAt:'2026-09-12T00:00:00Z',confidence:0.9});expect(await listCalendarEntries()).toHaveLength(1);expect(await listReferrals()).toHaveLength(1);query(`update research_documents set status='withdrawn' where id='${ids.document}'`);expect(await listCalendarEntries()).toHaveLength(0);expect(await listReferrals()).toHaveLength(0);query(`select research_invalidate_workflow('${ids.version}')`);expect(query('select assumptions,rule from research_calendar')[0]).toEqual({assumptions:'',rule:null});expect(query('select predicate,service_offer from research_relationships')[0]).toEqual({predicate:'',service_offer:''});});
 it('returns watchlist source refresh status and removes monitoring on director deletion',async()=>{const id=await saveWatchlist({label:'Synthetic watch',cadenceSeconds:86400,sources:[ids.source],signalPreferences:['direct'],entityIds:[ids.entity],enabled:true});expect(await listWatchlists()).toHaveLength(1);await deleteResearchWatchlist(id);expect(await listWatchlists()).toHaveLength(0);});
});
