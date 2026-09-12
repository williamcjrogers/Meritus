import { sql, type SQL } from 'drizzle-orm';
import { requireDb } from './index';
import type { CaseSearch, CaseHit } from '../research/case-law/types';
type Row = {
    document_id: string;
    version_id: string;
    metadata: Record<string, unknown>;
    passage_ids: string[];
};
function hit(row: Row): CaseHit { return { documentId: row.document_id, versionId: row.version_id, title: typeof row.metadata.title === 'string' ? row.metadata.title : row.document_id, identifiers: Array.isArray(row.metadata.identifiers) ? row.metadata.identifiers as {
        type: string;
        value: string;
    }[] : [], passageIds: row.passage_ids ?? [], coverage: ['Local corpus only; absence of a result does not establish that no authority exists.'] }; }
export function createCaseLawRepository(db: Pick<ReturnType<typeof requireDb>, 'execute'>) {
    async function rows<T>(query: SQL): Promise<T[]> { const result = await db.execute(query); return (Array.isArray(result) ? result : result.rows) as T[]; }
    const available = (workspaceId: string) => sql `d.workspace_id=${workspaceId}::uuid AND v.workspace_id=${workspaceId}::uuid AND s.workspace_id=${workspaceId}::uuid AND d.current_version_id=v.id AND d.status='available' AND v.availability='available' AND s.provider='find-case-law'`;
    return { async search(workspaceId: string, input: CaseSearch): Promise<CaseHit[]> { const conditions: SQL[] = [available(workspaceId)]; if (input.query)
            conditions.push(sql `EXISTS(SELECT 1 FROM research_passages p WHERE p.version_id=v.id AND p.workspace_id=${workspaceId}::uuid AND p.search @@ websearch_to_tsquery('english',${input.query}))`); if (input.citation)
            conditions.push(sql `EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(v.metadata->'identifiers','[]'::jsonb)) ident WHERE ident->>'value'=${input.citation})`); if (input.from)
            conditions.push(sql `v.published_at>=${input.from}::timestamptz`); if (input.to)
            conditions.push(sql `v.published_at<(${input.to}::date+interval '1 day')`); for (const [predicate, values] of [['case.court', input.courts], ['case.party', input.party ? [input.party] : undefined], ['case.judge', input.judge ? [input.judge] : undefined]] as const) {
            if (values?.length)
                conditions.push(sql `EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(v.metadata->'facts','[]'::jsonb)) fact WHERE fact->>'predicate'=${predicate} AND fact->'value'->>'text' IN (${sql.join(values.map(value => sql `${value}`), sql `, `)}))`);
        } const result = await rows<Row>(sql `SELECT d.id AS document_id,v.id AS version_id,v.metadata,ARRAY(SELECT p.id::text FROM research_passages p WHERE p.version_id=v.id AND p.workspace_id=${workspaceId}::uuid ORDER BY (SELECT ord FROM jsonb_array_elements_text(coalesce(v.metadata->'passageOrder','[]'::jsonb)) WITH ORDINALITY ordering(locator,ord) WHERE ordering.locator=(p.locator->>'kind')||':'||(p.locator->>'value') LIMIT 1) NULLS LAST,p.created_at,p.id) AS passage_ids FROM research_documents d JOIN research_versions v ON v.id=d.current_version_id JOIN research_sources s ON s.id=d.source_id WHERE ${sql.join(conditions, sql ` AND `)} ORDER BY v.published_at DESC NULLS LAST,d.id LIMIT 100`); return result.map(hit); }, async read(workspaceId: string, documentId: string): Promise<CaseHit & {
            passages: {
                id: string;
                locator: string;
                text: string;
            }[];
        }> { const result = await rows<Row>(sql `SELECT d.id AS document_id,v.id AS version_id,v.metadata,'{}'::text[] AS passage_ids FROM research_documents d JOIN research_versions v ON v.id=d.current_version_id JOIN research_sources s ON s.id=d.source_id WHERE ${available(workspaceId)} AND d.id=${documentId}::uuid`); if (!result[0])
            throw new Error('Case law document unavailable'); const passages = await rows<{
            id: string;
            locator: {
                kind: string;
                value: string;
            };
            text: string;
        }>(sql `SELECT p.id,p.locator,p.text FROM research_passages p JOIN research_versions v ON v.id=p.version_id JOIN research_documents d ON d.current_version_id=v.id JOIN research_sources s ON s.id=d.source_id WHERE ${available(workspaceId)} AND p.workspace_id=${workspaceId}::uuid AND v.id=${result[0].version_id}::uuid ORDER BY (SELECT ord FROM jsonb_array_elements_text(coalesce(v.metadata->'passageOrder','[]'::jsonb)) WITH ORDINALITY ordering(locator,ord) WHERE ordering.locator=(p.locator->>'kind')||':'||(p.locator->>'value') LIMIT 1) NULLS LAST,p.created_at,p.id`); if (!passages.length)
            throw new Error('Case law passages unavailable'); return { ...hit(result[0]), passageIds: passages.map(p => p.id), passages: passages.map(p => ({ id: p.id, locator: `${p.locator.kind} ${p.locator.value}`, text: p.text })) }; } };
}
export const searchCaseLawRecords = (workspaceId: string, input: CaseSearch) => createCaseLawRepository(requireDb()).search(workspaceId, input);
export const readCaseLawRecord = (workspaceId: string, documentId: string) => createCaseLawRepository(requireDb()).read(workspaceId, documentId);

export type CaseRecheckTarget={id:string;providerId:string;url:string;status:string;metadata:Record<string,unknown>;publishedAt:string|null;updatedAt:string|null};
/** Select the 100 least recently checked known records. Each successful acquisition rotates its check time. */
export async function listCaseLawRecheckTargets(sourceId:string):Promise<CaseRecheckTarget[]>{
    const {QCS_WORKSPACE_ID}=await import('../research/contracts');
    const result=await requireDb().execute(sql`SELECT d.id,d.provider_id AS "providerId",d.canonical_url AS url,d.status,'{}'::jsonb AS metadata,NULL AS "publishedAt",NULL AS "updatedAt" FROM research_documents d JOIN research_sources s ON s.id=d.source_id WHERE d.source_id=${sourceId}::uuid AND d.workspace_id=${QCS_WORKSPACE_ID}::uuid AND s.workspace_id=${QCS_WORKSPACE_ID}::uuid AND s.provider='find-case-law' AND d.status IN ('available','unavailable') ORDER BY d.availability_checked_at,d.id LIMIT 100`);
    return (Array.isArray(result)?result:result.rows) as CaseRecheckTarget[];
}
export async function getCaseLawRecheckTarget(sourceId:string,id:string):Promise<CaseRecheckTarget|null>{
    const {QCS_WORKSPACE_ID}=await import('../research/contracts');
    const result=await requireDb().execute(sql`SELECT d.id,d.provider_id AS "providerId",d.canonical_url AS url,d.status,coalesce(v.metadata,'{}'::jsonb) AS metadata,v.published_at AS "publishedAt",v.source_updated_at AS "updatedAt" FROM research_documents d LEFT JOIN research_versions v ON v.id=d.current_version_id AND v.workspace_id=d.workspace_id JOIN research_sources s ON s.id=d.source_id WHERE d.id=${id}::uuid AND d.source_id=${sourceId}::uuid AND d.workspace_id=${QCS_WORKSPACE_ID}::uuid AND s.workspace_id=${QCS_WORKSPACE_ID}::uuid AND s.provider='find-case-law' AND d.status IN ('available','unavailable')`);
    return ((Array.isArray(result)?result:result.rows) as CaseRecheckTarget[])[0]??null;
}
