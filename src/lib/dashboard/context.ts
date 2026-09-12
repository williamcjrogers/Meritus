import { sql } from "drizzle-orm";
import { workflowRows } from "@/lib/db/research-workflow";
import { PURSUIT_STAGES, type ProspectOutreach, type PursuitStage } from "@/lib/db/schema";
import { deskActionVisibilityPredicate } from "@/lib/db/desk-action-filter";
import type { LeadSummary, ProspectSummary, ProgrammeSummary } from "./types";
export async function readLeadSummary(actorId: string, scope: "team" | "mine"): Promise<LeadSummary> {
  const visible = sql`research_pursuit_available(p.id) and (${scope === 'team'} or p.owner_id=${actorId})`;
  const active = sql`p.stage in('enquiry','scoping','proposal')`;
  const missing = sql`not exists(select 1 from desk_actions a where a.pursuit_id=p.id and a.state in('todo','in_progress','waiting') and ${deskActionVisibilityPredicate()})`;
  const [groups, totals, exceptionRows] = await Promise.all([
    workflowRows<{stage: PursuitStage; count: number}>(sql`select p.stage,count(*)::int as count from pursuits p where ${visible} group by p.stage`),
    workflowRows<{withoutOwner: number; withoutAction: number}>(sql`select count(*) filter(where p.owner_id is null)::int as "withoutOwner",count(*) filter(where ${missing})::int as "withoutAction" from pursuits p where ${visible} and ${active}`),
    workflowRows<LeadSummary['exceptionRows'][number]>(sql`select p.id,p.firm,p.owner_id is null as "missingOwner",${missing} as "missingAction" from pursuits p where ${visible} and ${active} and (p.owner_id is null or ${missing}) order by (p.owner_id is null) desc,p.created_at,p.id limit 6`),
  ]);
  const stages = Object.fromEntries(PURSUIT_STAGES.map(s => [s, 0])) as LeadSummary['stages'];
  for (const row of groups) stages[row.stage] = row.count;
  return { stages, ...totals[0], exceptionRows };
}
export async function readProspectSummary(): Promise<ProspectSummary> {
  const statuses: Record<ProspectOutreach, number> = { unworked: 0, approaching: 0, contacted: 0, parked: 0, converted: 0, do_not_approach: 0 };
  const rows = await workflowRows<{status: ProspectOutreach; count: number; available: number}>(sql`select outreach_status as status,count(*)::int as count,count(*) filter(where conflict_tier='latent_conflict' and outreach_status='unworked' and converted_pursuit_id is null)::int as available from prospects group by outreach_status`);
  for (const row of rows) statuses[row.status] = row.count;
  return { statuses, availableToApproach: rows.reduce((n,r) => n+r.available,0) };
}
export async function readProgrammeSummary(): Promise<ProgrammeSummary> {
  const [row] = await workflowRows<ProgrammeSummary>(sql`select count(*)::int as uploaded,count(*) filter(where p.parse_status in('failed','empty'))::int as "parseNeedsAttention",count(*) filter(where r.status='running')::int as analysing,count(*) filter(where r.status='complete')::int as analysed,count(*) filter(where r.status='failed')::int as "analysisFailed" from programmes p left join lateral(select pr.status from programme_reports pr where pr.programme_id=p.id order by pr.created_at desc,pr.id desc limit 1) r on true where p.pursuit_id is null or research_pursuit_available(p.pursuit_id)`);
  return row;
}
