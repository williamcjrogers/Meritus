import { beforeEach, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
const rows=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/db/research-workflow',()=>({workflowRows:rows}));
vi.mock('@/lib/db/desk-action-filter',()=>({deskActionVisibilityPredicate:()=>undefined}));
import { readProgrammeSummary,readProspectSummary } from './context';
beforeEach(()=>rows.mockReset());
it('initialises every prospect status and retains SQL eligibility boundaries',async()=>{
 rows.mockResolvedValue([{status:'unworked',count:12,available:3}]);
 expect(await readProspectSummary()).toEqual({statuses:{unworked:12,approaching:0,contacted:0,parked:0,converted:0,do_not_approach:0},availableToApproach:3});
 const query=new PgDialect().sqlToQuery(rows.mock.calls[0][0]).sql;
 expect(query).toContain("outreach_status='unworked'");expect(query).toContain('converted_pursuit_id is null');expect(query).toContain("conflict_tier='latent_conflict'");
});
it('counts the latest programme attempt without loading report JSON or expiring rows',async()=>{
 const totals={uploaded:2,analysed:0,analysisFailed:1,analysing:1,parseNeedsAttention:0};rows.mockResolvedValue([totals]);expect(await readProgrammeSummary()).toEqual(totals);
 expect(new PgDialect().sqlToQuery(rows.mock.calls[0][0]).sql).toContain('order by pr.created_at desc,pr.id desc limit 1');
});
