import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { server } from './server'
import { syntheticFixtures } from './fixtures'

const attribution = 'Crown copyright material reproduced by permission of The National Archives. The contents of the judgment can be used under the Open Justice – Licence.'
const coverage = 'Find Case Law material only partially represents the activities of the courts and tribunals.'
const permissions = { attribution, distribution_conditions: [coverage, 'Internal platform use only.'], private_reference: 'DO NOT DISPLAY RAW PERMISSION FIELDS' }
const record = { id: 'fcl-record', source_id: 'find_case_law', source_name: 'Find Case Law', source_permissions: permissions, title: 'Synthetic judgment', source_url: 'https://caselaw.nationalarchives.gov.uk/ewhc/tcc/2026/1', active: true }

describe('licence notices beside evidence', () => {
  it('shows the exact stored acknowledgement and conditions for a disabled source', async () => {
    server.use(http.get('/api/sources', () => HttpResponse.json({ items: [{ ...syntheticFixtures.sources.items[0], id: 'find_case_law', name: 'Find Case Law', enabled: false, permissions }] })))
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('link', { name: 'Sources' }))
    const notice = await screen.findByRole('note', { name: 'Find Case Law licence conditions' })
    expect(within(notice).getByText(attribution, { exact: true })).toBeVisible()
    expect(within(notice).getByText(coverage, { exact: true })).toBeVisible()
    expect(within(notice).getByText('Internal platform use only.')).toBeVisible()
    expect(screen.queryByText(permissions.private_reference)).not.toBeInTheDocument()
  })

  it('shows one notice above the evidence table for repeated records from a source', async () => {
    server.use(http.get('/api/evidence', () => HttpResponse.json({ items: [record, { ...record, id: 'second-record' }] })))
    window.history.replaceState({}, '', '/evidence')
    render(<App />)
    const notice = await screen.findByRole('note', { name: 'Find Case Law licence conditions' })
    expect(screen.getAllByText(attribution, { exact: true })).toHaveLength(1)
    expect(within(notice).getByText(coverage, { exact: true })).toBeVisible()
    expect(notice.closest('table')).toBeNull()
    expect(notice.compareDocumentPosition(screen.getByRole('table')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps notices alongside the entity observations and source records', async () => {
    server.use(http.get('/api/entities/synthetic-entity-1', () => HttpResponse.json({
      id: 'synthetic-entity-1', key: 'GB-COH:01234567', name: 'Synthetic Civils Ltd', kind: 'organisation', verified: true,
      observations: [{ ...record, id: 'fcl-observation' }], records: [record],
    })))
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('link', { name: 'Synthetic Civils Ltd' }))
    await screen.findByRole('heading', { name: 'Observations' })
    for (const title of ['Observations', 'Source records']) {
      const section = screen.getByRole('heading', { name: title }).closest('section') as HTMLElement
      expect(within(section).getByText(attribution, { exact: true })).toBeVisible()
      expect(within(section).getByText(coverage, { exact: true })).toBeVisible()
    }
    expect(screen.queryByText(permissions.private_reference)).not.toBeInTheDocument()
  })

  it('renders only explicitly supplied text conditions and escapes markup', async () => {
    const generic = { ...record, source_id: 'licensed_feed', source_name: 'Licensed feed', source_permissions: { attribution: '<script>unsafe()</script>', distribution_conditions: ['Reviewed terms', { secret: 'RAW OBJECT' }, 'Reviewed terms'], redistribution_conditions: 'Do not republish.' } }
    server.use(http.get('/api/evidence', () => HttpResponse.json({ items: [generic] })))
    window.history.replaceState({}, '', '/evidence')
    render(<App />)
    const notice = await screen.findByRole('note', { name: 'Licensed feed licence conditions' })
    expect(within(notice).getByText('<script>unsafe()</script>')).toBeVisible()
    expect(notice.querySelector('script')).toBeNull()
    expect(within(notice).getAllByText('Reviewed terms')).toHaveLength(1)
    expect(within(notice).getByText('Do not republish.')).toBeVisible()
    expect(screen.queryByText('RAW OBJECT')).not.toBeInTheDocument()
  })
})
