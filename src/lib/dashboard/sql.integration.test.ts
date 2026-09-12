// @vitest-environment node
import { beforeEach,describe,expect,it,vi } from 'vitest';
import { compileSql,homeTestEnabled,runSql } from '@/lib/db/desk-actions-test-db';
import type { SQL } from 'drizzle-orm';
const mocks=vi.hoisted(()=>({rows:vi.fn(),fixture:''}));
vi.mock('@/lib/db/research-workflow',()=>({workflowRows:mocks.rows,maskResearchPursuitSummaries:async(rows:unknown)=>rows}));
vi.mock('@/lib/db/index',()=>({requireDb:()=>({execute:async(q:SQL)=>({rows:execute(q)})})}));
vi.mock('@/lib/research/roles',()=>({requireResearchDirector:async()=>'director'}));
vi.mock('@/lib/portal/directors',()=>({readDirectorDirectory:async()=>({available:true,directors:[]}),directorName:(_:unknown,id:string|null)=>id??'Unassigned'}));
import {readProgrammeSummary,readProspectSummary,readLeadSummary} from './context';
import {readResearchAgenda,readResearchSummary} from './research';
import {readActionSummary,readRecentProgress,readTeamAccountability} from './read';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const workspace='51435300-0000-4000-8000-000000000001';
const w={today:'2026-09-12',upcomingEnd:'2026-09-19',agendaEnd:'2026-09-26',recentStart:'2026-09-06',requestTime:'2026-09-12T15:00:00Z'};
const execute=(q:SQL)=>JSON.parse(runSql(`begin; ${mocks.fixture}\n select coalesce(json_agg(result),'[]'::json)::text from (${compileSql(q)}) result; rollback;`));
// Temporary fixtures exist only in this connection and never reset the shared test schema.
describe.skipIf(!homeTestEnabled)('dashboard real PostgreSQL queries',()=>{
 beforeEach(()=>{mocks.fixture='';mocks.rows.mockImplementation(async(q:SQL)=>execute(q));});
 it('executes shared action visibility, lead counts, research totals and progress against the migrated schema',async()=>{
  await expect(readActionSummary('director','mine',w)).resolves.toHaveProperty('counts');
  await expect(readTeamAccountability(w)).resolves.toBeInstanceOf(Array);
  await expect(readLeadSummary('director','team')).resolves.toHaveProperty('stages');
  await expect(readResearchSummary('director','team',w)).resolves.toHaveProperty('runningInvestigations');
  await expect(readRecentProgress(w)).resolves.toBeInstanceOf(Array);
 });
 it('keeps complete action counts, all overdue ages, mine ownership and independent unassigned totals',async()=>{
  mocks.fixture=`create temp table desk_actions (like public.desk_actions including defaults); create temp table desk_action_priorities as select * from public.desk_action_priorities where false;
  insert into desk_actions(id,title,owner_id,due_date,state,created_by) select gen_random_uuid(),'Old overdue','director','2020-01-01','todo','director' from generate_series(1,17);
  insert into desk_actions(id,title,owner_id,due_date,state,created_by) values('${id(81)}','Other owner',null,'2026-09-12','todo','director'),('${id(82)}','Undated','director',null,'todo','director');`;
  const mine=await readActionSummary('director','mine',w);expect(mine.counts).toEqual({open:18,overdue:17,today:0,upcoming:0,undated:1,unassigned:0});expect(mine.rows).toHaveLength(8);expect(mine.unassignedTeam).toBe(1);
 });
 it('excludes parked, converted, prohibited and already-linked prospects from availability',async()=>{
  mocks.fixture=`create temp table prospects(outreach_status text,conflict_tier text,converted_pursuit_id text); insert into prospects values('unworked','latent_conflict',null),('converted','latent_conflict',null),('parked','latent_conflict',null),('do_not_approach','latent_conflict',null),('unworked','latent_conflict','lead'),('unworked','active_conflict',null);`;
  expect(await readProspectSummary()).toMatchObject({availableToApproach:1,statuses:{unworked:3,converted:1,parked:1,do_not_approach:1}});
 });
 it('uses a newer failed report ahead of the older successful attempt',async()=>{
  mocks.fixture=`create temp table programmes(id text,parse_status text,pursuit_id text);create temp table programme_reports(id text,programme_id text,status text,created_at timestamptz);insert into programmes values('p','complete',null);insert into programme_reports values('r1','p','complete','2026-09-10'),('r2','p','failed','2026-09-11');`;
  expect(await readProgrammeSummary()).toEqual({uploaded:1,analysed:0,analysing:0,analysisFailed:1,parseNeedsAttention:0});
 });
 it('excludes provisional, unsupported and active record or entity suppression while accepting null entities, revoked and expired suppressions',async()=>{
  // Tables mirror only the columns selected, leaving the real SQL to perform all filtering.
  mocks.fixture=`create temp table research_investigations(id uuid,workspace_id uuid,owner text);create temp table research_entities(id uuid,workspace_id uuid,display_name text);create temp table research_calendar(id uuid,workspace_id uuid,investigation_id uuid,entity_id uuid,kind text,proposed_date date,state text,reviewed_by text,evidence jsonb,assumptions text);create temp table research_available_passages(workspace_id uuid,document_id uuid,version_id uuid,passage_id uuid);create temp table research_suppressions(workspace_id uuid,target uuid,revoked_at timestamptz,expires_at timestamptz);
  insert into research_investigations values('${id(20)}','${workspace}','director');insert into research_available_passages values('${workspace}','${id(21)}','${id(22)}','${id(23)}');`;
  const evidence=JSON.stringify([{documentId:id(21),versionId:id(22),passageId:id(23)}]);
  for(let n=30;n<38;n++) mocks.fixture+=`insert into research_calendar values('${id(n)}','${workspace}','${id(20)}',${n===37?`'${id(90)}'`:'null'},'review','2026-09-13','${n===31?'provisional':'reviewed'}',${n===36?'null':"'director'"},'${n===32?'[]':evidence}','Synthetic assumption');`;
  mocks.fixture+=`insert into research_suppressions values('${workspace}','${id(33)}',null,null),('${workspace}','${id(34)}','2026-09-01',null),('${workspace}','${id(35)}',null,'2026-09-12T14:00:00Z'),('${workspace}','${id(90)}',null,null);`;
  expect((await readResearchAgenda('director','team',w)).map(r=>r.id)).toEqual([id(30),id(34),id(35)]);
  mocks.fixture+=`delete from research_available_passages;`;expect(await readResearchAgenda('director','team',w)).toEqual([]);
 });
 it('keeps closed leads in stage totals while reserving all six exception slots for active leads',async()=>{
  mocks.fixture=`set local jit=off; create temp table pursuits(id text,firm text,stage text,owner_id text,created_at timestamptz);create temp table desk_actions (like public.desk_actions including defaults);
  insert into pursuits select 'closed-'||n,'Closed organisation '||n,case when n%2=0 then 'declined' else 'instructed' end,null,'2020-01-01' from generate_series(1,8) n;
  insert into pursuits select 'active-'||n,'Active organisation '||n,case when n%3=0 then 'proposal' when n%3=1 then 'enquiry' else 'scoping' end,null,'2026-09-12' from generate_series(1,7) n;
  insert into pursuits values('dormant','Dormant organisation','dormant',null,'2019-01-01');`;
  const result=await readLeadSummary('director','team');
  expect(result.stages).toMatchObject({declined:4,instructed:4,dormant:1,enquiry:3,scoping:2,proposal:2});
  expect(result).toMatchObject({withoutOwner:7,withoutAction:7});expect(result.exceptionRows).toHaveLength(6);
  expect(result.exceptionRows.every(row=>row.id.startsWith('active-'))).toBe(true);
 });

 it('resolves two same-title commitments to distinct real parent labels',async()=>{
  mocks.fixture=`set local jit=off; create temp table pursuits (like public.pursuits including defaults); create temp table desk_actions (like public.desk_actions including defaults);create temp table desk_action_priorities as select * from public.desk_action_priorities where false;
  insert into pursuits(id,firm,source,created_by) values('label-a','Kubik Developments','other','director'),('label-b','L&Q Housing','other','director');
  insert into desk_actions(id,title,owner_id,due_date,state,created_by,pursuit_id) values('${id(191)}','Arrange call','director','2026-09-12','todo','director','label-a'),('${id(192)}','Arrange call','director','2026-09-12','todo','director','label-b');`;
  const result=await readActionSummary('director','team',w);
  expect(result.counts.open).toBe(2);expect(result.rows.map(row=>row.title)).toEqual(['Arrange call','Arrange call']);
  expect(result.rows.map(row=>row.relatedLabel)).toEqual(['Kubik Developments','L&Q Housing']);
  expect(result.rows.map(row=>row.relatedHref)).toEqual(['/portal/pursuits/label-a','/portal/pursuits/label-b']);
 });

});
