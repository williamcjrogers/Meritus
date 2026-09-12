import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { syntheticFixtures } from './fixtures'

export const handlers = [
  http.get('/api/auth/setup-status', () => HttpResponse.json({ needs_setup: false })),
  http.get('/api/auth/me', () => HttpResponse.json(syntheticFixtures.session)),
  http.get('/api/watchlist', () => HttpResponse.json(syntheticFixtures.watchlist)),
  http.get('/api/alerts', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 25 })),
  http.get('/api/reviews', () => HttpResponse.json(syntheticFixtures.reviews)),
  http.get('/api/sources', () => HttpResponse.json(syntheticFixtures.sources)),
  http.get('/api/runs', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 25 })),
  http.get('/api/evidence', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 25 })),
  http.get('/api/entities', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 25 })),
  http.get('/api/opportunities', () => HttpResponse.json({ project_exposures: [], introduction_routes: [], conflict_review_prompts: [], totals: { project_exposures: 0, introduction_routes: 0, conflict_review_prompts: 0 }, page: 1, page_size: 25, truncated: false, as_of: '2026-09-12T08:00:00Z', coverage: 'Only readable verified evidence and documented roles are considered.' })),
  http.get('/api/calendar/actionable', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 25 })),
  http.get('/api/calendar', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 25 })),
  http.get('/api/relationships', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 25 })),
  http.get('/api/pipeline', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 25 })),
  http.get('/api/metrics', () => HttpResponse.json({ as_of: '2026-09-12T08:00:00Z', filters: { cohort: null, date_from: null, date_to: '2026-09-12T08:00:00Z', follow_up_through: '2026-09-12T08:00:00Z' }, denominator_scope: { reviewed_recommendations: 'distinct entity recommendations reviewed in scope', contacted_opportunities: 'distinct entities reaching contacted or a later stage' }, denominators: { conversation_rate_reviewed: 0, conversation_rate_contacted: 0 }, counts: { reviewed_recommendations: 0, contacted_opportunities: 0, conversations: 0, instructions: 0 }, conversation_rate_reviewed: null, conversation_rate_contacted: null, benchmark_assessment: 'insufficient_observation_time', synthetic: true })),
  http.get('/api/snapshots', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 25 })),
  http.get('/api/indices', () => HttpResponse.json({ series: [], coverage: [], suppressed_points: 0, suppressed: [], methodology: 'Missing windows remain missing.' })),
]

export const server = setupServer(...handlers)
