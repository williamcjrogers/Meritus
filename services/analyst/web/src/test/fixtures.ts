export const syntheticFixtures = {
  session: { username: 'synthetic.analyst', csrf_token: 'synthetic-csrf' },
  watchlist: {
    items: [
      {
        entity_id: 'synthetic-entity-1', entity_key: 'GB-COH:01234567', name: 'Synthetic Civils Ltd', kind: 'organisation', score: 68,
        eligible: true, independent_events: 2, source_ids: ['gazette', 'companies_house'], latest_evidence_at: '2026-09-10T09:00:00Z',
        reasons: ['Insolvency petition', 'Accounts overdue'], gaps: [], stage: 'triage',
        contributions: [{ observation_id: 'synthetic-observation-1', event_key: 'insolvency-1', family: 'insolvency', kind: 'insolvency_petition', age_days: 2, points: 40, evidence_url: 'https://example.test/evidence/1' }],
      },
    ],
    total: 1, page: 1, page_size: 25, as_of: '2026-09-12T08:00:00Z', rule_version: 'synthetic-v1', synthetic: true,
  },
  emptyWatchlist: { items: [], total: 0, page: 1, page_size: 25, as_of: '2026-09-12T08:00:00Z', rule_version: 'synthetic-v1', synthetic: true },
  reviews: {
    items: [{ id: 'review-item-1', target_type: 'observation', target_id: 'synthetic-observation-1', review_type: 'observation', headline: 'Synthetic insolvency petition', state: 'pending', actor: null, created_at: '2026-09-11T10:00:00Z' }], total: 1, page: 1, page_size: 25,
  },
  ambiguousReview: {
    id: 'review-identity-1', target_type: 'entity', target_id: 'synthetic-entity-2', review_type: 'identity', headline: 'Possible match: Synth Build / Synth Building', state: 'pending', actor: null,
  },
  reviewedItem: {
    id: 'review-audit-1', target_type: 'observation', target_id: 'synthetic-observation-3', review_type: 'observation', headline: 'Synthetic reviewed observation', state: 'verified', action: 'accept', actor: 'synthetic.reviewer', reason: 'Source and identity checked', created_at: '2026-09-10T11:30:00Z',
  },
  sources: {
    items: [{ id: 'hmcts', name: 'HMCTS', description: 'Court source', home_url: 'https://example.test', licence_url: 'https://example.test/licence', enabled: false, requires_permission: true, credential_names: [], permissions: {}, config: {}, status: 'needs_permission', last_success_at: null, last_error: null }], total: 1, page: 1, page_size: 25,
  },
}
