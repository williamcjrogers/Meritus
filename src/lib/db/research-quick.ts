import { createHash } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { QCS_WORKSPACE_ID } from "@/lib/research/contracts";
import { requireResearchDirector } from "@/lib/research/roles";
import { expandedQuickSearchTerms } from "@/lib/research/quick-search";
export { quickSearchTerms } from "@/lib/research/quick-search";
import { answerSchema, validateFinding } from "@/lib/research/report-schema";
import {
  QUICK_RESEARCH_COST_PENCE, QUICK_RESEARCH_MAX_PASSAGES, QUICK_RESEARCH_TOKENS,
  type QuickAnswer, type QuickJob, type QuickQuestion, type QuickQuestionInput,
  type ResearchDeskData, type ResearchOpportunity,
} from "@/lib/research/quick-types";
import type { EvidencePassage } from "@/lib/research/workflow-types";
import { workflowRows, WorkflowError } from "./research-workflow";

const inputSchema = z.object({ requestId: z.uuid(), question: z.string().trim().min(5).max(2000), monitoring: z.boolean() }).strict();
const refsSchema = z.array(z.object({ documentId: z.uuid(), versionId: z.uuid(), passageId: z.uuid() }).strict()).max(QUICK_RESEARCH_MAX_PASSAGES);
const passageColumns = sql`p.passage_id as "passageId",p.version_id as "versionId",p.document_id as "documentId",p.source_id as "sourceId",p.text,p.locator,p.url,p.title,p.retrieved_at::text as "retrievedAt",p.published_at::text as "publishedAt",p.event_at::text as "eventAt",p.attribution`;

async function assertActor(actor: string) {
  if (await requireResearchDirector() !== actor) throw new WorkflowError("forbidden", 403);
}
async function result<T>(query: SQL): Promise<T> {
  try {
    const rows = await workflowRows<{ result: T }>(query);
    return rows[0]?.result as T;
  } catch (error) {
    const message = error instanceof Error ? `${error.message} ${error.cause instanceof Error ? error.cause.message : ""}` : "";
    const known = ["idempotency_conflict", "research_queue_full", "research_monitor_limit", "question_not_found", "evidence_unavailable"];
    const code = known.find(value => message.includes(value));
    if (code) throw new WorkflowError(code, code === "question_not_found" ? 404 : 409);
    throw error;
  }
}
const refs = (evidence: EvidencePassage[]) => refsSchema.parse(evidence.map(({ documentId, versionId, passageId }) => ({ documentId, versionId, passageId })));
const iso = (date: string | null): string | null => date ? new Date(date).toISOString() : null;
const normalisePassage = (p: EvidencePassage): EvidencePassage => ({ ...p, retrievedAt: iso(p.retrievedAt)!, publishedAt: iso(p.publishedAt), eventAt: iso(p.eventAt) });

export async function enqueueQuickQuestion(actor: string, input: QuickQuestionInput): Promise<{ id: string; status: string }> {
  await assertActor(actor);
  const request = inputSchema.parse(input);
  const hash = createHash("sha256").update(JSON.stringify({ question: request.question, monitoring: request.monitoring })).digest("hex");
  return result(sql`select research_quick_enqueue(${actor},${request.requestId}::uuid,${hash},${request.question},${request.monitoring}) as result`);
}

export async function setQuickMonitoring(actor: string, id: string, monitoring: boolean): Promise<void> {
  await assertActor(actor); z.uuid().parse(id); z.boolean().parse(monitoring);
  await result(sql`select research_quick_monitor(${actor},${id}::uuid,${monitoring}) as result`);
}

export async function reviewOpportunity(actor: string, documentId: string, action: "save" | "dismiss" | "reopen"): Promise<void> {
  await assertActor(actor); z.uuid().parse(documentId); z.enum(["save", "dismiss", "reopen"]).parse(action);
  await result(sql`select research_quick_review(${actor},${documentId}::uuid,${action}) as result`);
}

export async function listResearchDesk(actor: string, view: "new" | "saved" = "new"): Promise<ResearchDeskData> {
  await assertActor(actor); z.enum(["new", "saved"]).parse(view);
  const [questionRows, opportunities, collections] = await Promise.all([
    workflowRows<QuickQuestion>(sql`
      select q.id,q.question,q.monitoring,q.status,q.created_at::text as "createdAt",
      q.last_checked_at::text as "lastCheckedAt",q.next_check_at::text as "nextCheckAt",
      case when q.answer_id is not null and not current.ok then coalesce(q.error,'Source evidence changed or is unavailable. Ask again for an updated answer.') else q.error end as error,
      case when current.ok then c.answer else null end as answer,
      case when current.ok then coalesce((select jsonb_agg(jsonb_build_object(
        'documentId',p.document_id,'versionId',p.version_id,'passageId',p.passage_id,'sourceId',p.source_id,
        'title',p.title,'url',p.url,'text','','locator',p.locator,'retrievedAt',p.retrieved_at,
        'publishedAt',p.published_at,'eventAt',p.event_at,'attribution',p.attribution) order by ref.ordinality)
        from jsonb_array_elements(c.evidence) with ordinality ref(value,ordinality)
        join research_quick_available_passages p on p.passage_id=(ref.value->>'passageId')::uuid
        and p.document_id=(ref.value->>'documentId')::uuid and p.version_id=(ref.value->>'versionId')::uuid),'[]'::jsonb) else '[]'::jsonb end as evidence
      from research_quick_questions q
      left join research_conversations c on c.id=q.answer_id and c.actor=q.owner and c.investigation_id=q.investigation_id and c.workspace_id=q.workspace_id
      cross join lateral (select c.id is not null and research_quick_answer_current(c.id) as ok) current
      where q.workspace_id=${QCS_WORKSPACE_ID}::uuid and q.owner=${actor}
      order by (q.monitoring or q.status in('queued','running')) desc,q.created_at desc,q.id limit 50`),
    workflowRows<ResearchOpportunity>(sql`
      with construction_versions as (
        select version_id from research_passages candidate where workspace_id=${QCS_WORKSPACE_ID}::uuid
          and exists(select 1 from research_quick_available_passages permitted where permitted.passage_id=candidate.id)
          and search@@to_tsquery('english','construction | contractor | subcontractor | building | infrastructure | housebuilding | civil <-> engineering')
        union select id from research_versions where workspace_id=${QCS_WORKSPACE_ID}::uuid
          and to_tsvector('english',coalesce(metadata->>'title',''))@@to_tsquery('english','construction | contractor | subcontractor | building | infrastructure | housebuilding | civil <-> engineering')
        union select version_id from research_passages candidate where workspace_id=${QCS_WORKSPACE_ID}::uuid
          and exists(select 1 from research_quick_available_passages permitted where permitted.passage_id=candidate.id)
          and locator->>'value' like '/sic_codes/%' and text ~ '^(41|42|43)[0-9]{3}$'
      ), trigger_versions as (
        select version_id from research_passages candidate where workspace_id=${QCS_WORKSPACE_ID}::uuid
          and exists(select 1 from research_quick_available_passages permitted where permitted.passage_id=candidate.id) and
          (search@@to_tsquery('english','payment | pay | paid | unpaid | arrears | dispute | adjudication | litigation | arbitration | insolvency | liquidation | winding <-> up | administration | defect | remediation | procurement | tender | contract <-> award')
          or to_tsvector('english',research_quick_field_words(locator))@@to_tsquery('english','payment | pay | paid | unpaid | arrears | dispute | adjudication | litigation | arbitration | insolvency | liquidation | administration | defect | remediation | procurement | tender'))
      ), documents as (
        select d.id,v.id as version_id,coalesce(v.metadata->>'title',d.provider_id) as title,d.canonical_url as url,
          v.published_at,v.event_at,v.retrieved_at,s.label as source,s.provider,review.action
        from research_documents d join research_versions v on v.id=d.current_version_id and v.workspace_id=d.workspace_id
        join research_sources s on s.id=d.source_id and s.workspace_id=d.workspace_id
        left join lateral (select r.action from research_reviews r where r.workspace_id=d.workspace_id and r.actor=${actor}
          and r.target=d.id and r.action in('desk_save','desk_dismiss','desk_reopen') order by r.created_at desc,r.id desc limit 1) review on true
        where d.workspace_id=${QCS_WORKSPACE_ID}::uuid and v.id in(select version_id from construction_versions)
          and v.id in(select version_id from trigger_versions)
          and exists(select 1 from research_quick_available_passages available where available.version_id=v.id)
          and (${view}='saved' and review.action='desk_save' or ${view}='new' and coalesce(review.action,'desk_reopen')='desk_reopen')
          and (${view}='saved' or coalesce(v.published_at,v.event_at,v.retrieved_at)>=now()-interval '90 days')
          and coalesce(v.published_at,v.event_at,v.retrieved_at)<=now()
        order by coalesce(v.published_at,v.event_at,v.retrieved_at) desc,d.id limit 20
      ) select d.id as "documentId",d.version_id as "versionId",excerpt.passage_id as "passageId",
        coalesce(excerpt.identity,d.title) as title,d.source,d.provider,excerpt.text as excerpt,excerpt.evidence,d.url,
        d.published_at::text as "publishedAt",d.retrieved_at::text as "retrievedAt",
        'Published record matching construction context and '||excerpt.topic||'. Review the original record.' as reason,
        coalesce(d.action='desk_save',false) as saved
      from documents d cross join lateral (
        select (array_agg(selected.passage_id order by selected.priority,selected.passage_id))[1] as passage_id,
          max(selected.text) filter(where selected.identity) as identity,
          jsonb_agg(jsonb_build_object('passageId',selected.passage_id,'label',case when selected.locator->>'kind'='field' then coalesce(selected.locator->>'value','Field') else 'Source passage' end) order by selected.priority,selected.passage_id) as evidence,
          string_agg(case when selected.locator->>'kind'='field' then coalesce(selected.locator->>'value','Field')||': ' else '' end||left(selected.text,220), E'\n' order by selected.priority,selected.passage_id) as text,
          case when bool_or(selected.labelled ~* '\\m(insolvency|liquidation|winding.up|administration)\\M') then 'insolvency-related wording'
            when bool_or(selected.labelled ~* '\\m(payment|pay|paid|unpaid|arrears)\\M') then 'payment wording'
            when bool_or(selected.labelled ~* '\\m(dispute|adjudication|litigation|arbitration)\\M') then 'dispute wording'
            when bool_or(selected.labelled ~* '\\m(defect|defects|remediation)\\M') then 'defect wording'
            else 'procurement wording' end as topic
        from (
          select p.*,p.text||' '||research_quick_field_words(p.locator) as labelled,
            lower(coalesce(p.locator->>'value','')) in('company','company name','/company_name','/tender/title','/title') as identity,
            case when lower(coalesce(p.locator->>'value','')) in('company','company name','/company_name','/tender/title','/title') then 0
              when to_tsvector('english',p.text||' '||research_quick_field_words(p.locator))@@to_tsquery('english','payment | pay | paid | unpaid | arrears | dispute | adjudication | litigation | arbitration | insolvency | liquidation | administration | defect | remediation | procurement | tender') then 1
              when coalesce(p.locator->>'value','') ~* '(date|period|policy regime)' then 2 else 3 end as priority
          from research_quick_available_passages p where p.version_id=d.version_id
          order by priority,p.passage_id limit 6
        ) selected
      ) excerpt order by coalesce(d.published_at,d.event_at,d.retrieved_at) desc,d.id`),
    workflowRows<ResearchDeskData["collection"]>(sql`
      select count(*) filter(where s.status='ready' and r.effective_at<=now() and (r.expires_at is null or r.expires_at>now()))::int as "enabledSources",
      max(s.last_success_at)::text as "lastCollectedAt",
      count(*) filter(where s.status<>'paused' and (s.status<>'ready' or s.configuration_error is not null or s.last_success_at is null or s.last_success_at<now()-make_interval(secs=>s.freshness_seconds) or r.id is null or r.effective_at>now() or r.expires_at<=now()))::int as "needsAttention"
      from research_sources s left join research_rights r on r.id=s.rights_id and r.workspace_id=s.workspace_id where s.workspace_id=${QCS_WORKSPACE_ID}::uuid`),
  ]);
  const collection = collections[0] ?? { enabledSources: 0, lastCollectedAt: null, needsAttention: 0 };
  return {
    questions: questionRows.map(q => ({ ...q, createdAt: iso(q.createdAt)!, lastCheckedAt: iso(q.lastCheckedAt), nextCheckAt: iso(q.nextCheckAt), answer: q.answer ? answerSchema.parse(q.answer) : null, evidence: q.evidence.map(normalisePassage) })),
    opportunities: opportunities.map(p => ({ ...p, retrievedAt: iso(p.retrievedAt)!, publishedAt: iso(p.publishedAt) })),
    collection: { ...collection, lastCollectedAt: iso(collection.lastCollectedAt) },
  };
}

// The following functions are called only by the private scheduled worker. They
// deliberately do not inspect a browser session; the worker verifies its owner.
export async function leaseQuickQuestion(): Promise<QuickJob | null> {
  return result(sql`select research_quick_lease() as result`);
}

export async function findQuickEvidence(question: string): Promise<EvidencePassage[]> {
  const terms = expandedQuickSearchTerms(z.string().max(2000).parse(question));
  if (!terms.length) return [];
  const query = terms.join(" | ");
  const evidence = await workflowRows<EvidencePassage>(sql`
    with matching_passages as (
      select version_id,ts_rank_cd(search,to_tsquery('english',${query}))+
        ts_rank_cd(to_tsvector('english',research_quick_field_words(locator)),to_tsquery('english',${query})) as relevance,
        case when lower(coalesce(locator->>'value','')) in('company','company name','/company_name','/tender/title','/title') then
          (select count(*) from jsonb_array_elements_text(${JSON.stringify(terms)}::jsonb) term where search@@plainto_tsquery('english',term.value)) else 0 end as identity_coverage,
        ts_rank_cd(search,to_tsquery('english',${query})) as value_relevance
      from research_passages candidate where workspace_id=${QCS_WORKSPACE_ID}::uuid
          and exists(select 1 from research_quick_available_passages permitted where permitted.passage_id=candidate.id)
        and (search@@to_tsquery('english',${query}) or to_tsvector('english',research_quick_field_words(locator))@@to_tsquery('english',${query}))
      union all select id,ts_rank_cd(to_tsvector('english',coalesce(metadata->>'title','')),to_tsquery('english',${query})),
        (select count(*) from jsonb_array_elements_text(${JSON.stringify(terms)}::jsonb) term where to_tsvector('english',coalesce(metadata->>'title',''))@@plainto_tsquery('english',term.value)),
        ts_rank_cd(to_tsvector('english',coalesce(metadata->>'title','')),to_tsquery('english',${query}))
        from research_versions where workspace_id=${QCS_WORKSPACE_ID}::uuid
        and to_tsvector('english',coalesce(metadata->>'title',''))@@to_tsquery('english',${query})
    ), matching_versions as (
      select version_id,max(identity_coverage) as identity_coverage,max(value_relevance) as value_relevance,sum(relevance) as relevance from matching_passages group by version_id
    ), relevant_documents as (
      select d.id as document_id,v.id as version_id,v.retrieved_at,matches.identity_coverage,matches.value_relevance,matches.relevance
      from matching_versions matches join research_versions v on v.id=matches.version_id and v.workspace_id=${QCS_WORKSPACE_ID}::uuid
      join research_documents d on d.current_version_id=v.id and d.workspace_id=v.workspace_id
      where exists(select 1 from research_quick_available_passages p where p.version_id=v.id)
      order by matches.identity_coverage desc,matches.value_relevance desc,matches.relevance desc,v.retrieved_at desc,d.id limit 3
    ), chosen as (
      select *,count(*) over() as document_count,row_number() over(order by identity_coverage desc,value_relevance desc,relevance desc,retrieved_at desc,document_id) as document_rank from relevant_documents
    ), selected as (
      select evidence.*,chosen.document_rank from chosen cross join lateral (
        select ranked.* from (
          select p.*,row_number() over(order by
            case when lower(coalesce(p.locator->>'value','')) in('company','company name','/company_name','/tender/title','/title') then 0
              when coalesce(p.locator->>'value','') ~* '(^start date$|^end date$|reporting.period|period.start|period.end)' then 1
              when to_tsvector('english',p.text||' '||research_quick_field_words(p.locator))@@to_tsquery('english',${query}) then 2
              when coalesce(p.locator->>'value','') ~* '(date|period|policy regime|payment|pay|paid|percentage|invoices|amount|status|description|title)' then 3 else 4 end,
            ts_rank_cd(to_tsvector('english',p.text||' '||research_quick_field_words(p.locator)),to_tsquery('english',${query})) desc,p.passage_id) as passage_rank
          from research_quick_available_passages p where p.version_id=chosen.version_id
        ) ranked order by passage_rank limit (${QUICK_RESEARCH_MAX_PASSAGES}/chosen.document_count)::int
      ) evidence
    ), billable as (
      select selected.*,s.daily_tokens-coalesce(b.tokens,0)>=${QUICK_RESEARCH_TOKENS} and s.daily_pence-coalesce(b.pence,0)>=${QUICK_RESEARCH_COST_PENCE} as chargeable
      from selected join research_sources s on s.id=selected.source_id and s.workspace_id=selected.workspace_id
      left join research_budget_days b on b.source_id=s.id and b.workspace_id=s.workspace_id and b.day=(now() at time zone 'UTC')::date
    ) select ${passageColumns} from billable p order by p.chargeable desc,p.document_rank,p.passage_rank`);
  return evidence.map(normalisePassage);
}

export async function attachQuickEvidence(job: QuickJob, evidence: EvidencePassage[]): Promise<boolean> {
  return result(sql`select research_quick_attach(${job.id}::uuid,${job.leaseToken},${job.runId}::uuid,${JSON.stringify(refs(evidence))}::jsonb) as result`);
}

export async function finishQuickQuestion(job: QuickJob, input: { answer: QuickAnswer; evidence: EvidencePassage[]; evidenceHash: string; modelId: string; promptVersion: string }): Promise<boolean> {
  const answer = answerSchema.parse(input.answer), evidence = refs(input.evidence);
  const allowed = new Map(evidence.map(p => [p.passageId, p]));
  if (answer.findings.some(finding => validateFinding(finding, allowed) !== "valid")) throw new WorkflowError("unknown_answer_evidence");
  z.string().min(1).max(128).parse(input.evidenceHash);
  z.string().min(1).max(200).parse(input.modelId); z.string().min(1).max(200).parse(input.promptVersion);
  return result(sql`select research_quick_finish(${job.id}::uuid,${job.leaseToken},${job.runId}::uuid,${JSON.stringify(answer)}::jsonb,${JSON.stringify(evidence)}::jsonb,${input.evidenceHash},${input.modelId},${input.promptVersion}) as result`);
}

export async function finishQuickUnchanged(job: QuickJob, evidenceHash: string): Promise<boolean> {
  z.string().min(1).max(128).parse(evidenceHash);
  return result(sql`select research_quick_unchanged(${job.id}::uuid,${job.leaseToken},${job.runId}::uuid,${evidenceHash}) as result`);
}

export async function failQuickQuestion(job: QuickJob, error: string, stopMonitoring = false): Promise<void> {
  await result(sql`select research_quick_fail(${job.id}::uuid,${job.leaseToken},${job.runId}::uuid,${error.slice(0, 500)},${stopMonitoring}) as result`);
}
