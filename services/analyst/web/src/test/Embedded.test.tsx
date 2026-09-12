import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, expect, it, vi } from 'vitest'
import App from '../App'
import { applicationPath } from '../runtime'
import { server } from './server'
import { syntheticFixtures } from './fixtures'
import { EvidencePair } from '../components/Ui'

const base = '/api/portal/intelligence/desk'
afterEach(() => vi.unstubAllEnvs())

function embedded(path = '/') {
  vi.stubEnv('BASE_URL', `${base}/`)
  vi.stubEnv('VITE_MERITUS_EMBEDDED', 'true')
  window.history.replaceState({}, '', `${base}${path}`)
}

it('keeps local API paths and rejects cross-origin application paths', () => {
  expect(applicationPath('/api/sources')).toBe('/api/sources')
  expect(() => applicationPath('//other.test')).toThrow()
  expect(() => applicationPath('https://other.test')).toThrow()
})

it('keeps evidence drill-downs inside the embedded desk while preserving publisher links', () => {
  embedded()
  render(<><EvidencePair source="Test" event="Test" title="Linked evidence" href="/entities/test-entity#evidence" /><EvidencePair source="Test" event="Test" title="Publisher" href="https://example.test/judgment" /></>)
  expect(screen.getByRole('link', { name: 'Linked evidence' })).toHaveAttribute('href', `${base}/entities/test-entity#evidence`)
  expect(screen.getByRole('link', { name: 'Publisher' })).toHaveAttribute('href', 'https://example.test/judgment')
})

it('opens under the workspace base with director auth and rebases navigation and exports', async () => {
  embedded()
  server.use(
    http.get(`${base}/api/auth/me`, () => HttpResponse.json({ username: 'director:user_test', csrf_token: '', auth_mode: 'director' })),
    http.get(`${base}/api/watchlist`, () => HttpResponse.json(syntheticFixtures.watchlist)),
    http.get(`${base}/api/alerts`, () => HttpResponse.json({ items: [], total: 0 })),
    http.get(`${base}/api/snapshots`, () => HttpResponse.json({ items: [{ id: 'snapshot-test', kind: 'weekly', as_of: '2026-09-12T08:00:00Z' }], total: 1 })),
  )
  const user = userEvent.setup()
  render(<App />)
  expect(await screen.findByRole('searchbox', { name: 'Search watchlist' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Sources' })).toHaveAttribute('href', `${base}/sources`)
  await user.click(screen.getByRole('link', { name: 'Reports' }))
  expect(await screen.findByRole('link', { name: 'Download CSV' })).toHaveAttribute('href', `${base}/api/exports/snapshot-test.csv`)
  expect(screen.getByRole('link', { name: 'Download HTML report' })).toHaveAttribute('href', `${base}/api/exports/snapshot-test.html`)
})

it('recovers a revoked director through workspace sign-in without showing local setup or password', async () => {
  embedded('/sources')
  server.use(http.get(`${base}/api/auth/me`, () => HttpResponse.json({ detail: 'Authentication required' }, { status: 401 })))
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Workspace sign-in required' })).toBeVisible()
  expect(screen.getByRole('link', { name: 'Sign in to the Directors Workspace' })).toHaveAttribute('target', '_top')
  expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
})
