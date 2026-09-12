import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { server } from './server'

const organisation = { id: 'one', key: 'SYNTHETIC:one', name: 'Synthetic One', kind: 'organisation', verified: true }
const other = { id: 'two', key: 'SYNTHETIC:two', name: 'Synthetic Two', kind: 'organisation', verified: true }
const list = (items: unknown[]) => ({ items, total: items.length, page: 1, page_size: 25 })
const emptyOpportunities = { project_exposures: [], introduction_routes: [], conflict_review_prompts: [], totals: { project_exposures: 0, introduction_routes: 0, conflict_review_prompts: 0 }, page: 1, page_size: 25, truncated: false, as_of: '2026-09-12T08:00:00Z', coverage: 'Only currently readable verified evidence is considered. These are review prompts.' }

describe('full-register and evidence-led workflows', () => {
  it('searches beyond the initial entity page and retains the labelled selection across another search and a failed exact ID', async () => {
    let saved: Record<string, unknown> | undefined; let searched = ''
    server.use(http.get('/api/entities', ({ request }) => { const params = new URL(request.url).searchParams; searched = params.toString(); return HttpResponse.json(list(params.get('q') === 'Distant' ? [other] : [organisation])) }), http.get('/api/entities/missing', () => HttpResponse.json({ detail: 'Unknown entity' }, { status: 404 })), http.post('/api/pipeline', async ({ request }) => { saved = await request.json() as Record<string, unknown>; return HttpResponse.json({ id: 'action' }) }))
    window.history.replaceState({}, '', '/pipeline'); const user = userEvent.setup(); render(<App />)
    await waitFor(() => expect(screen.getByLabelText('Search entity')).toBeEnabled()); await user.type(screen.getByLabelText('Search entity'), 'Distant')
    await screen.findByRole('option', { name: 'Synthetic Two (Organisation)' })
    expect(searched).toContain('q=Distant'); expect(searched).toContain('page_size=25')
    await user.selectOptions(screen.getByLabelText('Entity'), other.id)
    await user.click(screen.getByRole('button', { name: 'Clear search entity' })); expect(screen.getByLabelText('Search entity')).toHaveFocus(); expect(screen.getByLabelText('Entity')).toHaveValue(other.id); await user.type(screen.getByLabelText('Search entity'), 'Other search')
    await waitFor(() => expect(searched).toContain('q=Other+search'))
    expect(screen.getByLabelText('Entity')).toHaveValue(other.id)
    expect(screen.getByRole('option', { name: 'Synthetic Two (Organisation)' })).toBeInTheDocument()
    await user.click(screen.getByText('Use an exact entity ID')); await user.type(screen.getByLabelText('Exact entity ID'), 'missing'); await user.click(screen.getByRole('button', { name: 'Use entity ID' }))
    expect(await screen.findByText('Unknown entity')).toBeVisible(); expect(screen.getByLabelText('Entity')).toHaveValue(other.id)
    await user.type(screen.getByLabelText('Action note'), 'Reviewed selected remote result'); await user.click(screen.getByRole('button', { name: 'Record pipeline action' }))
    await waitFor(() => expect(saved?.entity_id).toBe(other.id))
  })

  it('requires matter-specific professional evidence and submits the matter attributes', async () => {
    let saved: Record<string, unknown> | undefined
    server.use(http.get('/api/entities', () => HttpResponse.json(list([organisation, other]))), http.post('/api/relationships', async ({ request }) => { saved = await request.json() as Record<string, unknown>; return HttpResponse.json({ id: 'relationship', ...saved }) }))
    window.history.replaceState({}, '', '/relationships'); const user = userEvent.setup(); render(<App />)
    await waitFor(() => expect(screen.getByLabelText('From entity')).toBeEnabled())
    await user.selectOptions(screen.getByLabelText('From entity'), organisation.id); await user.selectOptions(screen.getByLabelText('To entity'), other.id)
    await user.type(screen.getByLabelText('Relationship role'), 'adviser'); await user.type(screen.getByLabelText('Evidence pointer'), 'Judgment paragraph 4'); await user.type(screen.getByLabelText('Source evidence record ID'), 'retained-record'); await user.type(screen.getByLabelText('Review reason'), 'Checked named matter role'); await user.type(screen.getByLabelText('Valid from (DD/MM/YYYY)'), '01/09/2026')
    await user.click(screen.getByRole('button', { name: 'Record relationship' })); expect(await screen.findByText('Identify the specific matter for this professional role.')).toBeVisible(); expect(saved).toBeUndefined()
    await user.type(screen.getByLabelText('Matter reference'), 'SYNTHETIC TCC 2026 4'); await user.selectOptions(screen.getByLabelText('Matter entity'), other.id); await user.click(screen.getByRole('button', { name: 'Record relationship' }))
    await waitFor(() => expect(saved).toMatchObject({ role: 'adviser', attributes: { matter_reference: 'SYNTHETIC TCC 2026 4', matter_entity_id: other.id } }))
    expect(saved).not.toHaveProperty('matter_reference')
  })

  it('renders actual opportunity evidence and pages each category using the largest total', async () => {
    let page = '1'
    server.use(http.get('/api/opportunities', ({ request }) => { page = new URL(request.url).searchParams.get('page') ?? '1'; return HttpResponse.json({ ...emptyOpportunities, page: Number(page), page_size: 1, totals: { ...emptyOpportunities.totals, introduction_routes: 2 }, introduction_routes: [{ relationship_id: `role-${page}`, professional: organisation, party: other, professional_role: 'adviser', matter: { reference: `SYNTHETIC matter ${page}` }, status: 'review_required', reason: 'Availability and willingness require human review.', lineage: { relationship_id: `role-${page}`, record_id: 'record-1', source_id: 'find_tender', source_url: 'https://example.test/source' } }] }) }))
    window.history.replaceState({}, '', '/relationships'); const user = userEvent.setup(); render(<App />)
    expect(await screen.findByText('SYNTHETIC matter 1')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Open source evidence' })).toHaveAttribute('href', 'https://example.test/source')
    expect(screen.getByText('Availability and willingness require human review.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Next' })); expect(await screen.findByText('SYNTHETIC matter 2')).toBeVisible(); expect(page).toBe('2')
  })

  it('keeps illustrative timing unpersisted until the user explicitly saves the provisional form', async () => {
    let timing: Record<string, unknown> | undefined; let saved: Record<string, unknown> | undefined
    server.use(http.get('/api/entities', () => HttpResponse.json(list([organisation]))), http.post('/api/calendar/timing', async ({ request }) => { timing = await request.json() as Record<string, unknown>; return HttpResponse.json({ preview: { entity_id: organisation.id, title: 'Illustrative accrual-plus-period review date', date: '2032-09-01', kind: 'legal_review', status: 'provisional', precision: 'day', basis: timing.input_basis, calculation: { accrual_date: timing.accrual_date, selected_period_years: timing.period_years, result_type: 'illustrative_review_date' }, legal_conclusion: false, review_required: true }, persisted: false, actionable: false }) }), http.post('/api/calendar', async ({ request }) => { saved = await request.json() as Record<string, unknown>; return HttpResponse.json({ id: 'calendar', ...saved }) }))
    window.history.replaceState({}, '', '/calendar'); const user = userEvent.setup(); render(<App />)
    await waitFor(() => expect(screen.getByLabelText('Timing entity')).toBeEnabled()); await user.selectOptions(screen.getByLabelText('Timing entity'), organisation.id); await user.type(screen.getByLabelText('Accrual date (DD/MM/YYYY)'), '01/09/2026'); await user.type(screen.getByLabelText('Selected period (years)'), '6'); await user.type(screen.getByLabelText('Timing input basis'), 'Entered accrual assumption for review only'); await user.click(screen.getByRole('button', { name: 'Preview illustrative timing' }))
    expect(await screen.findByText('Not saved. Not actionable. Human review is required.')).toBeVisible(); expect(saved).toBeUndefined()
    expect(timing).toMatchObject({ accrual_date: '2026-09-01', period_years: 6 })
    await user.click(screen.getByRole('button', { name: 'Use in provisional form' })); expect(saved).toBeUndefined(); expect(screen.getByLabelText('Status')).toHaveValue('provisional')
    await user.click(screen.getByRole('button', { name: 'Add calendar entry' }))
    await waitFor(() => expect(saved).toMatchObject({ date: '2032-09-01', status: 'provisional', kind: 'legal_review', evidence: '' }))
    expect(String(saved?.basis)).toContain('Entered accrual assumption for review only'); expect(String(saved?.basis)).toContain('01/09/2026 plus 6 years')
  })

  it('shows confirmed actionable dates and the server-derived post-completion window', async () => {
    server.use(http.get('/api/calendar/actionable', () => HttpResponse.json(list([{ id: 'pc', entity_id: 'one', title: 'Confirmed practical completion', kind: 'practical_completion', status: 'confirmed', date: '2026-09-01', precision: 'day', basis: 'Certificate' }]))), http.get('/api/calendar/pc/post-completion-window', () => HttpResponse.json({ basis_date: '2026-09-01', window_start: '2027-09-01', window_end: '2028-09-01', status: 'derived_from_confirmed_practical_completion' })))
    window.history.replaceState({}, '', '/calendar'); const user = userEvent.setup(); render(<App />)
    await user.selectOptions(await screen.findByLabelText('Calendar view'), 'confirmed'); await user.click(await screen.findByRole('button', { name: 'Show post-completion window' }))
    expect(await screen.findByText('12 to 24 months after confirmed practical completion: 01/09/2027 to 01/09/2028. Basis date: 01/09/2026.')).toBeVisible()
  })

  it('offers supported import kinds and renders server row errors without crashing', async () => {
    let preview: Record<string, unknown> | undefined
    server.use(http.post('/api/imports/preview', async ({ request }) => { preview = await request.json() as Record<string, unknown>; return HttpResponse.json({ valid: false, errors: [{ row: 1, message: 'name is required' }], preview: [], token: null }) }))
    window.history.replaceState({}, '', '/imports'); const user = userEvent.setup(); render(<App />)
    const kind = await screen.findByLabelText('Import kind')
    expect(within(kind).getAllByRole('option').map(item => (item as HTMLOptionElement).value)).toEqual(['organisations', 'projects', 'relationships', 'calendar', 'metrics', 'documents'])
    fireEvent.change(screen.getByLabelText('CSV or JSON rows'), { target: { value: '[{}]' } }); await user.click(screen.getByRole('button', { name: 'Preview import' }))
    expect(await screen.findByText('Row 1: name is required')).toBeVisible(); expect(preview?.kind).toBe('organisations'); expect(screen.getByRole('button', { name: 'Commit reviewed import' })).toBeDisabled()
  })
})
