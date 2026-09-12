import {beforeEach,expect,it,vi} from 'vitest';
import {PgDialect} from 'drizzle-orm/pg-core';
const mocks=vi.hoisted(()=>({rows:vi.fn(),auth:vi.fn(),directory:vi.fn(),links:vi.fn()}));
vi.mock('@/lib/db/research-workflow',()=>({workflowRows:mocks.rows}));
vi.mock('@/lib/db/desk-actions',()=>({mapDeskAction:(r:unknown)=>r}));
vi.mock('@/lib/db/desk-action-links',async(importOriginal)=>({...await importOriginal<typeof import('@/lib/db/desk-action-links')>(),resolveActionLinks:mocks.links}));
vi.mock('@/lib/research/roles',()=>({requireResearchDirector:mocks.auth}));
vi.mock('@/lib/portal/directors',()=>({readDirectorDirectory:mocks.directory,directorName:(_:unknown,id:string|null)=>id??'Unassigned'}));
import {readDashboard,readActionSummary,readTeamAccountability,readAgenda} from './read';
const w={today:'2026-09-12',upcomingEnd:'2026-09-19',agendaEnd:'2026-09-26',recentStart:'2026-09-06',requestTime:'2026-09-12T15:00:00Z'};
const counts={overdue:17,today:3,upcoming:5,unassigned:2,undated:1,open:27};
beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockResolvedValue('director');mocks.links.mockResolvedValue(new Map([['general',{relatedLabel:'General',relatedHref:null,linkAvailable:true}]]));mocks.directory.mockResolvedValue({available:true,directors:[]});});
it('keeps complete totals independent of bounded preview and team unassigned notice',async()=>{
 const eight=Array.from({length:8},(_,i)=>({id:String(i),ownerId:'director',link:{kind:'general'}}));
 mocks.rows.mockResolvedValueOnce([counts]).mockResolvedValueOnce(eight).mockResolvedValueOnce([{count:9}]);
 const result=await readActionSummary('director','mine',w);expect(result.counts.overdue).toBe(17);expect(result.rows).toHaveLength(8);expect(result.unassignedTeam).toBe(9);
 const q=mocks.rows.mock.calls.map(c=>new PgDialect().sqlToQuery(c[0]));expect(q[1].sql).toContain('order by a.due_date,a.created_at,a.id limit 8');expect(q[1].sql).not.toContain('due_date>=');expect(q[2].params).not.toContain('director');
});
it('unions zero-action directors and keeps unknown and unassigned ownership distinct',async()=>{
 mocks.directory.mockResolvedValue({available:true,directors:[{id:'zero'}]});mocks.rows.mockResolvedValue([{ownerId:null,open:1},{ownerId:'unknown',open:2}]);
 const rows=await readTeamAccountability(w);expect(rows.map(r=>r.ownerId)).toEqual(expect.arrayContaining([null,'unknown','zero']));expect(rows.find(r=>r.ownerId==='zero')?.open).toBe(0);
});
it('authorises once and isolates programme failure from actions and team',async()=>{
 mocks.rows.mockImplementation(async query=>{const s=new PgDialect().sqlToQuery(query).sql;if(s.includes('from programmes p left join'))throw new Error('database unavailable');if(s.includes('as open,')&&s.includes('as undated'))return [counts];if(s.includes('as count from desk_actions'))return [{count:2}];if(s.includes('as "withoutOwner"'))return [{withoutOwner:0,withoutAction:0}];if(s.includes('as "runningInvestigations"'))return [{runningInvestigations:0,queuedInvestigations:0,failedLatestRuns:0}];if(s.includes('as "signalsAwaitingReview"'))return [{signalsAwaitingReview:0}];if(s.includes('as "reportsAwaitingReview"'))return [{reportsAwaitingReview:0}];return [];});
 const view=await readDashboard('mine',new Date(w.requestTime));expect(mocks.auth).toHaveBeenCalledTimes(1);expect(view.actions).toMatchObject({ok:true,data:{counts:{overdue:17}}});expect(view.team.ok).toBe(true);expect(view.programmes).toEqual({ok:false,error:'Could not load programme analysis'});
});
it('retains usable agenda entries when research fails',async()=>{
 mocks.rows.mockImplementation(async query=>{const s=new PgDialect().sqlToQuery(query).sql;if(s.includes('from research_calendar c join'))throw new Error('unavailable');if(s.includes('select a.id,a.due_date'))return [{id:'a',date:w.today,title:'Call',owner_id:null}];return [];});
 expect(await readAgenda('director','team',w)).toMatchObject({entries:[{id:'a',kind:'action'}],warnings:['Could not load reviewed research dates']});
});

it('distinguishes identical action titles by readable parent names without deriving totals from previews',async()=>{
 const actions=[{id:'a',title:'Arrange call',ownerId:'director',link:{kind:'pursuit',id:'lead-a'}},{id:'b',title:'Arrange call',ownerId:'director',link:{kind:'programme',id:'programme-b'}}];
 mocks.rows.mockResolvedValueOnce([counts]).mockResolvedValueOnce(actions).mockResolvedValueOnce([{count:9}]);
 mocks.links.mockResolvedValue(new Map([['pursuit:lead-a',{relatedLabel:'Kubik Developments',relatedHref:'/portal/pursuits/lead-a',linkAvailable:true}],['programme:programme-b',{relatedLabel:'L&Q baseline.xer',relatedHref:'/portal/programmes/programme-b',linkAvailable:true}]]));
 const result=await readActionSummary('director','team',w);
 expect(result.rows.map(row=>row.relatedLabel)).toEqual(['Kubik Developments','L&Q baseline.xer']);
 expect(result.rows.map(row=>row.title)).toEqual(['Arrange call','Arrange call']);
 expect(mocks.links).toHaveBeenCalledWith(actions.map(a=>a.link));expect(result.counts.open).toBe(27);
});
it('omits a preview whose parent becomes unavailable without replacing full-query totals',async()=>{
 mocks.rows.mockResolvedValueOnce([counts]).mockResolvedValueOnce([{id:'a',title:'Private',link:{kind:'pursuit',id:'restricted'}}]).mockResolvedValueOnce([{count:9}]);mocks.links.mockResolvedValue(new Map());
 const result=await readActionSummary('director','team',w);expect(result.rows).toEqual([]);expect(result.counts.open).toBe(27);
});
