import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse, delay } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { Status } from '../components/Ui'
import { server } from './server'
import { syntheticFixtures } from './fixtures'

describe('analyst desk interactions', () => {
  it('supports initial setup and an accessible password reveal', async () => {
    server.use(
      http.get('/api/auth/setup-status', () => HttpResponse.json({ needs_setup: true })),
      http.get('/api/auth/me', () => HttpResponse.json({ detail: 'Unauthenticated' }, { status: 401 })),
      http.post('/api/auth/setup', async ({ request }) => HttpResponse.json({ username: String((await request.json() as Record<string, unknown>).username), csrf_token: 'new-csrf' })),
    )
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Set up Meritus' })).toBeVisible()
    const password = screen.getByLabelText('Password')
    expect(password).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password).toHaveAttribute('type', 'text')
  })

  it('clears search, persists filters and ignores a stale response', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    server.use(http.get('/api/watchlist', async ({ request }) => {
      const q = new URL(request.url).searchParams.get('q')
      if (q === 'slow') { await delay(600); return HttpResponse.json({ ...syntheticFixtures.emptyWatchlist, marker: 'slow' }) }
      if (q === 'fast') return HttpResponse.json(syntheticFixtures.watchlist)
      return HttpResponse.json(syntheticFixtures.emptyWatchlist)
    }))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)
    const search = await screen.findByRole('searchbox', { name: 'Search watchlist' })
    await user.type(search, 'slow')
    await act(() => vi.advanceTimersByTimeAsync(310))
    await user.clear(search)
    await user.type(search, 'fast{Enter}')
    expect(await screen.findByRole('link', { name: 'Synthetic Civils Ltd' })).toBeVisible()
    await act(() => vi.advanceTimersByTimeAsync(700))
    expect(screen.getByRole('link', { name: 'Synthetic Civils Ltd' })).toBeVisible()
    await user.selectOptions(screen.getByLabelText('Entity kind'), 'organisation')
    expect(window.location.search).toContain('kind=organisation')
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(search).toHaveValue('')
    vi.useRealTimers()
  })

  it('keeps failed review input available for correction', async () => {
    server.use(http.post('/api/reviews', () => HttpResponse.json({ detail: 'Reason required' }, { status: 400 })))
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('link', { name: 'Review queue' }))
    const reason = await screen.findByLabelText('Reason')
    await user.type(reason, 'Needs source confirmation')
    await user.click(screen.getByRole('button', { name: 'Accept observation' }))
    expect(await screen.findByText('Reason required')).toBeVisible()
    expect(reason).toHaveValue('Needs source confirmation')
  })

  it('keeps an ambiguous identity pending until a confirmed merge target is selected', async () => {
    let saved: Record<string, unknown> | undefined
    server.use(
      http.get('/api/reviews', () => HttpResponse.json({ items: [syntheticFixtures.ambiguousReview, syntheticFixtures.reviewedItem], total: 2, page: 1, page_size: 25 })),
      http.get('/api/entities', ({ request }) => new URL(request.url).searchParams.get('q') === 'Synth' ? HttpResponse.json({ items: [{ id: 'confirmed-entity-1', key: 'GB-COH:01234567', identifier: '01234567', name: 'Synthetic Build Ltd', kind: 'organisation', verified: true }], total: 1, page: 1, page_size: 25 }) : HttpResponse.json({ items: [], total: 0, page: 1, page_size: 25 })),
      http.post('/api/reviews', async ({ request }) => { saved = await request.json() as Record<string, unknown>; return HttpResponse.json({ id: 'saved-review' }) }),
    )
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('link', { name: 'Review queue' }))
    expect(await screen.findByRole('button', { name: 'Merge identity' })).toBeVisible()
    expect(screen.getByText('synthetic.reviewer')).toBeVisible()
    expect(screen.getByText('Source and identity checked')).toBeVisible()
    await user.type(screen.getByLabelText('Find a confirmed entity'), 'Unknown')
    expect(await screen.findByText('No confirmed matches. Leave this identity pending or reject it with a reason.')).toBeVisible()
    await user.clear(screen.getByLabelText('Find a confirmed entity'))
    await user.type(screen.getByLabelText('Find a confirmed entity'), 'Synth')
    const candidate = await screen.findByRole('radio', { name: 'Synthetic Build Ltd · Organisation · 01234567 · ID confirmed-entity-1' })
    await user.click(candidate)
    await user.type(screen.getByLabelText('Reason'), 'Confirmed company number and source trail')
    await user.click(screen.getByRole('button', { name: 'Merge identity' }))
    await waitFor(() => expect(saved).toMatchObject({ action: 'merge', payload: { into_entity_id: 'confirmed-entity-1' } }))
  })

  it('sends the dedicated independence confirmation action', async () => {
    let saved: Record<string, unknown> | undefined
    let csrf = ''
    server.use(
      http.get('/api/reviews', () => HttpResponse.json({ items: [{ id: 'independence-1', target_type: 'observation', target_id: 'observation-2', review_type: 'independence', headline: 'Possible duplicate event', state: 'pending' }], total: 1, page: 1, page_size: 25 })),
      http.post('/api/reviews', async ({ request }) => { csrf = request.headers.get('X-CSRF-Token') ?? ''; saved = await request.json() as Record<string, unknown>; return HttpResponse.json({ id: 'saved-review' }) }),
    )
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('link', { name: 'Review queue' }))
    await user.type(await screen.findByLabelText('Reason'), 'Separate source and legal event')
    await user.click(screen.getByRole('button', { name: 'Confirm independence' }))
    await waitFor(() => expect(saved).toMatchObject({ target_type: 'observation', target_id: 'observation-2', action: 'confirm_independence', reason: 'Separate source and legal event', payload: {} }))
    expect(saved?.payload).toEqual({})
    expect(csrf).toBe('synthetic-csrf')
  })

  it('requires a basis for a confirmed legal date and focuses the field', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('link', { name: 'Calendar' }))
    await user.type(await screen.findByLabelText('Title'), 'Synthetic hearing')
    await user.type(screen.getByLabelText('Date (DD/MM/YYYY)'), '30/09/2026')
    await user.selectOptions(screen.getByLabelText('Status'), 'confirmed')
    await user.click(screen.getByRole('button', { name: 'Add calendar entry' }))
    expect(await screen.findByText('Give the legal or evidential basis for a confirmed date.')).toBeVisible()
    expect(screen.getByLabelText('Basis')).toHaveFocus()
  })

  it('shows blocked source status and cancels permission editing without activation', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('link', { name: 'Sources' }))
    expect(await screen.findByText('Permission required')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Edit permission for HMCTS' }))
    await user.type(screen.getByLabelText('Permission reference'), 'Synthetic approval 42')
    await user.click(screen.getByRole('button', { name: 'Cancel editing' }))
    expect(screen.queryByLabelText('Permission reference')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enable HMCTS' })).toBeVisible()
  })

  it('recovers from auth expiry and returns to the intended route', async () => {
    let expired = true
    server.use(
      http.get('/api/auth/me', () => expired ? HttpResponse.json({ detail: 'Session expired' }, { status: 401 }) : HttpResponse.json(syntheticFixtures.session)),
      http.post('/api/auth/login', () => { expired = false; return HttpResponse.json(syntheticFixtures.session) }),
    )
    window.history.replaceState({}, '', '/reports')
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByText('Your session expired. Sign in to continue.')).toBeVisible()
    await user.type(screen.getByLabelText('Username'), 'synthetic.analyst')
    await user.type(screen.getByLabelText('Password'), 'synthetic-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { name: 'Reports' })).toBeVisible()
  })

  it('creates a report snapshot and exposes real export links', async () => {
    server.use(http.post('/api/snapshots', () => HttpResponse.json({ id: 'snapshot-1', kind: 'weekly', as_of: '2026-09-12T08:00:00Z', rule_version: 'v1' })))
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('link', { name: 'Reports' }))
    await user.click(await screen.findByRole('button', { name: 'Create weekly snapshot' }))
    expect(await screen.findByRole('link', { name: 'Download CSV' })).toHaveAttribute('href', '/api/exports/snapshot-1.csv')
    expect(screen.getByRole('link', { name: 'Download HTML report' })).toHaveAttribute('href', '/api/exports/snapshot-1.html')
  })

  it('uses the server page without slicing it a second time', async () => {
    const base = syntheticFixtures.watchlist.items[0]
    server.use(http.get('/api/watchlist', ({ request }) => {
      const page = Number(new URL(request.url).searchParams.get('page') ?? 1)
      return HttpResponse.json({ ...syntheticFixtures.watchlist, items: [{ ...base, entity_id: `page-${page}`, name: `Server page ${page}` }], total: 26, page, page_size: 25 })
    }))
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByRole('link', { name: 'Server page 1' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByRole('link', { name: 'Server page 2' })).toBeVisible()
    expect(window.location.search).toContain('page=2')
  })

  it('shows every linked entity register and source evidence link', async () => {
    server.use(http.get('/api/entities/synthetic-entity-1', () => HttpResponse.json({
      id: 'synthetic-entity-1', key: 'GB-COH:01234567', name: 'Synthetic Civils Ltd', kind: 'organisation', verified: true,
      score: { score: 68, gaps: ['score_below_recommendation_threshold'], contributions: [{ observation_id: 'observation-1', event_key: 'event-1', family: 'insolvency', kind: 'petition', age_days: 2, points: 40, evidence_url: 'https://example.test/contribution' }] },
      observations: [{ id: 'observation-1', source_id: 'gazette', kind: 'petition', headline: 'Petition observed', source_url: 'https://example.test/observation', observed_at: '2026-09-10T10:00:00Z', state: 'verified' }],
      records: [{ id: 'record-1', source_id: 'companies_house', kind: 'filing', title: 'Accounts filing', source_url: 'https://example.test/record', observed_at: '2026-09-09T10:00:00Z', state: 'verified', active: false, withdrawn: true }],
      relationships: [{ id: 'relationship-1', from_entity_id: 'synthetic-entity-1', from_name: 'Synthetic Civils Ltd', to_entity_id: 'project-1', to_name: 'Synthetic Project', role: 'Main contractor', evidence_pointer: 'Award notice', source_url: 'https://example.test/relationship', state: 'verified' }],
      calendar: [{ id: 'calendar-1', entity_id: 'synthetic-entity-1', kind: 'hearing', title: 'Petition hearing', date: '2026-10-01', status: 'confirmed', basis: 'Court list', source_url: 'https://example.test/calendar' }],
      pipeline: [{ id: 'pipeline-1', entity_id: 'synthetic-entity-1', stage: 'qualified', note: 'Analyst reviewed', actor: 'synthetic.analyst', occurred_at: '2026-09-11T10:00:00Z' }],
    })))
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('link', { name: 'Synthetic Civils Ltd' }))
    expect(await screen.findByRole('heading', { name: 'Score contributions' })).toBeVisible()
    expect(screen.getByText('Score below recommendation threshold')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Open source evidence' })).toHaveAttribute('href', 'https://example.test/contribution')
    expect(screen.getByRole('link', { name: 'Petition observed' })).toHaveAttribute('href', 'https://example.test/observation')
    expect(screen.getByRole('link', { name: 'Accounts filing' })).toHaveAttribute('href', 'https://example.test/record')
    const records = screen.getByRole('heading', { name: 'Source records' }).closest('section')
    expect(records).not.toBeNull()
    expect(within(records as HTMLElement).getByText('Withdrawn')).toHaveClass('status-error')
    expect(screen.getByText('Main contractor')).toBeVisible()
    expect(screen.getByText('Petition hearing')).toBeVisible()
    expect(screen.getByText('Analyst reviewed')).toBeVisible()
  })

  it('keeps boot errors visible and retries the session check', async () => {
    let failing = true
    server.use(
      http.get('/api/auth/setup-status', () => HttpResponse.json({ needs_setup: false })),
      http.get('/api/auth/me', () => failing ? HttpResponse.json({ detail: 'Session store unavailable' }, { status: 503 }) : HttpResponse.json(syntheticFixtures.session)),
    )
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByText('Session store unavailable')).toBeVisible()
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument()
    failing = false
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('heading', { name: 'Watchlist' })).toBeVisible()
  })

  it('reports failed dependent lists and disables affected writes', async () => {
    server.use(http.get('/api/entities', () => HttpResponse.json({ detail: 'Entity index unavailable' }, { status: 503 })))
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('link', { name: 'Calendar' }))
    expect(await screen.findByText(/entity register could not be loaded: Entity index unavailable/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Add calendar entry' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible()
  })

  it.each([
    ['Relationships', 'Record relationship'],
    ['Pipeline', 'Record pipeline action'],
  ])('disables the %s write when the entity register is unavailable', async (route, action) => {
    server.use(http.get('/api/entities', () => HttpResponse.json({ detail: 'Entity index unavailable' }, { status: 503 })))
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('link', { name: route }))
    expect(await screen.findByText(/entity register could not be loaded: Entity index unavailable/)).toBeVisible()
    expect(screen.getByRole('button', { name: action })).toBeDisabled()
  })

  it('shows ingestion run dependency failures instead of claiming no run', async () => {
    server.use(http.get('/api/runs', () => HttpResponse.json({ detail: 'Run store unavailable' }, { status: 503 })))
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('link', { name: 'Sources' }))
    expect(await screen.findByText(/ingestion run history could not be loaded: Run store unavailable/)).toBeVisible()
    expect(screen.getByText('Run status unavailable')).toBeVisible()
    const coverage = screen.getByText('Coverage').closest('div')
    expect(coverage).not.toBeNull()
    expect(within(coverage as HTMLElement).getByText('Unavailable')).toBeVisible()
    expect(screen.queryByText('No ingestion run recorded')).not.toBeInTheDocument()
  })

  it('parses quoted CSV records and invalidates preview after provenance changes', async () => {
    let rows: unknown
    server.use(http.post('/api/imports/preview', async ({ request }) => { rows = (await request.json() as { rows: unknown }).rows; return HttpResponse.json({ valid: true, errors: [], preview: rows, token: 'preview-token' }) }))
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('link', { name: 'Imports' }))
    fireEvent.change(await screen.findByLabelText('CSV or JSON rows'), { target: { value: 'name,detail\n"Alpha, Ltd","Line one\nLine two"' } })
    await user.click(screen.getByRole('button', { name: 'Preview import' }))
    await waitFor(() => expect(rows).toEqual([{ name: 'Alpha, Ltd', detail: 'Line one\nLine two' }]))
    expect(await screen.findByRole('button', { name: 'Commit reviewed import' })).toBeVisible()
    await user.type(screen.getByLabelText('Source URL'), 'https://example.test/source')
    expect(screen.queryByRole('button', { name: 'Commit reviewed import' })).not.toBeInTheDocument()
  })

  it('ignores an in-flight preview after its provenance changes', async () => {
    let release!: () => void
    let markStarted!: () => void
    const pending = new Promise<void>(resolve => { release = resolve })
    const started = new Promise<void>(resolve => { markStarted = resolve })
    server.use(http.post('/api/imports/preview', async () => { markStarted(); await pending; return HttpResponse.json({ valid: true, errors: [], preview: [{ name: 'Obsolete row' }], token: 'obsolete-token' }) }))
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('link', { name: 'Imports' }))
    fireEvent.change(await screen.findByLabelText('CSV or JSON rows'), { target: { value: 'name,detail\nOriginal row,Original detail' } })
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }))
    await started
    fireEvent.change(screen.getByLabelText('Permission reference'), { target: { value: 'Revised permission' } })
    await act(async () => { release(); await Promise.resolve() })
    await waitFor(() => expect(screen.getByText('No preview yet')).toBeVisible())
    expect(screen.queryByText('Obsolete row')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Commit reviewed import' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preview import' })).not.toBeDisabled()
  })

  it('persists the demo banner when metrics mark a response synthetic', async () => {
    window.history.replaceState({}, '', '/pipeline')
    render(<App />)
    expect(await screen.findByText('This session includes an explicitly marked synthetic response.')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Pipeline' })).toBeVisible()
  })

  it('maps status values by exact semantic state', () => {
    render(<><Status value="active" /><Status value="inactive" /><Status value="incomplete" /><Status value="unconfirmed" /></>)
    expect(screen.getByText('Active')).toHaveClass('status-success')
    expect(screen.getByText('Inactive')).toHaveClass('status-info')
    expect(screen.getByText('Incomplete')).toHaveClass('status-warning')
    expect(screen.getByText('Unconfirmed')).toHaveClass('status-warning')
  })

  it('focuses only the first invalid calendar field', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('link', { name: 'Calendar' }))
    await user.selectOptions(await screen.findByLabelText('Status'), 'confirmed')
    const submit = screen.getByRole('button', { name: 'Add calendar entry' })
    await waitFor(() => expect(submit).toBeEnabled())
    await user.click(submit)
    expect(screen.getByLabelText('Title')).toHaveFocus()
  })

  it('preserves navigation and actions at a narrow viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 })
    window.dispatchEvent(new Event('resize'))
    render(<App />)
    expect(await screen.findByRole('navigation', { name: 'Analyst desk' })).toBeVisible()
    expect(await screen.findByRole('link', { name: 'Synthetic Civils Ltd' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Open evidence' })).toBeVisible()
  })
})

it('keeps the newest source run when older successful runs are also returned', async () => {
  server.use(http.get('/api/runs', () => HttpResponse.json({ items: [
    { id: 'new', source_id: 'hmcts', status: 'failed', started_at: '2026-09-12T08:00:00Z', fetched: 0, inserted: 0, rejected: 0 },
    { id: 'old', source_id: 'hmcts', status: 'success', started_at: '2026-09-11T08:00:00Z', fetched: 1, inserted: 1, rejected: 0 },
  ], total: 2, page: 1, page_size: 25 })))
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('link', { name: 'Sources' }))
  const coverage = (await screen.findByText('Coverage')).closest('div') as HTMLElement
  expect(within(coverage).getByText('Run Failed')).toBeVisible()
  expect(screen.queryByText('Current run boundary')).not.toBeInTheDocument()
})
