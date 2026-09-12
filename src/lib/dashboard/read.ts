import { sql } from "drizzle-orm";
import { workflowRows } from "@/lib/db/research-workflow";
import { deskActionVisibilityPredicate } from "@/lib/db/desk-action-filter";
import { linkKey, resolveActionLinks } from "@/lib/db/desk-action-links";
import { mapDeskAction } from "@/lib/db/desk-actions";
import { dateWindow } from "@/lib/actions/dates";
import { requireResearchDirector } from "@/lib/research/roles";
import { directorName, readDirectorDirectory } from "@/lib/portal/directors";
import { QCS_WORKSPACE_ID } from "@/lib/research/contracts";
import type { ActionView } from "@/lib/actions/types";
import { readLeadSummary, readProspectSummary, readProgrammeSummary } from "./context";
import { readResearchAgenda, readResearchSummary, unsuppressed, requestTime, type RequestWindow } from "./research";
import type { ActionCounts, AgendaEntry, DashboardView, ProgressEntry, SectionResult, TeamRow } from "./types";
const open = sql`a.state in('todo','in_progress','waiting')`;
const at = (v:unknown) => v instanceof Date ? v.toISOString() : String(v);
async function actionViews(rows: Record<string,unknown>[]): Promise<ActionView[]> {
  if (!rows.length) return [];
  const actions = rows.map(mapDeskAction);
  const [directory, links] = await Promise.all([
    readDirectorDirectory(), resolveActionLinks(actions.map(action => action.link)),
  ]);
  return actions.flatMap((action, index) => {
    const related = links.get(linkKey(action.link));
    if (!related?.linkAvailable) return [];
    return [{...action, ...related, ownerName: directorName(directory.directors, action.ownerId), isPrimary: Boolean(rows[index].is_primary)}];
  });
}
export async function readActionSummary(actorId:string,scope:'team'|'mine',w:RequestWindow) {
  const visible=deskActionVisibilityPredicate(new Date(requestTime(w)));
  const personal=sql`(${scope==='team'} or a.owner_id=${actorId})`;
  const [counts, rows, unassigned] = await Promise.all([
    workflowRows<ActionCounts>(sql`select count(*) filter(where ${open})::int as open,count(*) filter(where ${open} and a.due_date<${w.today}::date)::int as overdue,count(*) filter(where ${open} and a.due_date=${w.today}::date)::int as today,count(*) filter(where ${open} and a.due_date>${w.today}::date and a.due_date<=${w.upcomingEnd}::date)::int as upcoming,count(*) filter(where ${open} and a.owner_id is null)::int as unassigned,count(*) filter(where ${open} and a.due_date is null)::int as undated from desk_actions a where ${visible} and ${personal}`),
    workflowRows<Record<string,unknown>>(sql`select a.*,exists(select 1 from desk_action_priorities p where p.action_id=a.id) as is_primary from desk_actions a where ${visible} and ${personal} and ${open} and a.due_date<=${w.upcomingEnd}::date order by a.due_date,a.created_at,a.id limit 8`),
    workflowRows<{count:number}>(sql`select count(*)::int as count from desk_actions a where ${visible} and ${open} and a.owner_id is null`),
  ]);
  return {counts:counts[0],rows:await actionViews(rows),unassignedTeam:unassigned[0].count};
}
export async function readTeamAccountability(w:RequestWindow):Promise<TeamRow[]> {
  const [rows,directory] = await Promise.all([
    workflowRows<Omit<TeamRow,'ownerName'>>(sql`select a.owner_id as "ownerId",count(*) filter(where ${open})::int as open,count(*) filter(where ${open} and a.due_date<${w.today}::date)::int as overdue,count(*) filter(where ${open} and a.due_date>${w.today}::date and a.due_date<=${w.upcomingEnd}::date)::int as upcoming,count(*) filter(where a.state='completed' and (a.completed_at at time zone 'Europe/London')::date between ${w.recentStart}::date and ${w.today}::date)::int as "completedRecent" from desk_actions a where ${deskActionVisibilityPredicate(new Date(requestTime(w)))} group by a.owner_id`),readDirectorDirectory(),
  ]);
  for (const d of directory.directors) if(!rows.some(r=>r.ownerId===d.id)) rows.push({ownerId:d.id,open:0,overdue:0,upcoming:0,completedRecent:0});
  return rows.map(r=>({...r,ownerName:directorName(directory.directors,r.ownerId)})).sort((a,b)=>a.ownerName.localeCompare(b.ownerName)||String(a.ownerId).localeCompare(String(b.ownerId)));
}
export async function readActionAgenda(actorId:string,scope:'team'|'mine',w:RequestWindow):Promise<AgendaEntry[]> {
  const rows=await workflowRows<{id:string;date:string;title:string;owner_id:string|null}>(sql`select a.id,a.due_date::text as date,a.title,a.owner_id from desk_actions a where ${deskActionVisibilityPredicate(new Date(requestTime(w)))} and ${open} and (${scope==='team'} or a.owner_id=${actorId}) and a.due_date>=${w.today}::date and a.due_date<${w.agendaEnd}::date order by a.due_date,a.created_at,a.id limit 8`);
  const directory=await readDirectorDirectory();
  return rows.map(r=>({id:r.id,date:r.date,title:r.title,kind:'action',href:`/portal/actions?edit=${encodeURIComponent(r.id)}`,ownerName:directorName(directory.directors,r.owner_id),qualification:null}));
}
export async function readReviewAgenda(actorId:string,scope:'team'|'mine',w:RequestWindow):Promise<AgendaEntry[]> {
  const rows=await workflowRows<{id:string;date:string;firm:string;owner_id:string|null}>(sql`select p.id,p.review_due::text as date,p.firm,p.owner_id from pursuits p where research_pursuit_available(p.id) and (${scope==='team'} or p.owner_id=${actorId}) and p.review_due>=${w.today}::date and p.review_due<${w.agendaEnd}::date order by p.review_due,p.id limit 8`);
  const directory=await readDirectorDirectory();
  return rows.map(r=>({id:r.id,date:r.date,title:`Lead review: ${r.firm}`,kind:'review',href:`/portal/pursuits/${encodeURIComponent(r.id)}`,ownerName:directorName(directory.directors,r.owner_id),qualification:'Recorded lead review date'}));
}
export async function readAgenda(actorId:string,scope:'team'|'mine',w:RequestWindow) {
  const results=await Promise.allSettled([readActionAgenda(actorId,scope,w),readReviewAgenda(actorId,scope,w),readResearchAgenda(actorId,scope,w)]);
  if(results.every(r=>r.status==='rejected')) throw new Error('All agenda sources unavailable');
  const warnings=results.flatMap((r,i)=>r.status==='rejected'?[`Could not load ${['action dates','lead review dates','reviewed research dates'][i]}`]:[]);
  const entries=results.flatMap(r=>r.status==='fulfilled'?r.value:[]).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)).slice(0,8);
  return {entries,warnings};
}
export async function readRecentProgress(w:RequestWindow):Promise<ProgressEntry[]> {
  const recent=sql`(e.created_at at time zone 'Europe/London')::date between ${w.recentStart}::date and ${w.today}::date`;
  const [actions,leads,research,directory]=await Promise.all([
    workflowRows<ProgressEntry>(sql`select e.id::text,e.created_at as at,'Action completed' as title,e.actor_id as "actorName",'/portal/actions?edit='||a.id::text as href,'action' as kind from desk_action_events e join desk_actions a on a.id=e.action_id where ${deskActionVisibilityPredicate(new Date(requestTime(w)))} and e.kind='completed' and ${recent} order by e.created_at desc,e.id desc limit 8`),
    workflowRows<ProgressEntry>(sql`select e.id,e.created_at as at,case when e.kind='reopened' then 'Lead reopened' else 'Recorded stage change' end as title,e.actor_id as "actorName",'/portal/pursuits/'||p.id as href,'lead' as kind from activity e join pursuits p on p.id=e.pursuit_id where e.kind in('stage_changed','reopened') and research_pursuit_available(p.id) and ${recent} order by e.created_at desc,e.id desc limit 8`),
    workflowRows<ProgressEntry>(sql`select e.id::text,e.created_at as at,case when research_signal_available(s.id) then 'Research signal decision recorded' else 'Research source changed; historical decision recorded' end as title,e.actor as "actorName",'/portal/research/signals' as href,'research' as kind from research_signal_decisions e join research_signals s on s.id=e.signal_id and s.workspace_id=e.workspace_id where e.workspace_id=${QCS_WORKSPACE_ID}::uuid and ${recent} and ${unsuppressed(sql`s.workspace_id`,sql`e.id,s.id,s.entity_id,s.investigation_id`,w)} order by e.created_at desc,e.id desc limit 8`),readDirectorDirectory(),
  ]);
  return [...actions,...leads,...research].map(r=>({...r,at:at(r.at),actorName:directorName(directory.directors,r.actorName)})).sort((a,b)=>b.at.localeCompare(a.at)||b.id.localeCompare(a.id)).slice(0,8);
}
export async function section<T>(work:()=>Promise<T>,error:string):Promise<SectionResult<T>> { try {return {ok:true,data:await work()};} catch {return {ok:false,error};} }
export async function readDashboard(scope:'team'|'mine',now:Date):Promise<DashboardView> {
  const actor=await requireResearchDirector();
  const w={...dateWindow(now),requestTime:now.toISOString()};
  const [directory,actions,team,leads,prospects,programmes,research,agenda,progress]=await Promise.all([
    readDirectorDirectory().catch(()=>({available:false,directors:[]})),
    section(()=>readActionSummary(actor,scope,w),'Could not load actions'),section(()=>readTeamAccountability(w),'Could not load team accountability'),section(()=>readLeadSummary(actor,scope),'Could not load lead pipeline'),section(readProspectSummary,'Could not load prospect coverage'),section(readProgrammeSummary,'Could not load programme analysis'),section(()=>readResearchSummary(actor,scope,w),'Could not load research activity'),section(()=>readAgenda(actor,scope,w),'Could not load agenda'),section(()=>readRecentProgress(w),'Could not load recent progress'),
  ]);
  return {scope,today:w.today,refreshedAt:now.toISOString(),directory,actions,team,leads,prospects,programmes,research,agenda,progress};
}
