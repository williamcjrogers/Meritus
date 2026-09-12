import { sql, type SQL } from "drizzle-orm";
import { workflowRows } from "@/lib/db/research-workflow";
import { directorName, readDirectorDirectory } from "@/lib/portal/directors";
import { QCS_WORKSPACE_ID } from "@/lib/research/contracts";
import type { DateWindow } from "@/lib/actions/types";
import type { AgendaEntry, ResearchSummary } from "./types";
export type RequestWindow = DateWindow & { requestTime?: string };
export const requestTime = (w: RequestWindow) => w.requestTime ?? `${w.today}T12:00:00Z`;
export function unsuppressed(workspace: SQL, targets: SQL, w: RequestWindow): SQL {
  return sql`not exists(select 1 from research_suppressions x where x.workspace_id=${workspace} and x.target in(${targets}) and x.revoked_at is null and (x.expires_at is null or x.expires_at>${requestTime(w)}::timestamptz))`;
}
export async function readResearchSummary(actorId: string, scope: 'team'|'mine', w: RequestWindow): Promise<ResearchSummary> {
  const mine = sql`(${scope === 'team'} or i.owner=${actorId})`;
  const [runs, signals, reports] = await Promise.all([
    workflowRows<{runningInvestigations:number; queuedInvestigations:number; failedLatestRuns:number}>(sql`select count(*) filter(where r.status='running')::int as "runningInvestigations",count(*) filter(where r.status='queued')::int as "queuedInvestigations",count(*) filter(where r.status in('failed','incomplete'))::int as "failedLatestRuns" from research_investigations i left join lateral(select status from research_runs r where r.investigation_id=i.id and r.workspace_id=i.workspace_id order by r.created_at desc,r.id desc limit 1) r on true where i.workspace_id=${QCS_WORKSPACE_ID}::uuid and ${mine} and ${unsuppressed(sql`i.workspace_id`,sql`i.id,(i.scope->>'entityId')::uuid`,w)}`),
    workflowRows<{signalsAwaitingReview:number}>(sql`select count(*)::int as "signalsAwaitingReview" from research_signals s left join research_investigations i on i.id=s.investigation_id and i.workspace_id=s.workspace_id where s.workspace_id=${QCS_WORKSPACE_ID}::uuid and ${mine} and s.status='unreviewed' and not s.stale and research_signal_available(s.id) and ${unsuppressed(sql`s.workspace_id`,sql`s.id,s.entity_id,s.investigation_id`,w)}`),
    workflowRows<{reportsAwaitingReview:number}>(sql`select count(*)::int as "reportsAwaitingReview" from research_reports r join research_investigations i on i.id=r.investigation_id and i.workspace_id=r.workspace_id where r.workspace_id=${QCS_WORKSPACE_ID}::uuid and ${mine} and r.status='draft' and exists(select 1 from research_report_evidence e where e.report_id=r.id) and not exists(select 1 from research_report_evidence e where e.report_id=r.id and not exists(select 1 from research_available_passages p where p.workspace_id=r.workspace_id and p.document_id=e.document_id and p.version_id=e.version_id and p.passage_id=e.passage_id)) and ${unsuppressed(sql`r.workspace_id`,sql`r.id,r.investigation_id`,w)}`),
  ]);
  return { ...runs[0], ...signals[0], ...reports[0] };
}
export async function readResearchAgenda(actorId: string, scope: 'team'|'mine', w: RequestWindow): Promise<AgendaEntry[]> {
  const rows = await workflowRows<{id:string; investigation_id:string; kind:string; date:string; assumptions:unknown; owner:string|null; display_name:string|null}>(sql`select c.id,c.investigation_id,c.kind,c.proposed_date::text as date,c.assumptions,i.owner,e.display_name from research_calendar c join research_investigations i on i.id=c.investigation_id and i.workspace_id=c.workspace_id left join research_entities e on e.id=c.entity_id and e.workspace_id=c.workspace_id where c.workspace_id=${QCS_WORKSPACE_ID}::uuid and c.state='reviewed' and c.reviewed_by is not null and c.proposed_date>=${w.today}::date and c.proposed_date<${w.agendaEnd}::date and (${scope === 'team'} or i.owner=${actorId}) and jsonb_array_length(c.evidence)>0 and not exists(select 1 from jsonb_array_elements(c.evidence) ref where not exists(select 1 from research_available_passages p where p.workspace_id=c.workspace_id and p.document_id=(ref->>'documentId')::uuid and p.version_id=(ref->>'versionId')::uuid and p.passage_id=(ref->>'passageId')::uuid)) and ${unsuppressed(sql`c.workspace_id`,sql`c.id,c.entity_id,c.investigation_id`,w)} order by c.proposed_date,c.id limit 8`);
  const directory = await readDirectorDirectory();
  return rows.map(r => ({id:r.id,date:r.date,title:r.display_name ? `Reviewed research date: ${r.display_name}` : 'Reviewed research date',kind:'research',href:`/portal/research/investigations/${encodeURIComponent(r.investigation_id)}?calendar=${encodeURIComponent(r.id)}`,ownerName:directorName(directory.directors,r.owner),qualification:`${r.kind}. ${typeof r.assumptions === 'string' ? r.assumptions : JSON.stringify(r.assumptions)}. Recorded date only; no computed legal deadline.`}));
}
