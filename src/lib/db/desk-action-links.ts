import { sql, type SQL } from "drizzle-orm";
import { requireDb } from "./index";
import { QCS_WORKSPACE_ID } from "@/lib/research/contracts";
import { requireResearchDirector } from "@/lib/research/roles";
import { workLinkSchema } from "@/lib/actions/model";
import type { WorkLink } from "@/lib/actions/types";
import { maskResearchPursuitSummaries } from "./research-workflow";
export class ActionLinkError extends Error {
}
export type LinkView = {
    relatedLabel: string;
    relatedHref: string | null;
    linkAvailable: boolean;
};
export const linkKey = (link: WorkLink) => link.kind === "general" ? "general" : `${link.kind}:${link.id}`;
/** SQL aliases i/c are local to the parent subqueries. */
export function investigationVisible(now?: Date): SQL {
    return sql `i.workspace_id=${QCS_WORKSPACE_ID}::uuid
    and not exists(select 1 from research_suppressions x where x.workspace_id=i.workspace_id and x.target in(i.id,(i.scope->>'entityId')::uuid) and x.revoked_at is null and (x.expires_at is null or x.expires_at>${now ? sql`${now.toISOString()}::timestamptz` : sql`now()`}))
    and not exists(select 1 from research_run_documents rd join research_runs r on r.id=rd.run_id where r.investigation_id=i.id and not exists(select 1 from research_available_passages p where p.workspace_id=i.workspace_id and p.document_id=rd.document_id and p.version_id=rd.version_id))
    and not exists(select 1 from research_claims claim where claim.investigation_id=i.id and (claim.availability<>'available' or exists(select 1 from research_claim_evidence e where e.claim_id=claim.id and not exists(select 1 from research_available_passages p where p.workspace_id=i.workspace_id and p.passage_id=e.passage_id and p.document_id=e.document_id and p.version_id=e.version_id))))`;
}
export function calendarVisible(now?: Date): SQL {
    return sql `c.workspace_id=${QCS_WORKSPACE_ID}::uuid and c.state='reviewed' and c.reviewed_by is not null
    and exists(select 1 from research_investigations i where i.id=c.investigation_id and ${investigationVisible(now)})
    and not exists(select 1 from research_suppressions x where x.workspace_id=c.workspace_id and x.target in(c.id,c.entity_id,c.investigation_id) and x.revoked_at is null and (x.expires_at is null or x.expires_at>${now ? sql`${now.toISOString()}::timestamptz` : sql`now()`}))
    and jsonb_array_length(c.evidence)>0
    and not exists(select 1 from jsonb_array_elements(c.evidence) e where not exists(select 1 from research_available_passages p where p.workspace_id=c.workspace_id and p.document_id=(e->>'documentId')::uuid and p.version_id=(e->>'versionId')::uuid and p.passage_id=(e->>'passageId')::uuid))`;
}
/** One bounded query for each parent type present, with no raw research summaries. */
export async function resolveActionLinks(links: WorkLink[]): Promise<Map<string, LinkView>> {
    await requireResearchDirector();
    const result = new Map<string, LinkView>([["general", { relatedLabel: "General", relatedHref: null, linkAvailable: true }]]);
    for (const kind of ["pursuit", "prospect", "programme", "investigation", "calendar"] as const) {
        const ids = [...new Set(links.filter(l => l.kind === kind).map(l => l.kind === "general" ? "" : l.id))];
        if (!ids.length)
            continue;
        const values = JSON.stringify(ids);
        const inIds = sql `select value from jsonb_array_elements_text(${values}::jsonb)`;
        const query = kind === "pursuit" ? sql `select id,firm as label,summary from pursuits where id in (${inIds}) and research_pursuit_available(id)`
            : kind === "prospect" ? sql `select id,organisation as label from prospects where id in (${inIds})`
                : kind === "programme" ? sql `select id,file_name as label from programmes where id in (${inIds}) and (pursuit_id is null or research_pursuit_available(pursuit_id))`
                    : kind === "investigation" ? sql `select i.id,i.question as label from research_investigations i where i.id::text in (${inIds}) and ${investigationVisible()}`
                        : sql `select c.id,c.kind as label from research_calendar c where c.id::text in (${inIds}) and ${calendarVisible()}`;
        const rows = (await requireDb().execute(query)).rows as {
            id: string;
            label: string;
            summary: string | null;
        }[];
        if (kind === "pursuit")
            await maskResearchPursuitSummaries(rows);
        for (const row of rows)
            result.set(`${kind}:${row.id}`, { relatedLabel: row.label, relatedHref: kind === "calendar" ? "/portal/research/calendar" : `/portal/${kind === "investigation" ? "research/investigations" : kind === "pursuit" ? "pursuits" : kind === "prospect" ? "prospects" : "programmes"}/${encodeURIComponent(row.id)}`, linkAvailable: true });
    }
    return result;
}
export async function validateActionLink(link: WorkLink): Promise<void> {
    await requireResearchDirector();
    const parsed = workLinkSchema.parse(link);
    if (!(await resolveActionLinks([parsed])).has(linkKey(parsed)))
        throw new ActionLinkError("The related record is unavailable");
}
