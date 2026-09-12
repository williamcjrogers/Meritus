import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { QCS_WORKSPACE_ID } from '@/lib/research/contracts';
import { readResearchActor, requireResearchDirector } from '@/lib/research/roles';
import { indexSchema, summariseIndex } from '@/lib/research/indexes';
import type { EvidenceRef } from '@/lib/research/workflow-types';
import { evidenceForRefs, getInvestigation, workflowRows, WorkflowError } from './research-workflow';

export const decisionSchema = z.object({
  revision: z.number().int().nonnegative(),
  action: z.enum(['annotate', 'assign', 'revisit', 'merge']),
  note: z.string().trim().min(10).max(4000),
  ownerId: z.string().min(1).max(200).nullable(),
  revisitAt: z.iso.datetime().nullable(),
  relatedSignalId: z.uuid().nullable(),
}).strict().refine(v => v.action !== 'assign' || v.ownerId !== null, 'Choose a director owner')
  .refine(v => v.action !== 'revisit' || v.revisitAt !== null, 'Enter the revisit date')
  .refine(v => v.action !== 'merge' || v.relatedSignalId !== null, 'Choose the equivalent event');

export async function decideResearchSignal(signalId: string, input: unknown) {
  const actor = await requireResearchDirector();
  z.uuid().parse(signalId);
  const value = decisionSchema.parse(input);
  if (value.ownerId && (await readResearchActor(value.ownerId)).role !== 'director') throw new WorkflowError('director_owner_required', 403);
  const evidence = await workflowRows<EvidenceRef>(sql`select distinct e.document_id as "documentId",e.version_id as "versionId",e.passage_id as "passageId" from research_claim_evidence e join research_signal_claims sc on sc.claim_id=e.claim_id where sc.signal_id=${signalId}::uuid`);
  await evidenceForRefs(evidence);
  const rows = await workflowRows<{ id: string }>(sql`select research_decide_signal(${signalId}::uuid,${value.revision},${actor},${value.action},${value.note},${value.ownerId},${value.revisitAt}::timestamptz,${value.relatedSignalId}::uuid,${JSON.stringify(evidence)}::jsonb) as id`);
  return rows[0];
}

export async function researchDecisions(signalId: string) {
  await requireResearchDirector(); z.uuid().parse(signalId);
  return workflowRows<{ id: string; action: string; actor: string; owner_id: string | null; revisit_at: string | null; note: string; created_at: string }>(sql`select x.id,x.action,x.actor,x.owner_id,x.revisit_at,x.created_at,case when research_signal_available(x.signal_id) and not exists(select 1 from jsonb_array_elements(x.evidence) e where not exists(select 1 from research_available_passages p where p.passage_id=(e->>'passageId')::uuid and p.version_id=(e->>'versionId')::uuid and p.document_id=(e->>'documentId')::uuid)) then x.note else 'Source changed. Review the decision.' end as note from research_signal_decisions x where x.workspace_id=${QCS_WORKSPACE_ID}::uuid and x.signal_id=${signalId}::uuid order by x.created_at desc limit 100`);
}

export async function pursuitResearchLink(pursuitId: string) {
  await requireResearchDirector();
  return (await workflowRows<{ investigationId: string; signalId: string; needsReview: boolean; available: boolean }>(sql`select s.investigation_id as "investigationId",s.id as "signalId",c.needs_review as "needsReview",research_signal_available(s.id) as available from research_conversions c join research_signals s on s.id=c.signal_id where c.pursuit_id=${pursuitId} and c.workspace_id=${QCS_WORKSPACE_ID}::uuid limit 1`))[0] ?? null;
}

export async function listResearchDigests() {
  await requireResearchDirector();
  const digests = await workflowRows<{ id: string; week_start: string; signal_ids: string[]; calendar_ids: string[]; source_coverage: unknown; created_at: string }>(sql`select * from research_weekly_digests where workspace_id=${QCS_WORKSPACE_ID}::uuid order by week_start desc limit 12`);
  const signalIds = [...new Set(digests.flatMap(d => d.signal_ids))];
  const calendarIds = [...new Set(digests.flatMap(d => d.calendar_ids))];
  const [signals, calendar] = await Promise.all([
    workflowRows<Record<string, unknown>>(sql`select s.id,s.investigation_id,e.display_name as organisation,s.event_type,s.status,true as available,false as suppressed from research_signals s join research_entities e on e.id=s.entity_id where s.workspace_id=${QCS_WORKSPACE_ID}::uuid and s.id in(select value::uuid from jsonb_array_elements_text(${JSON.stringify(signalIds)}::jsonb)) and research_signal_available(s.id) and not exists(select 1 from research_suppressions x where x.target in(s.id,s.entity_id,s.investigation_id) and x.revoked_at is null and (x.expires_at is null or x.expires_at>now()))`),
    workflowRows<Record<string, unknown>>(sql`select c.id,c.kind,c.proposed_date,c.state from research_calendar c where c.workspace_id=${QCS_WORKSPACE_ID}::uuid and c.id in(select value::uuid from jsonb_array_elements_text(${JSON.stringify(calendarIds)}::jsonb)) and not exists(select 1 from jsonb_array_elements(c.evidence) e where not exists(select 1 from research_available_passages p where p.passage_id=(e->>'passageId')::uuid and p.version_id=(e->>'versionId')::uuid and p.document_id=(e->>'documentId')::uuid)) and not exists(select 1 from research_suppressions x where x.target in(c.entity_id,c.investigation_id) and x.revoked_at is null and (x.expires_at is null or x.expires_at>now()))`),
  ]);
  return digests.map(d => ({ ...d, signals: signals.filter(s => d.signal_ids.includes(String(s.id)) && s.available && !s.suppressed), calendar: calendar.filter(c => d.calendar_ids.includes(String(c.id))), unavailableSignals: d.signal_ids.filter(id => !signals.some(s => s.id === id && s.available && !s.suppressed)).length, methodology: 'Weekly internal selection of up to 200 available, unsuppressed signals ranked at collection time. Current evidence availability is checked again whenever this digest is opened. This is research priority, not a prediction of litigation.' }));
}

export async function saveResearchIndex(input: unknown) {
  const actor = await requireResearchDirector();
  const value = indexSchema.parse(input);
  const investigation = await getInvestigation(value.investigationId);
  const summary = summariseIndex(value);
  const refs = [...value.denominatorEvidence, ...value.observations.flatMap(o => o.evidence)];
  const evidence = await evidenceForRefs(refs);
  if (evidence.some(e => !investigation.scope.sources.includes(e.sourceId))) throw new WorkflowError('source_outside_investigation');
  return (await workflowRows<{ id: string }>(sql`with checked as(select research_assert_evidence(${JSON.stringify(refs)}::jsonb)) insert into research_indexes(investigation_id,kind,specification,summary,evidence,actor) select ${value.investigationId}::uuid,${value.kind},${JSON.stringify(value)}::jsonb,${JSON.stringify(summary)}::jsonb,${JSON.stringify(refs)}::jsonb,${actor} from checked returning id`))[0];
}

export async function listResearchIndexes() {
  await requireResearchDirector();
  const rows = await workflowRows<{ id: string; investigation_id: string; kind: string; specification: unknown; summary: unknown; created_at: string; evidence: EvidenceRef[] }>(sql`select x.* from research_indexes x where x.workspace_id=${QCS_WORKSPACE_ID}::uuid and x.specification<>'{}'::jsonb and not exists(select 1 from jsonb_array_elements(x.evidence) e where not exists(select 1 from research_available_passages p where p.passage_id=(e->>'passageId')::uuid and p.version_id=(e->>'versionId')::uuid and p.document_id=(e->>'documentId')::uuid)) and not exists(select 1 from research_suppressions s join research_investigations i on i.id=x.investigation_id where s.target in(i.id,nullif(i.scope->>'entityId','')::uuid) and s.revoked_at is null and (s.expires_at is null or s.expires_at>now())) order by x.created_at desc limit 100`);
  return rows;
}
