import { sql, type SQL } from "drizzle-orm";
import { dateWindow } from "@/lib/actions/dates";
import { actionStateSchema, workLinkSchema } from "@/lib/actions/model";
import type { ActionQuery } from "@/lib/actions/types";
import { calendarVisible, investigationVisible } from "./desk-action-links";
const parents = { pursuit: "pursuit_id", prospect: "prospect_id", programme: "programme_id", investigation: "investigation_id", calendar: "calendar_id" } as const;
/** Shared by full totals and previews. Caller uses desk_actions alias a. */
export function deskActionVisibilityPredicate(now?: Date): SQL {
    return sql `(a.pursuit_id is null or research_pursuit_available(a.pursuit_id))
 and (a.programme_id is null or exists(select 1 from programmes pr where pr.id=a.programme_id and (pr.pursuit_id is null or research_pursuit_available(pr.pursuit_id))))
 and (a.investigation_id is null or exists(select 1 from research_investigations i where i.id=a.investigation_id and ${investigationVisible(now)}))
 and (a.calendar_id is null or exists(select 1 from research_calendar c where c.id=a.calendar_id and ${calendarVisible(now)}))`;
}
export function deskActionPredicates(query: ActionQuery, actorId: string, now: Date): SQL {
    const w = dateWindow(now), parts: SQL[] = [deskActionVisibilityPredicate(now)];
    if (query.scope === 'mine')
        parts.push(sql `a.owner_id=${actorId}`);
    if (query.ownerId !== undefined)
        parts.push(query.ownerId === null ? sql `a.owner_id is null` : sql `a.owner_id=${query.ownerId}`);
    if (query.state)
        parts.push(sql `a.state=${actionStateSchema.parse(query.state)}`);
    if (query.link) {
        const link = workLinkSchema.parse(query.link);
        parts.push(link.kind === 'general' ? sql `num_nonnulls(a.pursuit_id,a.prospect_id,a.programme_id,a.investigation_id,a.calendar_id)=0` : sql `${sql.raw(`a.${parents[link.kind]}`)}=${link.id}`);
    }
    const open = sql `a.state in ('todo','in_progress','waiting')`;
    switch (query.filter) {
        case 'open':
            parts.push(open);
            break;
        case 'overdue':
            parts.push(open, sql `a.due_date<${w.today}::date`);
            break;
        case 'today':
            parts.push(open, sql `a.due_date=${w.today}::date`);
            break;
        case 'upcoming':
            parts.push(open, sql `a.due_date>${w.today}::date and a.due_date<=${w.upcomingEnd}::date`);
            break;
        case 'unassigned':
            parts.push(open, sql `a.owner_id is null`);
            break;
        case 'undated':
            parts.push(open, sql `a.due_date is null`);
            break;
        case 'completed_recent':
            parts.push(sql `a.state='completed' and (a.completed_at at time zone 'Europe/London')::date between ${w.recentStart}::date and ${w.today}::date`);
            break;
        case 'all': break;
        default: throw new Error('Invalid action filter');
    }
    return sql.join(parts.map(p => sql `(${p})`), sql ` and `);
}
