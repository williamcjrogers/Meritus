import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { server } from './server'
import { syntheticFixtures } from './fixtures'

const readiness = { can_run: false, reasons: ['Permission review required'], operations: { retrieve: false, import: false, analyse: false, export: false }, credentials: [], contact: { required: false, configured: false }, configuration_scope: 'api_process', checked_at: '2026-09-12T00:00:00Z' }

describe('source access configuration', () => {
  it('refreshes source readiness and terminal run history together before enabling another run', async () => {
    let sourceReads = 0
    let runReads = 0
    let completeRefresh: () => void = () => {}
    const refreshedRuns = new Promise<void>(resolve => { completeRefresh = resolve })
    const source = { ...syntheticFixtures.sources.items[0], id: 'find_case_law', name: 'Find Case Law', enabled: true, readiness: { ...readiness, can_run: true, reasons: [] } }
    server.use(
      http.get('/api/sources', () => { sourceReads += 1; return HttpResponse.json({ items: [source] }) }),
      http.get('/api/runs', async () => {
        runReads += 1
        if (runReads > 1) await refreshedRuns
        return HttpResponse.json({ items: [{ id: 'case-law-run', source_id: source.id, status: runReads > 1 ? 'partial' : 'running', fetched: runReads > 1 ? 20 : 0, inserted: runReads > 1 ? 20 : 0, rejected: 0 }] })
      }),
    )
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('link', { name: 'Sources' }))
    expect(await screen.findByText('Running')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Run Find Case Law' })).toBeDisabled()
    const refresh = screen.getByRole('button', { name: 'Refresh source readiness' })
    await waitFor(() => expect(refresh).toBeEnabled())
    await user.click(refresh)
    try {
      await waitFor(() => { expect(sourceReads).toBe(2); expect(runReads).toBe(2) })
      expect(refresh).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Run Find Case Law' })).toBeDisabled()
    } finally { completeRefresh() }
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run Find Case Law' })).toBeEnabled())
    expect(screen.getByText('20 fetched · 20 inserted · 0 rejected')).toBeVisible()
    expect(screen.queryByText('Running')).not.toBeInTheDocument()
    expect(screen.getAllByText('Partial')).toHaveLength(2)
    expect(refresh).toBeEnabled()
  })

  it('edits an incomplete existing grant and sends only expressly selected rights', async () => {
    let saved: Record<string, unknown> | undefined
    const source = { ...syntheticFixtures.sources.items[0], enabled: true, permissions: { reference: 'Existing reference' }, readiness }
    server.use(
      http.get('/api/sources', () => HttpResponse.json({ items: [source] })),
      http.patch('/api/sources/hmcts', async ({ request }) => { saved = await request.json() as Record<string, unknown>; return HttpResponse.json(source) }),
    )
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('link', { name: 'Sources' }))
    expect(await screen.findByRole('button', { name: 'Run HMCTS' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Edit permission for HMCTS' }))
    expect(screen.getByLabelText('Permission reference')).toHaveValue('Existing reference')
    expect(screen.getByLabelText('Reviewed at (ISO date and time with offset)')).toHaveValue('')
    for (const operation of ['Retrieve', 'Import', 'Analyse', 'Export']) expect(screen.getByRole('checkbox', { name: operation })).not.toBeChecked()
    fireEvent.change(screen.getByLabelText('Permission scope (text or JSON)'), { target: { value: 'Public court lists for claims research' } })
    fireEvent.change(screen.getByLabelText('Reviewed at (ISO date and time with offset)'), { target: { value: '2026-09-01T10:30:00+01:00' } })
    await user.click(screen.getByRole('checkbox', { name: 'Retrieve' }))
    await user.click(screen.getByRole('checkbox', { name: 'Analyse' }))
    await user.type(screen.getByLabelText('Retention days (optional)'), '30')
    await user.selectOptions(screen.getByLabelText('Retain full text'), 'false')
    await user.click(screen.getByRole('button', { name: 'Save permission' }))
    await waitFor(() => expect(saved).toMatchObject({ permissions: { reference: 'Existing reference', scope: 'Public court lists for claims research', reviewed_at: '2026-09-01T10:30:00+01:00', operations: ['retrieve', 'analyse'], retention_days: 30, retain_full_text: false } }))
    expect(saved).not.toHaveProperty('enabled')
  })

  it('enables and disables credential-only sources independently from run history', async () => {
    let enabled = false
    let saved: Record<string, unknown> | undefined
    const source = () => ({ ...syntheticFixtures.sources.items[0], id: 'companies_house', name: 'Companies House', requires_permission: false, status: 'needs_credentials', enabled, readiness: { ...readiness, can_run: enabled, reasons: enabled ? [] : ['Source disabled'], operations: { retrieve: true, import: true, analyse: true, export: true }, credentials: [{ name: 'MERITUS_COMPANIES_HOUSE_API_KEY', configured: true }] } })
    server.use(
      http.get('/api/sources', () => HttpResponse.json({ items: [source()] })),
      http.patch('/api/sources/companies_house', async ({ request }) => { saved = await request.json() as Record<string, unknown>; enabled = Boolean(saved.enabled); return HttpResponse.json(source()) }),
    )
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('link', { name: 'Sources' }))
    await user.click(await screen.findByRole('button', { name: 'Enable Companies House' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run Companies House' })).toBeEnabled())
    expect(saved).toEqual({ enabled: true })
    await user.click(screen.getByRole('button', { name: 'Disable Companies House' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run Companies House' })).toBeDisabled())
  })

  it('preserves structured grant scope and denied conditions while editing', async () => {
    const source = { ...syntheticFixtures.sources.items[0], permissions: { reference: 'LIC-8', scope: { sensitivity: ['PUBLIC'], retrieve: true, export: false }, reviewed_at: '2026-09-01T00:00:00Z', operations: ['retrieve'], denied: true }, readiness }
    server.use(http.get('/api/sources', () => HttpResponse.json({ items: [source] })))
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('link', { name: 'Sources' }))
    await user.click(await screen.findByRole('button', { name: 'Edit permission for HMCTS' }))
    expect(JSON.parse((screen.getByLabelText('Permission scope (text or JSON)') as HTMLTextAreaElement).value)).toEqual(source.permissions.scope)
    expect(screen.getByRole('checkbox', { name: 'Permission denied or withdrawn' })).toBeChecked()
  })
})

describe('relationship evidence dates', () => {
  it('requires real UK dates, submits explicit bounds and displays them in the register', async () => {
    let saved: Record<string, unknown> | undefined
    const entities = [{ id: 'first', name: 'First Ltd', kind: 'organisation' }, { id: 'second', name: 'Project Two', kind: 'project' }]
    server.use(
      http.get('/api/entities', () => HttpResponse.json({ items: entities })),
      http.get('/api/relationships', () => HttpResponse.json({ items: saved ? [{ id: 'relationship', ...saved }] : [] })),
      http.post('/api/relationships', async ({ request }) => { saved = await request.json() as Record<string, unknown>; return HttpResponse.json({ id: 'relationship', ...saved }) }),
    )
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('link', { name: 'Relationships' }))
    await user.selectOptions(await screen.findByLabelText('From entity'), 'first')
    await user.selectOptions(screen.getByLabelText('To entity'), 'second')
    await user.type(screen.getByLabelText('Relationship role'), 'Main contractor')
    await user.type(screen.getByLabelText('Evidence pointer'), 'Contract clause 4')
    await user.type(screen.getByLabelText('Source evidence record ID'), 'source-contract-1')
    await user.click(screen.getByRole('button', { name: 'Record relationship' }))
    expect(await screen.findByText('Enter a valid start date as DD/MM/YYYY.')).toBeVisible()
    expect(saved).toBeUndefined()
    const from = screen.getByLabelText('Valid from (DD/MM/YYYY)')
    fireEvent.change(from, { target: { value: '31/02/2026' } })
    await user.click(screen.getByRole('button', { name: 'Record relationship' }))
    expect(saved).toBeUndefined()
    fireEvent.change(from, { target: { value: '01/09/2026' } })
    fireEvent.change(screen.getByLabelText('Valid to (DD/MM/YYYY, optional)'), { target: { value: '31/08/2026' } })
    await user.click(screen.getByRole('button', { name: 'Record relationship' }))
    expect(await screen.findByText('The end date cannot precede the start date.')).toBeVisible()
    fireEvent.change(screen.getByLabelText('Valid to (DD/MM/YYYY, optional)'), { target: { value: '30/09/2026' } })
    await user.click(screen.getByRole('button', { name: 'Record relationship' }))
    expect(await screen.findByText('Explain the review that supports this relationship.')).toBeVisible()
    expect(screen.getByLabelText('Review reason')).toBeRequired()
    expect(saved).toBeUndefined()
    await user.type(screen.getByLabelText('Review reason'), 'Checked the signed contract and parties')
    await user.click(screen.getByRole('button', { name: 'Record relationship' }))
    await waitFor(() => expect(saved).toMatchObject({ source_record_id: 'source-contract-1', reason: 'Checked the signed contract and parties', valid_from: '2026-09-01T00:00:00Z', valid_to: '2026-09-30T00:00:00Z' }))
    const table = await screen.findByRole('table')
    expect(within(table).getByText('01 Sept 2026')).toBeVisible()
    expect(within(table).getByText('30 Sept 2026')).toBeVisible()
  })
})

it('requires retained evidence for a confirmed calendar date and submits its selected record', async () => {
  let saved: Record<string, unknown> | undefined
  server.use(
    http.get('/api/entities', () => HttpResponse.json({ items: [{ id: 'first', name: 'First Ltd', kind: 'organisation' }] })),
    http.get('/api/evidence', () => HttpResponse.json({ items: [{ id: 'observation-1', record_id: 'source-contract-1', title: 'Reviewed contract', source_id: 'find_tender', active: true }] })),
    http.post('/api/calendar', async ({ request }) => { saved = await request.json() as Record<string, unknown>; return HttpResponse.json({ id: 'calendar-1', ...saved }) }),
  )
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('link', { name: 'Calendar' }))
  await user.selectOptions(await screen.findByLabelText('Entity'), 'first')
  await user.type(screen.getByLabelText('Title'), 'Contract notice deadline')
  await user.type(screen.getByLabelText('Date (DD/MM/YYYY)'), '30/09/2026')
  await user.selectOptions(screen.getByLabelText('Status'), 'confirmed')
  await user.type(screen.getByLabelText('Basis'), 'Reviewed contract clause 4')
  await user.type(screen.getByLabelText('Evidence reference'), 'Clause 4.2')
  await user.click(screen.getByRole('button', { name: 'Add calendar entry' }))
  expect(await screen.findByText('Select or enter retained source evidence for a confirmed or sourced date.')).toBeVisible()
  expect(saved).toBeUndefined()
  await user.selectOptions(screen.getByLabelText('Source evidence (recent records)'), 'source-contract-1')
  await user.click(screen.getByRole('button', { name: 'Add calendar entry' }))
  await waitFor(() => expect(saved).toMatchObject({ source_record_id: 'source-contract-1', date: '2026-09-30', evidence: 'Clause 4.2', status: 'confirmed' }))
})

it('saves an explicitly entered Companies House watchlist without replacing other configuration', async () => {
  let saved: Record<string, unknown> | undefined
  const source = { ...syntheticFixtures.sources.items[0], id: 'companies_house', name: 'Companies House', requires_permission: false, config: { max_pages: 2, company_numbers: ['01234567'] }, readiness }
  server.use(
    http.get('/api/sources', () => HttpResponse.json({ items: [source] })),
    http.patch('/api/sources/companies_house', async ({ request }) => { saved = await request.json() as Record<string, unknown>; return HttpResponse.json(source) }),
  )
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('link', { name: 'Sources' }))
  const field = await screen.findByLabelText('Approved company numbers')
  expect(field).toHaveValue('01234567')
  fireEvent.change(field, { target: { value: '01234567\nSC123456' } })
  await user.click(screen.getByRole('button', { name: 'Save company watchlist' }))
  await waitFor(() => expect(saved).toEqual({ config: { company_numbers: ['01234567', 'SC123456'] } }))
})
