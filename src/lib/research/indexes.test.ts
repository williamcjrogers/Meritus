import { expect, it } from 'vitest';
import { comparableCohorts, summariseIndex, type ResearchIndexInput } from './indexes';
const ref = { documentId: '00000000-0000-4000-8000-000000000001', versionId: '00000000-0000-4000-8000-000000000002', passageId: '00000000-0000-4000-8000-000000000003' };
const value: ResearchIndexInput = { investigationId: ref.documentId, kind: 'adjudication', population: 'Published adjudication enforcement judgments', cohort: 'Selected English TCC judgments', from: '2026-01-01', to: '2026-12-31', inclusionRules: 'Include reviewed decisions with express adjudication enforcement issues.', missingSources: 'Unpublished decisions and private adjudications are omitted.', denominator: null, denominatorEvidence: [], observations: [{ eventKey: 'decision-1', date: '2026-06-01', included: true, evidence: [ref] }] };
it('deduplicates underlying events, separates exclusions and never invents a population rate', () => {
  const result = summariseIndex({ ...value, observations: [...value.observations, ...value.observations, { ...value.observations[0], date: '2025-12-31' }, { ...value.observations[0], eventKey: 'excluded', included: false }] });
  expect(result).toMatchObject({ numerator: 1, denominator: null, rate: null, duplicatesRemoved: 1, outsidePeriod: 1, excluded: 1 });
  expect(result.warning).toContain('do not measure all adjudications');
});
it('requires an evidenced denominator and refuses mathematically impossible results', () => {
  expect(() => summariseIndex({ ...value, denominator: 5 })).toThrow();
  expect(summariseIndex({ ...value, denominator: 5, denominatorEvidence: [ref] }).rate).toBe(0.2);
  expect(() => summariseIndex({ ...value, denominator: 1, denominatorEvidence: [ref], observations: [...value.observations, { ...value.observations[0], eventKey: 'second' }] })).toThrow('Numerator exceeds');
});
it('does not compare different Gateway cohorts or counting rules', () => {
  const gateway = { ...value, kind: 'gateway' as const };
  expect(comparableCohorts(gateway, gateway)).toBe(true);
  expect(comparableCohorts(gateway, { ...gateway, cohort: 'Different application cohort' })).toBe(false);
  expect(comparableCohorts(gateway, { ...gateway, inclusionRules: 'Different inclusion rules' })).toBe(false);
});
