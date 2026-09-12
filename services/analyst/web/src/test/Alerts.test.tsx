import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { expect, it } from 'vitest'
import App from '../App'
import { server } from './server'

const alert = { id: 'alert-1', entity_id: 'entity-1', category: 'material_change', title: 'Synthetic evidence changed', body: 'Check the newly retained evidence before action.', created_at: '2026-09-12T08:00:00Z', read_at: null }
it('preserves a failed unread alert, prevents duplicate requests and shows the server-confirmed read state after retry', async () => {
  let attempts = 0; let readAt: string | null = null
  server.use(http.get('/api/alerts', () => HttpResponse.json({ items: [{ ...alert, read_at: readAt }], total: 1, page: 1, page_size: 25 })), http.post('/api/alerts/alert-1/read', async () => { attempts += 1; await delay(60); if (attempts === 1) return HttpResponse.json({ detail: 'Read state could not be saved' }, { status: 503 }); readAt = '2026-09-12T09:00:00Z'; return HttpResponse.json({ ok: true }) }))
  const user = userEvent.setup(); render(<App />)
  await user.click(await screen.findByRole('link', { name: 'Alerts' }))
  const card = (await screen.findByRole('heading', { name: alert.title })).closest('article') as HTMLElement
  expect(within(card).getByText('Unread')).toBeVisible(); expect(within(card).getByText('Material change')).toBeVisible()
  expect(within(card).getByRole('link', { name: 'Open entity' })).toHaveAttribute('href', '/entities/entity-1')
  const button = within(card).getByRole('button', { name: 'Mark as read' }); await user.click(button); expect(button).toBeDisabled()
  expect(await within(card).findByText('Read state could not be saved')).toBeVisible(); expect(within(card).getByText(alert.body)).toBeVisible(); expect(within(card).getByText('Unread')).toBeVisible()
  await user.click(button); expect(await within(card).findByText('Read')).toBeVisible()
  await waitFor(() => expect(within(card).queryByRole('button', { name: 'Mark as read' })).not.toBeInTheDocument())
  expect(attempts).toBe(2)
})

it('uses server alert pagination, keeps page in the URL and renders a real empty response', async () => {
  server.use(http.get('/api/alerts', ({ request }) => { const page = Number(new URL(request.url).searchParams.get('page') ?? 1); return HttpResponse.json({ items: page === 1 ? [alert] : [], total: 26, page, page_size: 25 }) }))
  window.history.replaceState({}, '', '/alerts'); const user = userEvent.setup(); render(<App />)
  await screen.findByRole('heading', { name: alert.title }); await user.click(screen.getByRole('button', { name: 'Next' }))
  expect(await screen.findByRole('heading', { name: 'No alerts on this page' })).toBeVisible(); expect(window.location.search).toContain('page=2')
  await user.click(screen.getByRole('button', { name: 'Previous' })); expect(await screen.findByRole('heading', { name: alert.title })).toBeVisible()
})
