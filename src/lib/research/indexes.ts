import { z } from 'zod';
import { evidenceRefSchema } from './report-schema';
import type { EvidenceRef } from './workflow-types';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
export const indexSchema = z.object({
  investigationId: z.uuid(),
  kind: z.enum(['adjudication', 'gateway']),
  population: z.string().trim().min(20).max(2000),
  cohort: z.string().trim().min(5).max(1000),
  from: date,
  to: date,
  inclusionRules: z.string().trim().min(20).max(4000),
  missingSources: z.string().trim().min(5).max(2000),
  denominator: z.number().int().positive().max(100000000).nullable(),
  denominatorEvidence: z.array(evidenceRefSchema).max(20),
  observations: z.array(z.object({
    eventKey: z.string().trim().min(1).max(500),
    date,
    included: z.boolean(),
    evidence: z.array(evidenceRefSchema).min(1).max(20),
  }).strict()).min(1).max(1000),
}).strict().refine(v => v.from <= v.to, 'The start date must precede the end date')
  .refine(v => v.denominator === null || v.denominatorEvidence.length > 0, 'A population denominator requires source evidence');
export type ResearchIndexInput = z.infer<typeof indexSchema>;
export type IndexSummary = { numerator: number; denominator: number | null; rate: number | null; duplicatesRemoved: number; outsidePeriod: number; excluded: number; warning: string; evidence: EvidenceRef[] };

/** Event identity is director supplied. Repeated publications do not increase the count. */
export function summariseIndex(input: ResearchIndexInput): IndexSummary {
  const value = indexSchema.parse(input);
  const eligible = value.observations.filter(o => o.date >= value.from && o.date <= value.to);
  const included = eligible.filter(o => o.included);
  const events = new Set(included.map(o => o.eventKey));
  if (value.denominator !== null && events.size > value.denominator) throw new Error('Numerator exceeds the evidenced denominator');
  const refs = [...value.denominatorEvidence, ...included.flatMap(o => o.evidence)];
  return {
    numerator: events.size,
    denominator: value.denominator,
    rate: value.denominator === null ? null : events.size / value.denominator,
    duplicatesRemoved: included.length - events.size,
    outsidePeriod: value.observations.length - eligible.length,
    excluded: eligible.length - included.length,
    warning: value.kind === 'adjudication'
      ? 'This index describes the selected published corpus. Enforcement judgments do not measure all adjudications.'
      : 'Compare only the stated cohort and measurement window. Aggregate Gateway data does not establish a named project delay.',
    evidence: [...new Map(refs.map(ref => [ref.passageId, ref])).values()],
  };
}

export function comparableCohorts(a: Pick<ResearchIndexInput, 'kind' | 'cohort' | 'population' | 'inclusionRules'>, b: Pick<ResearchIndexInput, 'kind' | 'cohort' | 'population' | 'inclusionRules'>): boolean {
  return a.kind === b.kind && a.cohort === b.cohort && a.population === b.population && a.inclusionRules === b.inclusionRules;
}
