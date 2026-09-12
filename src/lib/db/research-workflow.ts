import { randomUUID } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { requireDb } from "./index";
import { QCS_WORKSPACE_ID } from "@/lib/research/contracts";
import {
  requireResearchDirector,
  readResearchActor,
} from "@/lib/research/roles";
import {
  investigationRequestSchema,
  requestHash,
} from "@/lib/research/commission";
import { draftFindingSchema } from "@/lib/research/report-schema";
import { validateSourceSelection } from "@/lib/research/sources/selection";
import { investigationPayload,semanticImportSelection } from "@/lib/research/selection";
import { verifyFinding } from "@/lib/research/claims";
import { calendarState } from "@/lib/research/calendar";
import { REFERRAL_CHANNELS } from "@/lib/research/referrals";
import {
  scoreSignals,
  SCORING_VERSION,
  type SignalInput,
} from "@/lib/research/scoring";
import type {
  EvidencePassage,
  EvidenceRef,
  ResearchScope,
  ResearchBudget,
  CoverageEntry,
} from "@/lib/research/workflow-types";
import type { ResearchReport } from "@/lib/research/reports";

export class WorkflowError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
    this.name = "WorkflowError";
  }
}
export type InvestigationSummary = {
  id: string;
  question: string;
  scope: ResearchScope;
  owner: string;
  status: string;
  budget: ResearchBudget;
  createdAt: string;
  latestCompletedRunId: string | null;
};
export type SourceSettings = {
  id: string;
  label: string;
  provider: string;
  status: string;
  selection: Record<string, unknown>;
  lastSuccessAt: string | null;
  nextDueAt: string;
  configurationError: string | null;
  attribution: string;
  termsUrl: string;
  termsVersion: string;
  rightsId: string;
  dailyRequests: number;
  dailyTokens: number;
  dailyPence: number;
  credentialConfigured: boolean;
};
export type WorkflowRow = Record<string, unknown>;
const uuid = z.uuid();
const refsSchema = z
  .array(
    z
      .object({
        documentId: z.uuid(),
        versionId: z.uuid(),
        passageId: z.uuid(),
      })
      .strict(),
  )
  .min(1)
  .max(50);
export async function workflowRows<T>(query: SQL): Promise<T[]> {
  const r = await requireDb().execute(query);
  return (Array.isArray(r) ? r : r.rows) as T[];
}
async function one<T>(query: SQL): Promise<T | null> {
  return (await workflowRows<T>(query))[0] ?? null;
}
function required<T>(value: T | null, message = "not_found"): T {
  if (value === null) throw new WorkflowError(message, 404);
  return value;
}
const evidenceColumns = sql`passage_id as "passageId",version_id as "versionId",document_id as "documentId",source_id as "sourceId",text,locator,url,title,retrieved_at as "retrievedAt",published_at as "publishedAt",event_at as "eventAt",attribution`;
export async function evidenceForRefs(
  refs: EvidenceRef[],
): Promise<EvidencePassage[]> {
  await requireResearchDirector();
  if (!refs.length) return [];
  const result = await workflowRows<EvidencePassage>(
    sql`select ${evidenceColumns} from research_available_passages where workspace_id=${QCS_WORKSPACE_ID}::uuid and passage_id in (select (value->>'passageId')::uuid from jsonb_array_elements(${JSON.stringify(refs)}::jsonb))`,
  );
  const map = new Map(result.map((p) => [p.passageId, p]));
  if (
    refs.some((ref) => {
      const p = map.get(ref.passageId);
      return (
        !p || p.documentId !== ref.documentId || p.versionId !== ref.versionId
      );
    })
  )
    throw new WorkflowError("evidence_unavailable", 409);
  return result;
}
export async function listResearchSources(): Promise<SourceSettings[]> {
  await requireResearchDirector();
  return workflowRows<SourceSettings>(
    sql`select id,label,provider,status,selection,last_success_at as "lastSuccessAt",next_due_at as "nextDueAt",configuration_error as "configurationError",attribution,terms_url as "termsUrl",terms_version as "termsVersion",rights_id as "rightsId",daily_requests as "dailyRequests",daily_tokens as "dailyTokens",daily_pence as "dailyPence",credential_ref is not null as "credentialConfigured" from research_sources where workspace_id=${QCS_WORKSPACE_ID}::uuid order by label`,
  );
}
export async function listResearchRights() {
  await requireResearchDirector();
  return workflowRows<WorkflowRow>(
    sql`select id,holder,material,purpose,agreement_ref,agreement_hash,effective_at,expires_at,transfer_conditions,retention_instructions,withdrawal_instructions,use_assessment from research_rights where workspace_id=${QCS_WORKSPACE_ID}::uuid order by created_at desc`,
  );
}
export async function listResearchEntities() {
  await requireResearchDirector();
  return workflowRows<{
    id: string;
    displayName: string;
    kind: string;
    confirmed: boolean;
  }>(
    sql`select id,display_name as "displayName",kind,confirmed from research_entities where workspace_id=${QCS_WORKSPACE_ID}::uuid order by display_name limit 500`,
  );
}
export async function listInvestigations(offset = 0) {
  await requireResearchDirector();
  return workflowRows<InvestigationSummary>(
    sql`select id,question,scope,owner,status,budget,created_at as "createdAt",latest_completed_run_id as "latestCompletedRunId" from research_investigations where workspace_id=${QCS_WORKSPACE_ID}::uuid order by created_at desc,id limit 50 offset ${Math.max(0, Math.min(100000, Math.floor(offset)))}`,
  );
}
export async function getInvestigation(id: string) {
  await requireResearchDirector();
  uuid.parse(id);
  return required(
    await one<InvestigationSummary>(
      sql`select id,question,scope,owner,status,budget,created_at as "createdAt",latest_completed_run_id as "latestCompletedRunId" from research_investigations where id=${id}::uuid and workspace_id=${QCS_WORKSPACE_ID}::uuid`,
    ),
  );
}
export async function commissionInvestigation(input: unknown) {
  const actor = await requireResearchDirector();
  const request = investigationRequestSchema.parse(input);
  const sources = await listResearchSources();
  const entityNumber = request.scope.entityId
    ? (
        await one<{ value: string }>(
          sql`select value from research_identifiers where entity_id=${request.scope.entityId}::uuid and scheme='uk-company-number' and verified and workspace_id=${QCS_WORKSPACE_ID}::uuid limit 1`,
        )
      )?.value
    : null;
  const payloads: Record<string, unknown> = {};
  for (const id of request.scope.sources) {
    const source = sources.find((s) => s.id === id);
    if (!source) throw new WorkflowError("source_not_found", 404);
    payloads[id] = investigationPayload(
      source.provider,
      source.selection,
      request.scope,
      entityNumber ?? null,
    );
  }
  return required(
    await one<{ result: { investigationId: string; runId: string } }>(
      sql`select research_commission(${actor},${request.requestId}::uuid,${requestHash(request)},${request.question},${JSON.stringify(request.scope)}::jsonb,${JSON.stringify(request.budget)}::jsonb,${JSON.stringify(payloads)}::jsonb) as result`,
    ),
  ).result;
}
export async function researchEvidence(investigationId: string, query = "") {
  await getInvestigation(investigationId);
  return workflowRows<EvidencePassage>(
    sql`select ${evidenceColumns} from research_available_passages where workspace_id=${QCS_WORKSPACE_ID}::uuid and exists(select 1 from research_run_documents rd join research_runs r on r.id=rd.run_id where r.investigation_id=${investigationId}::uuid and rd.document_id=research_available_passages.document_id and rd.version_id=research_available_passages.version_id) and (${query}='' or to_tsvector('english',text)@@websearch_to_tsquery('english',${query.slice(0, 500)})) order by retrieved_at desc,passage_id limit 100`,
  );
}
export async function readResearchPassage(passageId: string) {
  await requireResearchDirector();
  uuid.parse(passageId);
  return required(
    await one<EvidencePassage>(
      sql`select ${evidenceColumns} from research_available_passages where passage_id=${passageId}::uuid and workspace_id=${QCS_WORKSPACE_ID}::uuid`,
    ),
    "evidence_unavailable",
  );
}
export async function listResearchRuns(investigationId?: string) {
  await requireResearchDirector();
  if (investigationId) uuid.parse(investigationId);
  return workflowRows<WorkflowRow>(
    sql`select r.*,coalesce((select jsonb_agg(jsonb_build_object('id',j.id,'sourceId',j.source_id,'status',j.status,'attempts',j.attempts,'error',j.error_code,'nextAttemptAt',j.next_attempt_at)) from research_jobs j where j.run_id=r.id),'[]') as jobs from research_runs r where r.workspace_id=${QCS_WORKSPACE_ID}::uuid and (${investigationId ?? null}::uuid is null or r.investigation_id=${investigationId ?? null}::uuid) order by r.created_at desc limit 100`,
  );
}
export async function listResearchClaims(investigationId: string) {
  await getInvestigation(investigationId);
  return workflowRows<WorkflowRow>(
    sql`select c.*,coalesce((select jsonb_agg(jsonb_build_object('documentId',e.document_id,'versionId',e.version_id,'passageId',e.passage_id)) from research_claim_evidence e where e.claim_id=c.id),'[]') as evidence from research_claims c where c.investigation_id=${investigationId}::uuid and c.availability='available' and not exists(select 1 from research_claim_evidence e where e.claim_id=c.id and not exists(select 1 from research_available_passages p where p.passage_id=e.passage_id and p.version_id=e.version_id and p.document_id=e.document_id)) order by c.created_at desc`,
  );
}
export async function proposeClaim(investigationId: string, input: unknown) {
  const actor = await requireResearchDirector();
  const finding = draftFindingSchema.parse(input);
  const i = await getInvestigation(investigationId);
  const evidence = await evidenceForRefs(finding.evidence);
  if (evidence.some((e) => !i.scope.sources.includes(e.sourceId)))
    throw new WorkflowError("source_outside_investigation");
  const result = verifyFinding(
    finding,
    new Map(evidence.map((p) => [p.passageId, p])),
  );
  if (result !== "supported") throw new WorkflowError(result);
  return required(
    await one<{ id: string }>(
      sql`select research_add_claim(${investigationId}::uuid,${i.scope.entityId}::uuid,${JSON.stringify(finding)}::jsonb,${actor}) as id`,
    ),
  ).id;
}
const signalSchema = z
  .object({
    entityId: z.uuid(),
    eventKey: z.string().trim().min(1).max(500),
    eventType: z.string().trim().min(1).max(120),
    kind: z.enum(["direct", "project_change", "payment", "context"]),
    occurredAt: z.iso.datetime().nullable(),
    confidence: z.number().min(0).max(1),
    halfLifeDays: z.number().positive().max(3650),
    claimIds: z.array(z.uuid()).min(1).max(30),
  })
  .strict();
export async function createSignal(investigationId: string, input: unknown) {
  await requireResearchDirector();
  await getInvestigation(investigationId);
  const v = signalSchema.parse(input),
    id = randomUUID();
  const priority = scoreSignals(
    [
      {
        id,
        eventKey: v.eventKey,
        kind: v.kind,
        occurredAt: v.occurredAt,
        confidence: v.confidence,
        halfLifeDays: v.halfLifeDays,
        independenceConfirmed: false,
        available: true,
        suppressed: false,
      },
    ],
    new Date(),
  );
  const result = await one<{ id: string }>(
    sql`with valid as(select count(*) n from research_claims where id in(select value::uuid from jsonb_array_elements_text(${JSON.stringify(v.claimIds)}::jsonb)) and investigation_id=${investigationId}::uuid and availability='available'), inserted as(insert into research_signals(id,investigation_id,entity_id,event_key,event_type,kind,occurred_at,confidence,half_life_days,independence_confirmed,scoring_version,components,score,scored_at,status,stale,revision) select ${id}::uuid,${investigationId}::uuid,${v.entityId}::uuid,${v.eventKey},${v.eventType},${v.kind},${v.occurredAt}::timestamptz,${v.confidence},${v.halfLifeDays},false,${SCORING_VERSION},${JSON.stringify(priority)}::jsonb,${priority.score},now(),'unreviewed',false,0 from valid where n=${new Set(v.claimIds).size} returning id), links as(insert into research_signal_claims(signal_id,claim_id) select inserted.id,value::uuid from inserted,jsonb_array_elements_text(${JSON.stringify([...new Set(v.claimIds)])}::jsonb) returning signal_id) select id from inserted`,
  );
  return required(result, "claim_not_found").id;
}
export async function listResearchSignals(investigationId?: string) {
  await requireResearchDirector();
  if (investigationId) uuid.parse(investigationId);
  const rows = await workflowRows<WorkflowRow>(
    sql`select s.*,e.display_name as organisation,research_signal_available(s.id) as available,exists(select 1 from research_suppressions x where x.target in(s.id,s.entity_id,s.investigation_id) and x.revoked_at is null and (x.expires_at is null or x.expires_at>now())) as suppressed from research_signals s join research_entities e on e.id=s.entity_id where s.workspace_id=${QCS_WORKSPACE_ID}::uuid and (${investigationId ?? null}::uuid is null or s.investigation_id=${investigationId ?? null}::uuid) order by s.score desc,s.created_at desc limit 200`,
  );
  return rows.map((row) => {
    const input: SignalInput = {
      id: String(row.id),
      eventKey: String(row.event_key),
      kind: row.kind as SignalInput["kind"],
      occurredAt: row.occurred_at
        ? new Date(String(row.occurred_at)).toISOString()
        : null,
      confidence: Number(row.confidence),
      halfLifeDays: Number(row.half_life_days),
      independenceConfirmed: row.independence_confirmed === true,
      available:
        row.available === true && !row.stale && row.status !== "dismissed",
      suppressed: row.suppressed === true,
    };
    return {
      ...row,
      event_type: row.available ? row.event_type : "Source changed",
      priority: scoreSignals([input], new Date()),
      scoringInput: input,
    };
  });
}
export async function reviewSignal(id: string, input: unknown) {
  const actor = await requireResearchDirector();
  uuid.parse(id);
  const v = z
    .object({
      revision: z.number().int().nonnegative(),
      action: z.enum(["approve", "dismiss", "reopen"]),
      reason: z.string().trim().min(10).max(1000),
      independenceConfirmed: z.boolean(),
    })
    .strict()
    .parse(input);
  return required(
    await one<{ id: string }>(
      sql`select research_review_signal(${id}::uuid,${actor},${v.revision},${v.action},${v.reason},${v.independenceConfirmed}) as id`,
    ),
  ).id;
}
export async function convertResearchLead(
  input: {
    signalId: string;
    ownerId: string;
    reviewId: string;
    singleEventReason: string | null;
  },
  actorId?: string,
) {
  const actor = await requireResearchDirector();
  if (actorId && actor !== actorId)
    throw new WorkflowError("actor_mismatch", 403);
  uuid.parse(input.signalId);
  uuid.parse(input.reviewId);
  if ((await readResearchActor(input.ownerId)).role !== "director")
    throw new WorkflowError("director_owner_required", 403);
  return required(
    await one<{ result: { pursuitId: string; created: boolean } }>(
      sql`select research_convert_signal(${input.signalId}::uuid,${actor},${input.ownerId},${input.reviewId}::uuid,${input.singleEventReason}) as result`,
    ),
  ).result;
}
export async function listWatchlists() {
  await requireResearchDirector();
  return workflowRows<WorkflowRow>(
    sql`select w.*,coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'entityId',e.id,'name',e.display_name,'nextRefreshAt',m.next_refresh_at,'refreshes',coalesce((select jsonb_agg(jsonb_build_object('sourceId',f.source_id,'source',src.label,'runId',f.run_id,'status',f.status,'reason',f.reason,'checkedAt',f.checked_at)) from research_watchlist_refreshes f join research_sources src on src.id=f.source_id where f.member_id=m.id),'[]'::jsonb))) from research_watchlist_members m join research_entities e on e.id=m.entity_id where m.watchlist_id=w.id),'[]') as members from research_watchlists w where w.workspace_id=${QCS_WORKSPACE_ID}::uuid order by w.created_at desc`,
  );
}
const watchSchema = z
  .object({
    label: z.string().trim().min(1).max(200),
    cadenceSeconds: z.number().int().min(3600).max(31536000),
    sources: z.array(z.uuid()).min(1).max(20),
    signalPreferences: z.array(z.string().max(100)).max(30),
    entityIds: z.array(z.uuid()).min(1).max(100),
    enabled: z.boolean(),
  })
  .strict();
export async function saveWatchlist(
  input: unknown,
  id?: string,
  revision?: number,
) {
  const actor = await requireResearchDirector();
  const v = watchSchema.parse(input);
  if (id) {uuid.parse(id);required(await one(sql`select id from research_watchlists where id=${id}::uuid and workspace_id=${QCS_WORKSPACE_ID}::uuid`));}
  const confirmed = await workflowRows<{ id: string }>(
    sql`select id from research_entities where workspace_id=${QCS_WORKSPACE_ID}::uuid and confirmed and id in(select value::uuid from jsonb_array_elements_text(${JSON.stringify(v.entityIds)}::jsonb))`,
  );
  if (confirmed.length !== new Set(v.entityIds).size)
    throw new WorkflowError("confirmed_entity_required");
  const selectedSources = await listResearchSources();
  if (v.sources.some((id) => !selectedSources.some((s) => s.id === id)))
    throw new WorkflowError("source_not_found");
  const wid = id ?? randomUUID();
  const updated = await one<{ id: string }>(
    sql`with w as(insert into research_watchlists(id,label,owner,cadence_seconds,timezone,sources,signal_preferences,enabled,revision) values(${wid}::uuid,${v.label},${actor},${v.cadenceSeconds},'Europe/London',${JSON.stringify(v.sources)}::jsonb,${JSON.stringify(v.signalPreferences)}::jsonb,${v.enabled},0) on conflict(id) do update set label=excluded.label,cadence_seconds=excluded.cadence_seconds,sources=excluded.sources,signal_preferences=excluded.signal_preferences,enabled=excluded.enabled,revision=research_watchlists.revision+1,updated_at=now() where research_watchlists.revision=${revision ?? -1} returning id), members as(insert into research_watchlist_members(watchlist_id,entity_id,next_refresh_at) select w.id,value::uuid,now() from w,jsonb_array_elements_text(${JSON.stringify([...new Set(v.entityIds)])}::jsonb) on conflict(watchlist_id,entity_id) do nothing returning id) select id,research_prune_watchlist(id,${JSON.stringify(v.entityIds)}::jsonb,${JSON.stringify(v.sources)}::jsonb,${v.enabled}) from w`,
  );
  return required(updated, "revision_conflict").id;
}
export async function suppressResearchSubject(input: unknown) {
  const actor = await requireResearchDirector();
  const v = z
    .object({
      target: z.uuid(),
      scope: z.enum(["person", "organisation", "investigation", "signal"]),
      reason: z.string().trim().min(10).max(1000),
      expiresAt: z.iso.datetime().nullable(),
    })
    .strict()
    .parse(input);
  return required(
    await one<{ id: string }>(
      sql`select research_suppress_subject(${v.target}::uuid,${v.scope},${v.reason},${v.expiresAt}::timestamptz,${actor}) as id`,
    ),
  ).id;
}
export async function createCalendarEntry(input: unknown) {
  const actor = await requireResearchDirector();
  const v = z
    .object({
      investigationId: z.uuid(),
      entityId: z.uuid().nullable(),
      kind: z.enum([
        "practical_completion",
        "retention",
        "limitation",
        "hearing",
      ]),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      evidence: refsSchema,
      jurisdiction: z.string().max(200).nullable(),
      rule: z.string().max(2000).nullable(),
      accrualBasis: z.string().max(2000).nullable(),
      assumptions: z.string().max(4000),
      reviewed: z.boolean(),
    })
    .strict()
    .parse(input);
  await getInvestigation(v.investigationId);
  await evidenceForRefs(v.evidence);
  const state = calendarState({
    ...v,
    evidenceIds: v.evidence.map((e) => e.passageId),
    reviewedBy: v.reviewed ? actor : null,
  });
  return required(
    await one<{ id: string }>(
      sql`with checked as(select research_assert_evidence(${JSON.stringify(v.evidence)}::jsonb)) insert into research_calendar(investigation_id,entity_id,kind,proposed_date,evidence,jurisdiction,rule,accrual_basis,assumptions,reviewed_by,state) select ${v.investigationId}::uuid,${v.entityId}::uuid,${v.kind},${v.date}::date,${JSON.stringify(v.evidence)}::jsonb,${v.jurisdiction},${v.rule},${v.accrualBasis},${v.assumptions},${state === "reviewed" ? actor : null},${state} from checked returning id`,
    ),
  ).id;
}
export async function listCalendarEntries() {
  await requireResearchDirector();
  return workflowRows<WorkflowRow>(
    sql`select * from research_calendar c where workspace_id=${QCS_WORKSPACE_ID}::uuid and not exists(select 1 from jsonb_array_elements(c.evidence) e where not exists(select 1 from research_available_passages p where p.document_id=(e->>'documentId')::uuid and p.version_id=(e->>'versionId')::uuid and p.passage_id=(e->>'passageId')::uuid)) order by proposed_date limit 200`,
  );
}
export async function createReferral(input: unknown) {
  const actor = await requireResearchDirector();
  const v = z
    .object({
      subjectId: z.uuid(),
      objectId: z.uuid(),
      predicate: z.string().trim().min(1).max(200),
      evidence: refsSchema,
      channel: z.enum(REFERRAL_CHANNELS),
      serviceOffer: z.string().max(1000),
      stage: z.enum([
        "researched",
        "introduced",
        "contacted",
        "active",
        "parked",
      ]),
      observedAt: z.iso.datetime(),
      confidence: z.number().min(0).max(1),
    })
    .strict()
    .parse(input);
  await evidenceForRefs(v.evidence);
  return required(
    await one<{ id: string }>(
      sql`with checked as(select research_assert_evidence(${JSON.stringify(v.evidence)}::jsonb)) insert into research_relationships(subject_id,predicate,object_id,evidence,valid_from,confidence,channel,service_offer,owner,stage) select ${v.subjectId}::uuid,${v.predicate},${v.objectId}::uuid,${JSON.stringify(v.evidence)}::jsonb,${v.observedAt}::timestamptz,${v.confidence},${v.channel},${v.serviceOffer},${actor},${v.stage} from checked returning id`,
    ),
  ).id;
}
export async function listReferrals() {
  await requireResearchDirector();
  return workflowRows<WorkflowRow>(
    sql`select r.*,s.display_name as subject,o.display_name as organisation from research_relationships r join research_entities s on s.id=r.subject_id join research_entities o on o.id=r.object_id where r.workspace_id=${QCS_WORKSPACE_ID}::uuid and not exists(select 1 from jsonb_array_elements(r.evidence) e where not exists(select 1 from research_available_passages p where p.document_id=(e->>'documentId')::uuid and p.version_id=(e->>'versionId')::uuid and p.passage_id=(e->>'passageId')::uuid)) order by r.updated_at desc limit 200`,
  );
}
export async function recordOutcome(input: unknown) {
  const actor = await requireResearchDirector();
  const v = z
    .object({
      signalId: z.uuid(),
      kind: z.enum(["conversation", "proposal", "instruction"]),
      occurredAt: z.iso.datetime(),
    })
    .strict()
    .parse(input);
  return required(
    await one<{ id: string }>(
      sql`insert into research_outcomes(signal_id,pursuit_id,kind,occurred_at,actor) select signal_id,pursuit_id,${v.kind},${v.occurredAt}::timestamptz,${actor} from research_conversions where signal_id=${v.signalId}::uuid on conflict(signal_id,kind) do update set occurred_at=excluded.occurred_at,actor=excluded.actor,updated_at=now() returning id`,
    ),
    "research_conversion_required",
  ).id;
}
export async function outcomeMetrics(from: string, to: string) {
  await requireResearchDirector();
  const f = z.iso.datetime().parse(from),
    t = z.iso.datetime().parse(to);
  return required(
    await one<{
      reviewedSignals: number;
      conversations: number;
      proposals: number;
      instructions: number;
    }>(
      sql`with cohort as(select distinct target as id from research_reviews where action='approve' and created_at>=${f}::timestamptz and created_at<${t}::timestamptz and workspace_id=${QCS_WORKSPACE_ID}::uuid) select (select count(*)::int from cohort) as "reviewedSignals",count(distinct o.signal_id) filter(where o.kind='conversation')::int as conversations,count(distinct o.signal_id) filter(where o.kind='proposal')::int as proposals,count(distinct o.signal_id) filter(where o.kind='instruction')::int as instructions from research_outcomes o join cohort c on c.id=o.signal_id where o.occurred_at>=${f}::timestamptz and o.occurred_at<${t}::timestamptz`,
    ),
  );
}
export async function recordResearchAnswer(input: {
  investigationId: string;
  runId: string;
  actor: string;
  question: string;
  answer: unknown;
  evidence: EvidenceRef[];
  modelId: string;
  promptVersion: string;
  status: string;
}) {
  const actor = await requireResearchDirector();
  if (actor !== input.actor) throw new WorkflowError("actor_mismatch", 403);
  return required(
    await one<{ id: string }>(
      sql`select research_store_answer(${input.investigationId}::uuid,${input.runId}::uuid,${actor},${input.question},${JSON.stringify(input.answer)}::jsonb,${JSON.stringify(input.evidence)}::jsonb,${input.modelId},${input.promptVersion}) as id`,
    ),
  ).id;
}
export async function listResearchAnswers(investigationId: string) {
  await getInvestigation(investigationId);
  return workflowRows<WorkflowRow>(
    sql`select c.id,c.question,c.status,c.created_at,case when c.status<>'stale' and not exists(select 1 from jsonb_array_elements(c.evidence) e where not exists(select 1 from research_available_passages p where p.passage_id=(e->>'passageId')::uuid and p.version_id=(e->>'versionId')::uuid and p.document_id=(e->>'documentId')::uuid)) then c.answer else '{"findings":[],"limitations":["Source changed. Regenerate the answer."]}'::jsonb end as answer from research_conversations c where investigation_id=${investigationId}::uuid order by created_at desc limit 30`,
  );
}
export async function createResearchReport(
  investigationId: string,
  input: unknown,
) {
  const actor = await requireResearchDirector();
  await getInvestigation(investigationId);
  const v = z
    .object({
      runId: z.uuid(),
      audience: z.enum(["internal", "external"]),
      findings: z.array(draftFindingSchema).min(1).max(100),
      methodology: z.string().trim().min(20).max(4000),
    })
    .strict()
    .parse(input);
  const refs = v.findings.flatMap((f) => f.evidence),
    evidence = await evidenceForRefs(refs),
    permitted = new Map(evidence.map((p) => [p.passageId, p]));
  for (const f of v.findings) {
    const verdict = verifyFinding(f, permitted);
    if (verdict !== "supported") throw new WorkflowError(verdict);
  }
  const run = required(
    await one<{
      coverage: Record<string, { complete: boolean; notes: string[] }>;
    }>(
      sql`select coverage from research_runs where id=${v.runId}::uuid and investigation_id=${investigationId}::uuid`,
    ),
  );
  const coverage: CoverageEntry[] = Object.entries(run.coverage).map(
    ([sourceId, c]) => ({
      sourceId,
      state: c.complete ? "complete" : "partial",
      note: c.notes.join("; "),
    }),
  );
  const id = randomUUID();
  await workflowRows(
    sql`with checked as(select research_assert_evidence(${JSON.stringify(refs)}::jsonb)), report as(insert into research_reports(id,investigation_id,run_id,audience,status,findings,coverage,methodology) select ${id}::uuid,${investigationId}::uuid,${v.runId}::uuid,${v.audience},'draft',${JSON.stringify(v.findings)}::jsonb,${JSON.stringify(coverage)}::jsonb,${v.methodology} from checked returning id), links as(insert into research_report_evidence(report_id,document_id,version_id,passage_id) select report.id,(e->>'documentId')::uuid,(e->>'versionId')::uuid,(e->>'passageId')::uuid from report,jsonb_array_elements(${JSON.stringify(refs)}::jsonb) e on conflict do nothing returning id) insert into research_reviews(actor,action,target,reason,"references") select ${actor},'report_draft',id,'Research report drafted','{}' from report`,
  );
  return id;
}
export async function getResearchReport(id: string) {
  await requireResearchDirector();
  uuid.parse(id);
  const row = required(
    await one<ResearchReport>(
      sql`select id,investigation_id as "investigationId",run_id as "runId",audience,status,findings,coverage,methodology,created_at as "createdAt" from research_reports where id=${id}::uuid and workspace_id=${QCS_WORKSPACE_ID}::uuid`,
    ),
  );
  if (row.status === "stale") throw new WorkflowError("report_stale", 409);
  const refs = row.findings.flatMap((f) => f.evidence);
  const evidence = await evidenceForRefs(refs);
  const i = await getInvestigation(row.investigationId);
  if (
    await one(
      sql`select id from research_suppressions where target in(${row.investigationId}::uuid,${i.scope.entityId}::uuid) and revoked_at is null and (expires_at is null or expires_at>now()) limit 1`,
    )
  )
    throw new WorkflowError("subject_suppressed", 409);
  return { report: row, evidence };
}
export async function listResearchReports(investigationId?: string) {
  await requireResearchDirector();
  return workflowRows<WorkflowRow>(
    sql`select id,investigation_id,run_id,audience,status,created_at from research_reports where workspace_id=${QCS_WORKSPACE_ID}::uuid and (${investigationId ?? null}::uuid is null or investigation_id=${investigationId ?? null}::uuid) order by created_at desc limit 100`,
  );
}
export async function reviewResearchReport(id: string, input: unknown) {
  const actor = await requireResearchDirector();
  const data = z
    .object({
      reason: z.string().trim().min(20).max(2000),
      acceptedSourceIds: z.array(z.uuid()).max(100),
    })
    .strict()
    .parse(input);
  const { report, evidence } = await getResearchReport(id);
  if (
    report.audience === "external" &&
    evidence.some((e) => !data.acceptedSourceIds.includes(e.sourceId))
  )
    throw new WorkflowError("review_each_source_rights");
  await workflowRows(
    sql`with checked as(select research_assert_evidence(${JSON.stringify(evidence.map(({documentId,versionId,passageId})=>({documentId,versionId,passageId})))}::jsonb)), reviewed as(update research_reports set status='reviewed',reviewer=${actor},updated_at=now() from checked where id=${id}::uuid and status<>'stale' returning id) insert into research_reviews(actor,action,target,reason,"references") select ${actor},'report_review',id,${data.reason},${JSON.stringify({ acceptedSourceIds: data.acceptedSourceIds })}::jsonb from reviewed`,
  );
}
export async function maskResearchPursuitSummaries<
  T extends { id: string; summary: string | null },
>(pursuits: T[]): Promise<T[]> {
  if (!pursuits.length) return pursuits;
  const rows = await workflowRows<{ pursuitId: string; available: boolean }>(
    sql`select c.pursuit_id as "pursuitId",not exists(select 1 from research_conversion_evidence e where e.conversion_id=c.id and not exists(select 1 from research_documents d join research_versions v on v.id=d.current_version_id join research_sources s on s.id=d.source_id join research_rights r on r.id=s.rights_id where v.id=e.version_id and v.availability='available' and d.status='available' and r.effective_at<=now() and (r.expires_at is null or r.expires_at>now()))) as available from research_conversions c where c.pursuit_id in(select value from jsonb_array_elements_text(${JSON.stringify(pursuits.map((p) => p.id))}::jsonb))`,
  );
  const unavailable = new Set(
    rows.filter((r) => !r.available).map((r) => r.pursuitId),
  );
  return pursuits.map((p) =>
    unavailable.has(p.id) ? { ...p, summary: null } : p,
  );
}
export async function maskResearchPursuitSummary<
  T extends { id: string; summary: string | null },
>(pursuit: T): Promise<T> {
  return (await maskResearchPursuitSummaries([pursuit]))[0];
}
export async function isResearchPursuitAvailable(id: string): Promise<boolean> {
  return (
    (
      await one<{ available: boolean }>(
        sql`select research_pursuit_available(${id}) as available`,
      )
    )?.available === true
  );
}
export async function createResearchRights(input: unknown) {
  const actor = await requireResearchDirector();
  const v = z
    .object({
      holder: z.string().trim().min(1).max(200),
      material: z.string().trim().min(1).max(1000),
      purpose: z.string().trim().min(10).max(4000),
      agreementRef: z.string().trim().min(1).max(1000),
      agreementText: z.string().trim().min(20).max(50000),
      effectiveAt: z.iso.datetime(),
      expiresAt: z.iso.datetime().nullable(),
      transferConditions: z.string().max(4000),
      retentionInstructions: z.string().max(4000),
      withdrawalInstructions: z.string().max(4000),
      useAssessment: z.string().trim().min(20).max(4000),
    })
    .strict()
    .parse(input);
  const id = randomUUID();
  await workflowRows(
    sql`with inserted as(insert into research_rights(id,holder,material,purpose,agreement_ref,agreement_hash,effective_at,expires_at,transfer_conditions,retention_instructions,withdrawal_instructions,use_assessment) values(${id}::uuid,${v.holder},${v.material},${v.purpose},${v.agreementRef},${requestHash(v.agreementText)},${v.effectiveAt}::timestamptz,${v.expiresAt}::timestamptz,${JSON.stringify({ instructions: v.transferConditions })}::jsonb,${JSON.stringify({ instructions: v.retentionInstructions })}::jsonb,${JSON.stringify({ instructions: v.withdrawalInstructions })}::jsonb,${v.useAssessment}) returning id) insert into research_reviews(actor,action,target,reason,"references") select ${actor},'rights_recorded',id,'Director recorded source terms','{}' from inserted`,
  );
  return id;
}
export async function updateResearchSource(id: string, input: unknown) {
  const actor = await requireResearchDirector();
  uuid.parse(id);
  const v = z
    .object({
      status: z.enum(["ready", "paused", "unavailable"]),
      dailyRequests: z.number().int().nonnegative().max(1000000),
      dailyTokens: z.number().int().nonnegative().max(100000000),
      dailyPence: z.number().int().nonnegative().max(1000000),
      selection: z.record(z.string(), z.unknown()).optional(),
    })
    .strict()
    .parse(input);
  const source = required(
    await one<{
      provider: string;
      selection: Record<string, unknown>;
      credentialRef: string | null;
    }>(
      sql`select provider,selection,credential_ref as "credentialRef" from research_sources where id=${id}::uuid and workspace_id=${QCS_WORKSPACE_ID}::uuid`,
    ),
  );
  const selection = v.selection ?? source.selection;
  if (v.status === "ready") {
    if (source.credentialRef && !process.env[source.credentialRef])
      throw new WorkflowError("credential_missing");
    if (
      ![
        "research-import",
        "commercial-import",
        "court-listings",
        "bailii",
      ].includes(source.provider) &&
      !validateSourceSelection(source.provider, selection).valid
    )
      throw new WorkflowError("source_selection_required");
  }
  return required(
    await one<{ id: string }>(
      sql`with updated as(update research_sources s set status=${v.status},daily_requests=${v.dailyRequests},daily_tokens=${v.dailyTokens},daily_pence=${v.dailyPence},selection=${JSON.stringify(selection)}::jsonb,configuration_error=null,updated_at=now() where s.id=${id}::uuid and s.workspace_id=${QCS_WORKSPACE_ID}::uuid and (${v.status}<>'ready' or exists(select 1 from research_rights r where r.id=s.rights_id and r.effective_at<=now() and (r.expires_at is null or r.expires_at>now()))) returning id), reviewed as(insert into research_reviews(actor,action,target,reason,"references") select ${actor},'source_settings',id,'Director updated source status and limits','{}' from updated) select id from updated`,
    ),
    "source_rights_required",
  ).id;
}
export async function createWorkflowEntity(input: unknown) {
  await requireResearchDirector();
  const v = z
    .object({
      displayName: z.string().trim().min(1).max(300),
      kind: z.enum([
        "company",
        "person",
        "project",
        "case",
        "adviser",
        "group",
        "contract",
      ]),
      jurisdiction: z.string().trim().min(1).max(100),
    })
    .strict()
    .parse(input);
  return required(
    await one<{ id: string }>(
      sql`insert into research_entities(display_name,kind,jurisdiction,confirmed) values(${v.displayName},${v.kind},${v.jurisdiction},false) returning id`,
    ),
  ).id;
}
export async function confirmWorkflowEntity(id: string, input: unknown) {
  const actor = await requireResearchDirector();
  const v = z
    .object({
      evidence: refsSchema,
      reason: z.string().trim().min(20).max(1000),
    })
    .strict()
    .parse(input);
  await evidenceForRefs(v.evidence);
  uuid.parse(id);
  await workflowRows(
    sql`with checked as(select research_assert_evidence(${JSON.stringify(v.evidence)}::jsonb)), updated as(update research_entities set confirmed=true,updated_at=now() from checked where id=${id}::uuid and workspace_id=${QCS_WORKSPACE_ID}::uuid returning id) insert into research_reviews(actor,action,target,reason,"references") select ${actor},'entity_confirmed',id,${v.reason},${JSON.stringify({ evidence: v.evidence })}::jsonb from updated`,
  );
}

export async function commissionImportedResearch(
  input: unknown,
  sourceId: string,
  selection: Record<string, unknown>,
  contentHash?: string,
) {
  const actor = await requireResearchDirector(),
    request = investigationRequestSchema.parse(input);
  const source = (await listResearchSources()).find((s) => s.id === sourceId);
  if (
    !source ||
    request.scope.sources.length !== 1 ||
    request.scope.sources[0] !== sourceId
  )
    throw new WorkflowError("source_not_found");
  const payloads = {
    [sourceId]: investigationPayload(
      source.provider,
      selection,
      request.scope,
      null,
    ),
  };
  return required(
    await one<{ result: { investigationId: string; runId: string } }>(
      sql`select research_commission(${actor},${request.requestId}::uuid,${requestHash({ request, selection:semanticImportSelection(selection), contentHash:contentHash??null })},${request.question},${JSON.stringify(request.scope)}::jsonb,${JSON.stringify(request.budget)}::jsonb,${JSON.stringify(payloads)}::jsonb) as result`,
    ),
  ).result;
}
export async function listResearchDocuments() {
  await requireResearchDirector();
  return workflowRows<WorkflowRow>(
    sql`select d.id,d.provider_id,d.status,d.canonical_url,d.current_version_id,s.label as source,(select reason from research_invalidations where version_id=v.id limit 1) as withdrawal_reason from research_documents d join research_sources s on s.id=d.source_id left join research_versions v on v.id=d.current_version_id where d.workspace_id=${QCS_WORKSPACE_ID}::uuid order by d.updated_at desc limit 200`,
  );
}
export async function requestResearchReinstatement(id: string, input: unknown) {
  const actor = await requireResearchDirector(),
    v = z
      .object({ reason: z.string().trim().min(20).max(2000) })
      .strict()
      .parse(input);
  uuid.parse(id);
  return required(
    await one<{ id: string }>(
      sql`insert into research_reviews(actor,action,target,reason,"references") select ${actor},'reinstate',id,${v.reason},jsonb_build_object('versionId',current_version_id) from research_documents where id=${id}::uuid and workspace_id=${QCS_WORKSPACE_ID}::uuid and status<>'available' returning id`,
    ),
    "unavailable_document_required",
  ).id;
}

export async function deleteResearchWatchlist(id:string){const actor=await requireResearchDirector();uuid.parse(id);await workflowRows(sql`select research_delete_watchlist(${id}::uuid,${actor})`);}
