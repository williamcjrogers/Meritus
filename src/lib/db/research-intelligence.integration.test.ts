// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
const container = process.env.RESEARCH_INTELLIGENCE_TEST_CONTAINER;
const database = 'research_intelligence_test';
function psql(statement: string, db = database): string {
  if (!container || !/^qcs-research-test(?:-[a-z0-9]+)?$/.test(container)) throw new Error('isolated_test_container_required');
  return execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'research_test', '-d', db, '-v', 'ON_ERROR_STOP=1', '-qAt'], { input: statement, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }).trim();
}
const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const refs = JSON.stringify([{ documentId: id(3), versionId: id(4), passageId: id(5) }]);
describe.skipIf(!container)('isolated research intelligence lifecycle', () => {
  beforeAll(() => {
    const exists = psql(`select 1 from pg_database where datname='${database}'`, 'research_test');
    if (!exists) psql(`create database ${database}`, 'research_test');
    // This fixed test database is independent of the foundation/source/workflow fixtures.
    psql('drop schema public cascade; create schema public;');
    const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json','utf8')) as { entries: { idx: number; tag: string }[] };
    psql('begin;\n' + journal.entries.filter(e => e.idx <= 6).map(e => readFileSync(`drizzle/${e.tag}.sql`,'utf8')).join('\n') + '\ncommit;');
  });
  beforeEach(() => {
    psql(`truncate research_signal_decisions,research_indexes,research_weekly_digests,research_entities,research_investigations,research_rights,research_runs,research_reviews cascade;
insert into research_rights(id,holder,material,purpose,agreement_ref,agreement_hash,effective_at,transfer_conditions,retention_instructions,withdrawal_instructions,use_assessment) values('${id(1)}','QCS','synthetic','test','test','test',now()-interval '1 day','{}','{}','{}','test');
insert into research_sources(id,label,provider,hosts,access_method,terms_url,terms_version,terms_reviewed_at,attribution,operator,purpose,rights_id,status,backfill_start,cadence_seconds,freshness_seconds,request_limit,window_seconds,daily_requests,daily_tokens,daily_pence) values('${id(2)}','Synthetic','find-a-tender','["example.com"]','public','https://example.com','1',now(),'Test','QCS','test','${id(1)}','ready','2026-01-01',86400,172800,10,60,100,100000,1000);
insert into research_entities(id,kind,display_name,confirmed) values('${id(6)}','company','Synthetic Works',true);
insert into research_investigations(id,question,scope,owner,budget) values('${id(7)}','Synthetic question','{}','director','{}');
insert into research_documents(id,source_id,provider_id,canonical_url,availability_checked_at) values('${id(3)}','${id(2)}','synthetic','https://example.com/record',now());
insert into research_versions(id,document_id,hash,retrieved_at,content_type,parser_version,metadata) values('${id(4)}','${id(3)}','hash',now(),'text/plain','1','{}');
update research_documents set current_version_id='${id(4)}' where id='${id(3)}';
insert into research_passages(id,version_id,locator,text,hash) values('${id(5)}','${id(4)}','{"kind":"paragraph","value":"1"}','Source observation','hash');
insert into research_claims(id,investigation_id,text,kind,status,availability,revision) values('${id(8)}','${id(7)}','Source observation','observation','verified','available',0);
insert into research_claim_evidence(claim_id,document_id,version_id,passage_id,relation) values('${id(8)}','${id(3)}','${id(4)}','${id(5)}','supporting');
insert into research_signals(id,investigation_id,entity_id,event_key,event_type,kind,occurred_at,confidence,half_life_days,independence_confirmed,scoring_version,components,score,scored_at,status,stale,revision) select x,'${id(7)}','${id(6)}',x::text,'Event','direct',now(),1,90,true,'v1','{}',40,now(),'reviewed',false,0 from unnest(array['${id(9)}'::uuid,'${id(10)}'::uuid]) x;
insert into research_signal_claims(signal_id,claim_id) values('${id(9)}','${id(8)}'),('${id(10)}','${id(8)}');`);
  });
  it('records equivalent events once and clears both prior reviews', () => {
    psql(`select research_decide_signal('${id(9)}',0,'director','merge','Same underlying appointment event',null,null,'${id(10)}','${refs}')`);
    expect(psql(`select count(distinct event_key)||':'||count(*) filter(where status='unreviewed' and review_id is null and not independence_confirmed) from research_signals`)).toBe('1:2');
    expect(() => psql(`select research_decide_signal('${id(9)}',0,'director','annotate','A stale revision must fail',null,null,null,'${refs}')`)).toThrow();
    expect(psql('select count(*) from research_signal_decisions')).toBe('1');
  });
  it('erases source-derived decisions and indexes as availability changes', () => {
    psql(`select research_decide_signal('${id(9)}',0,'director','annotate','A source-derived director note',null,null,null,'${refs}'); insert into research_indexes(investigation_id,kind,specification,summary,evidence,actor) values('${id(7)}','adjudication','{"population":"source prose"}','{"numerator":1}','${refs}','director'); update research_versions set availability='withdrawn' where id='${id(4)}'`);
    expect(psql('select length(note) from research_signal_decisions')).toBe('0');
    expect(psql("select (specification='{}'::jsonb and summary='{}'::jsonb) from research_indexes")).toBe('t');
    expect(() => psql(`select research_decide_signal('${id(9)}',1,'director','annotate','Late content must fail',null,null,null,'${refs}')`)).toThrow();
  });
  it('creates one weekly digest, storing references and coverage without copied source text', () => {
    psql("select research_refresh_intelligence('2026-09-12T00:00:00Z'); select research_refresh_intelligence('2026-09-13T00:00:00Z');");
    expect(psql('select count(*) from research_weekly_digests')).toBe('1');
    expect(psql('select jsonb_array_length(signal_ids) from research_weekly_digests')).toBe('2');
    expect(psql('select row_to_json(d)::text from research_weekly_digests d')).not.toContain('Source observation');
  });
});
