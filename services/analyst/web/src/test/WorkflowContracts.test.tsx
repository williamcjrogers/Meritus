import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { server } from './server'
import { syntheticFixtures } from './fixtures'
import { formatIndexLabel, formatReportingWindow } from '../format'

const entity = { id: 'entity-1', key: 'GB-COH:01234567', scheme: 'GB-COH', identifier: '01234567', name: 'Synthetic contract entity', kind: 'organisation', verified: true }
const list = (items: unknown[]) => ({ items, total: items.length, page: 1, page_size: 25 })
const metricsFixture = {
  as_of: '2026-09-12T08:00:00Z', filters: { cohort: null, date_from: null, date_to: '2026-09-12T08:00:00Z', follow_up_through: '2026-09-12T08:00:00Z' },
  denominator_scope: { reviewed_recommendations: 'distinct entity recommendations reviewed in scope', contacted_opportunities: 'distinct entities reaching contacted or a later stage' },
  denominators: { conversation_rate_reviewed: 10, conversation_rate_contacted: 4 },
  counts: { reviewed_recommendations: 10, contacted_opportunities: 4, conversations: 2, instructions: 1 },
  conversation_rate_reviewed: 0.2, conversation_rate_contacted: 0.5, benchmark_assessment: 'insufficient_observation_time',
}

describe('server workflow contracts', () => {
  it('formats date windows and known index acronyms without altering arbitrary source labels', () => {
    expect(formatReportingWindow('2026-08-31T00:00:00+00:00')).toBe('31 August 2026')
    expect(formatReportingWindow('2026-08-31')).toBe('31 August 2026')
    expect(formatReportingWindow('2026-Q1')).toBe('2026-Q1')
    expect(formatReportingWindow('Reporting window A')).toBe('Reporting window A')
    expect(formatReportingWindow('2026-02-31')).toBe('2026-02-31')
    expect(formatIndexLabel('bsr_gateway')).toBe('BSR gateway')
    expect(formatIndexLabel('new_hrbs_and_conversions_complex_cases')).toBe('New HRBs and conversions complex cases')
    expect(formatIndexLabel('hrb_internal_works')).toBe('HRB internal works')
    expect(formatIndexLabel('nhs_internal_works')).toBe('NHS internal works')
  })
  it('records the canonical shortlist stage and displays the two server rates with their denominators', async () => {
    let saved: unknown; let query = ''
    server.use(http.get('/api/entities', () => HttpResponse.json(list([entity]))), http.get('/api/metrics', ({ request }) => { query = new URL(request.url).search; return HttpResponse.json(metricsFixture) }), http.post('/api/pipeline', async ({ request }) => { saved = await request.json(); return HttpResponse.json({ id: 'action-1' }) }))
    window.history.replaceState({}, '', '/pipeline'); const user = userEvent.setup(); render(<App />)
    const stages = await screen.findByLabelText('Pipeline stage')
    expect(within(stages).getAllByRole('option').map(option => (option as HTMLOptionElement).value)).toEqual(['review', 'shortlisted', 'introduction_considered', 'contacted', 'conversation', 'instruction', 'dismissed', 'snoozed'])
    expect(await screen.findByText('20%')).toBeVisible(); expect(screen.getByText('50%')).toBeVisible()
    expect(screen.getByText('2 conversations / 10 reviewed recommendations')).toBeVisible()
    expect(screen.getByText('2 conversations / 4 contacted opportunities')).toBeVisible()
    await user.selectOptions(screen.getByLabelText('Entity'), entity.id); await user.selectOptions(stages, 'shortlisted'); await user.type(screen.getByLabelText('Action note'), 'Reviewed for shortlist'); await user.click(screen.getByRole('button', { name: 'Record pipeline action' }))
    await waitFor(() => expect(saved).toEqual({ entity_id: entity.id, stage: 'shortlisted', note: 'Reviewed for shortlist' }))
    await user.type(screen.getByLabelText('Cohort'), 'autumn'); await user.type(screen.getByLabelText('Reviewed from (DD/MM/YYYY)'), '01/09/2026'); await user.type(screen.getByLabelText('Reviewed to (DD/MM/YYYY)'), '12/09/2026'); await user.click(screen.getByRole('button', { name: 'Apply metric filters' }))
    await waitFor(() => { expect(query).toContain('cohort=autumn'); expect(query).toContain('date_from=2026-09-01'); expect(query).toContain('date_to=2026-09-12') })
  })

  it('uses engine family values and exposes actual coverage and review state', async () => {
    server.use(http.get('/api/watchlist', () => HttpResponse.json({ ...syntheticFixtures.watchlist, items: [{ ...syntheticFixtures.watchlist.items[0], review_state: 'rejected' }], coverage: { complete: false, database_enumeration_complete: true, truncated: false, incomplete_sources: ['hmcts'], entities_considered: 15, source_records_considered: 42 } })))
    const user = userEvent.setup(); render(<App />)
    await user.selectOptions(await screen.findByLabelText('Signal family'), 'procurement_performance')
    expect(window.location.search).toContain('signal_family=procurement_performance')
    await user.selectOptions(screen.getByLabelText('Pipeline stage'), 'shortlisted'); await user.selectOptions(screen.getByLabelText('Review state'), 'rejected')
    expect(window.location.search).toContain('review_state=rejected')
    expect(await screen.findByText('15 entities and 42 source records considered.')).toBeVisible()
    expect(screen.getByText('Incomplete sources: Hmcts')).toBeVisible()
    expect(within(screen.getByRole('table')).getByText('Rejected')).toBeVisible()
  })

  it('renders grouped index points and suppression without inventing missing values', async () => {
    server.use(http.get('/api/indices', () => HttpResponse.json({ series: [{ source_id: 'bsa_gateway', kind: 'gateway_metric', category: 'applications', unit: 'count', scope: 'published_gateway_measure', points: [{ window: '2026-Q1', period_start: '2026-01-01', period_end: '2026-03-31', value: 17, published_at: '2026-04-15T00:00:00Z', observed_at: '2026-04-16T00:00:00Z', source_url: 'https://example.test/published', record_id: 'record-1', observation_id: 'point-1', revision: 'r1' }] }], coverage: [{ source_id: 'bsa_gateway', kind: 'gateway_metric', category: 'applications', unit: 'count', windows: ['2026-Q1'], first_window: '2026-Q1', last_window: '2026-Q1', point_count: 1 }], suppressed_points: 1, suppressed: [{ source_id: 'bsa_gateway', kind: 'gateway_metric', category: 'applications', window: '2026-Q2', reason: 'missing_value', record_id: 'record-2' }], methodology: 'Missing windows remain missing.' })))
    window.history.replaceState({}, '', '/indices'); render(<App />)
    expect(await screen.findByText('2026-Q1', { selector: 'td' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Open published source' })).toHaveAttribute('href', 'https://example.test/published')
    expect(screen.getByText('17 count')).toBeVisible(); expect(screen.getByText('Missing windows remain missing.')).toBeVisible()
    expect(screen.getByText('1 suppressed point')).toBeVisible(); expect(screen.getByText('Missing value')).toBeVisible()
    expect(screen.getByRole('img', { name: 'Applications by reporting window' })).toHaveAccessibleDescription('2026-Q1: 17 count. Only supplied finite values are plotted; missing windows are not estimated.')
  })

  it('plots supplied zero values but omits null, absent and suppressed index values', async () => {
    const point = { period_start: '2026-01-01', period_end: '2026-03-31', record_id: 'record-1', observation_id: 'point-1' }
    server.use(http.get('/api/indices', () => HttpResponse.json({ series: [{ source_id: 'bsa_gateway', kind: 'gateway_metric', category: 'applications', unit: 'count', scope: 'published_gateway_measure', points: [{ ...point, window: '2026-Q1', value: 17 }, { ...point, window: '2026-Q2', value: null }, { ...point, window: '2026-Q3' }, { ...point, window: '2026-Q4', value: 0 }] }], coverage: [], suppressed_points: 1, suppressed: [{ source_id: 'bsa_gateway', kind: 'gateway_metric', category: 'applications', window: '2027-Q1', reason: 'missing_value', record_id: 'record-2' }] })))
    window.history.replaceState({}, '', '/indices'); render(<App />)
    const plot = await screen.findByRole('img', { name: 'Applications by reporting window' })
    expect(plot).toHaveAccessibleDescription('2026-Q1: 17 count. 2026-Q4: 0 count. Only supplied finite values are plotted; missing windows are not estimated.')
    expect(plot.querySelectorAll('rect')).toHaveLength(2)
    expect(within(plot).queryByText('2026-Q2')).not.toBeInTheDocument()
    expect(within(plot).queryByText('2026-Q3')).not.toBeInTheDocument()
    expect(within(plot).queryByText('2027-Q1')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Applications plot, scroll horizontally for all values' })).toHaveAttribute('tabindex', '0')
  })

  it('audits an entity correction and reloads the corrected identity', async () => {
    let saved: Record<string, unknown> | undefined
    server.use(http.get('/api/entities/entity-1', () => HttpResponse.json({ ...entity, name: saved ? 'Corrected synthetic entity' : entity.name })), http.post('/api/reviews', async ({ request }) => { saved = await request.json() as Record<string, unknown>; return HttpResponse.json({ id: 'review-1' }) }))
    window.history.replaceState({}, '', '/entities/entity-1'); const user = userEvent.setup(); render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Edit entity details' })); await user.clear(screen.getByLabelText('Entity name')); await user.type(screen.getByLabelText('Entity name'), 'Corrected synthetic entity')
    await user.click(screen.getByRole('button', { name: 'Save reviewed correction' })); expect(saved).toBeUndefined()
    await user.type(screen.getByLabelText('Review reason'), 'Corrected spelling against the registered identity'); await user.click(screen.getByRole('button', { name: 'Save reviewed correction' }))
    await waitFor(() => expect(saved).toMatchObject({ target_type: 'entity', target_id: entity.id, action: 'update', payload: { changes: { name: 'Corrected synthetic entity' } }, reason: 'Corrected spelling against the registered identity' }))
    expect(await screen.findByRole('heading', { name: 'Corrected synthetic entity' })).toBeVisible()
  })

  it('records practical completion with explicit precision and preserves server precision in the list', async () => {
    let saved: Record<string, unknown> | undefined
    server.use(http.get('/api/entities', () => HttpResponse.json(list([entity]))), http.get('/api/calendar', () => HttpResponse.json(list(saved ? [{ ...saved, id: 'date-1' }] : []))), http.post('/api/calendar', async ({ request }) => { saved = await request.json() as Record<string, unknown>; return HttpResponse.json({ id: 'date-1' }) }))
    window.history.replaceState({}, '', '/calendar'); const user = userEvent.setup(); render(<App />)
    await waitFor(() => expect(screen.getByLabelText('Entity')).toBeEnabled()); await user.selectOptions(screen.getByLabelText('Entity'), entity.id); await user.type(screen.getByLabelText('Title'), 'Approximate completion'); await user.type(screen.getByLabelText('Date (DD/MM/YYYY)'), '01/09/2026')
    await user.selectOptions(screen.getByLabelText('Date type'), 'practical_completion'); await user.selectOptions(screen.getByLabelText('Date precision'), 'approximate'); await user.selectOptions(screen.getByLabelText('Status'), 'uncertain'); await user.click(screen.getByRole('button', { name: 'Add calendar entry' }))
    await waitFor(() => expect(saved).toMatchObject({ kind: 'practical_completion', precision: 'approximate', status: 'uncertain', date: '2026-09-01' }))
    expect(await screen.findByText('Precision: Approximate')).toBeVisible()
  })
  it('keeps historical and unknown review states read-only and respects server allowed actions', async () => {
    server.use(http.get('/api/reviews', () => HttpResponse.json(list([
      { id: 'old', target_type: 'entity', target_id: entity.id, review_type: 'identity', state: 'merged', action: 'pending', headline: 'Historic identity', actor: 'operator', reason: 'Merged into canonical entity', allowed_actions: [] },
      { id: 'unknown', target_type: 'entity', target_id: entity.id, action: 'update', headline: 'Legacy audit row' },
      { id: 'pending', target_type: 'source_record', target_id: 'record-1', review_type: 'source_record', state: 'pending', headline: 'Source record review', allowed_actions: ['withdraw'] },
    ]))))
    window.history.replaceState({}, '', '/reviews'); render(<App />)
    expect(await screen.findByText('Merged')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Merge identity' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Accept entity' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Accept source_record' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Withdraw source record' })).toBeVisible()
    expect(screen.getAllByLabelText('Reason')).toHaveLength(1)
  })

  it('does not turn missing conversation rates into zero and rejects invalid metric date filters', async () => {
    let requests = 0
    server.use(http.get('/api/metrics', () => { requests += 1; return HttpResponse.json({ ...metricsFixture, denominators: { conversation_rate_reviewed: 0, conversation_rate_contacted: 0 }, counts: { reviewed_recommendations: 0, contacted_opportunities: 0, conversations: 0, instructions: 0 }, conversation_rate_reviewed: null, conversation_rate_contacted: null }) }))
    window.history.replaceState({}, '', '/pipeline'); const user = userEvent.setup(); render(<App />)
    expect(await screen.findAllByText('Not available')).toHaveLength(2)
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
    const before = requests
    await user.type(screen.getByLabelText('Reviewed from (DD/MM/YYYY)'), '31/02/2026'); await user.click(screen.getByRole('button', { name: 'Apply metric filters' }))
    expect(screen.getByText('Enter valid filter dates as DD/MM/YYYY.')).toBeVisible(); expect(requests).toBe(before)
  })

  it('preserves the identifier and reason when the server rejects a canonical identity change', async () => {
    let saved: Record<string, unknown> | undefined
    server.use(http.get('/api/entities/entity-1', () => HttpResponse.json(entity)), http.post('/api/reviews', async ({ request }) => { saved = await request.json() as Record<string, unknown>; return HttpResponse.json({ detail: 'Identifier does not match canonical entity key' }, { status: 400 }) }))
    window.history.replaceState({}, '', '/entities/entity-1'); const user = userEvent.setup(); render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Edit entity details' })); await user.clear(screen.getByLabelText('Identifier')); await user.type(screen.getByLabelText('Identifier'), '99999999'); await user.type(screen.getByLabelText('Review reason'), 'Check another registered company number'); await user.click(screen.getByRole('button', { name: 'Save reviewed correction' }))
    expect(await screen.findByText('Identifier does not match canonical entity key')).toBeVisible()
    expect(saved?.payload).toEqual({ changes: { identifier: '99999999' } })
    expect(screen.getByLabelText('Identifier')).toHaveValue('99999999'); expect(screen.getByLabelText('Review reason')).toHaveValue('Check another registered company number')
  })

})
