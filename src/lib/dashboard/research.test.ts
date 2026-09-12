import { beforeEach, expect,it,vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
const rows=vi.hoisted(()=>vi.fn());vi.mock('@/lib/db/research-workflow',()=>({workflowRows:rows}));
vi.mock('@/lib/portal/directors',()=>({readDirectorDirectory:async()=>({available:true,directors:[]}),directorName:(_:unknown,id:string|null)=>id??'Unassigned'}));
import {readResearchAgenda,readResearchSummary} from './research';
const w={today:'2026-09-12',upcomingEnd:'2026-09-19',agendaEnd:'2026-09-26',recentStart:'2026-09-06',requestTime:'2026-09-12T15:01:00Z'};
beforeEach(()=>rows.mockReset());
it('binds actor and request time and requires reviewed, supported, unsuppressed dates',async()=>{
 rows.mockResolvedValue([]);await readResearchAgenda("director';select",'mine',w);const q=new PgDialect().sqlToQuery(rows.mock.calls[0][0]);
 expect(q.params).toContain("director';select");expect(q.params).toContain(w.requestTime);expect(q.sql).not.toContain('now()');expect(q.sql).toContain("c.state='reviewed'");expect(q.sql).toContain('c.reviewed_by is not null');expect(q.sql).toContain('jsonb_array_length(c.evidence)>0');expect(q.sql).toContain('x.revoked_at is null');expect(q.sql).toContain('c.id,c.entity_id,c.investigation_id');expect(q.sql).toContain('research_available_passages');
});
it('qualifies recorded research date with source kind and assumptions',async()=>{
 rows.mockResolvedValue([{id:'c',investigation_id:'i',kind:'limitation',date:w.today,assumptions:'Subject to review',owner:null,display_name:null}]);
 const [entry]=await readResearchAgenda('a','team',w);expect(entry.kind).toBe('research');expect(entry.qualification).toContain('Subject to review');expect(entry.qualification).toContain('no computed legal deadline');
});
it('uses latest investigation run and counts only available review evidence',async()=>{
 rows.mockResolvedValueOnce([{runningInvestigations:2,queuedInvestigations:1,failedLatestRuns:3}]).mockResolvedValueOnce([{signalsAwaitingReview:4}]).mockResolvedValueOnce([{reportsAwaitingReview:5}]);
 expect(await readResearchSummary('a','team',w)).toMatchObject({runningInvestigations:2,reportsAwaitingReview:5});
 const queries=rows.mock.calls.map(c=>new PgDialect().sqlToQuery(c[0]).sql);expect(queries[0]).toContain('r.investigation_id=i.id');expect(queries[0]).toContain('order by r.created_at desc,r.id desc limit 1');expect(queries[1]).toContain('not s.stale');expect(queries[2]).toContain('research_report_evidence');
});
