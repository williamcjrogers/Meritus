import { sql } from "drizzle-orm";
import { requireDb } from "@/lib/db";
import { QCS_WORKSPACE_ID } from "./contracts";
import { investigationPayload } from "./selection";
import { validateSourceJobPayload } from "./sources/selection";
import type { ResearchScope } from "./workflow-types";

export type WatchlistSource = { id: string; provider: string; selection: Record<string, unknown>; credentialRef: string | null; status: string; updatedAt: string; backfillStart: string; watermarkAt: string | null };
export type DueWatchlistMember = { id: string; watchlistId: string; revision: number; updatedAt: string; entityId: string; entityUpdatedAt: string; subject: string; jurisdiction: string | null; companyNumber: string | null; sources: WatchlistSource[] };
export type PreparedWatchlistMember = Omit<DueWatchlistMember, "sources"> & { sources: { id: string; updatedAt: string; payload: Record<string, unknown> | null; error: string | null }[] };
export type WatchlistDispatchDeps = { due(now: Date): Promise<DueWatchlistMember[]>; credential(ref: string): boolean; dispatch(now: Date, members: PreparedWatchlistMember[]): Promise<{ enqueued: number; active: number; unavailable: number }> };

export function prepareWatchlistMember(member: DueWatchlistMember, now: Date, credential: (ref: string) => boolean): PreparedWatchlistMember {
  const scope: ResearchScope = { kind: "organisation", subject: member.subject, entityId: member.entityId, jurisdiction: member.jurisdiction ?? "United Kingdom", from: null, to: null, sources: member.sources.map(source => source.id) };
  return { ...member, sources: member.sources.map(source => {
    let payload: Record<string, unknown> | null = null;
    let error: string | null = null;
    try {
      if (source.status !== "ready") error = "source_unavailable";
      else if (source.credentialRef && !credential(source.credentialRef)) error = "credential_missing";
      else if (source.provider === "companies-house" && !member.companyNumber) error = "verified_company_number_required";
      else {
        const start = Math.max(Date.parse(source.backfillStart), source.watermarkAt ? Date.parse(source.watermarkAt) - 3600000 : Date.parse(source.backfillStart));
        if (!Number.isFinite(start) || start > now.getTime()) throw new Error("invalid_window");
        const selected = investigationPayload(source.provider, source.selection, scope, member.companyNumber, now);
        payload = validateSourceJobPayload(source.provider, { ...selected, window: { from: new Date(start).toISOString(), to: now.toISOString() }, watchlistId: member.watchlistId, watchlistMemberId: member.id, entityId: member.entityId });
      }
    } catch { error = "selection_invalid"; }
    return { id: source.id, updatedAt: source.updatedAt, payload, error };
  }) };
}
export const watchlistDispatchDeps: WatchlistDispatchDeps = {
  credential: ref => Boolean(process.env[ref]),
  async due(now) {
    const result = await requireDb().execute(sql`select m.id,m.watchlist_id as "watchlistId",w.revision,m.updated_at::text as "updatedAt",e.id as "entityId",e.updated_at::text as "entityUpdatedAt",e.display_name as subject,e.jurisdiction,
      (select i.value from research_identifiers i where i.entity_id=e.id and i.workspace_id=e.workspace_id and i.verified and i.scheme='uk-company-number' and exists(select 1 from research_identifier_evidence proof join research_available_passages p on p.passage_id=proof.passage_id and p.version_id=proof.version_id and p.document_id=proof.document_id and p.workspace_id=i.workspace_id where proof.identifier_id=i.id and proof.workspace_id=i.workspace_id) order by i.id limit 1) as "companyNumber",
      (select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'provider',s.provider,'selection',s.selection,'credentialRef',s.credential_ref,'status',s.status,'updatedAt',s.updated_at::text,'backfillStart',s.backfill_start,'watermarkAt',c.watermark_at)),'[]'::jsonb)
       from research_sources s left join research_checkpoints c on c.source_id=s.id and c.workspace_id=s.workspace_id and c.scope_key='watchlist:'||m.id::text
       where s.workspace_id=m.workspace_id and w.sources @> jsonb_build_array(s.id::text)) as sources
      from research_watchlist_members m join research_watchlists w on w.id=m.watchlist_id and w.workspace_id=m.workspace_id join research_entities e on e.id=m.entity_id and e.workspace_id=m.workspace_id
      where m.workspace_id=${QCS_WORKSPACE_ID}::uuid and w.enabled and e.confirmed and m.next_refresh_at<=${now.toISOString()}::timestamptz
      order by (select max(f.checked_at) from research_watchlist_refreshes f where f.member_id=m.id) nulls first,m.next_refresh_at,m.id limit 10`);
    return (Array.isArray(result) ? result : result.rows) as DueWatchlistMember[];
  },
  async dispatch(now, members) {
    const result = await requireDb().execute(sql`select research_dispatch_watchlists(${now.toISOString()}::timestamptz,${JSON.stringify(members)}::jsonb) as counts`);
    const rows = (Array.isArray(result) ? result : result.rows) as { counts: { enqueued: number; active: number; unavailable: number } }[];
    return rows[0]?.counts ?? { enqueued: 0, active: 0, unavailable: 0 };
  },
};
export async function dispatchDueWatchlists(now = new Date(), deps = watchlistDispatchDeps) {
  if (!Number.isFinite(now.getTime())) throw new Error("invalid_dispatch_date");
  const members = await deps.due(now);
  return deps.dispatch(now, members.map(member => prepareWatchlistMember(member, now, deps.credential)));
}
