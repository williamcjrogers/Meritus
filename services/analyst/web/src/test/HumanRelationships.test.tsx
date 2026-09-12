import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { expect, it } from 'vitest'
import App from '../App'
import { server } from './server'

it('records an explicitly reviewed human interview without invented source lineage', async () => {
  let saved: Record<string, unknown> | undefined
  server.use(
    http.get('/api/entities', () => HttpResponse.json({ items: [{ id: 'one', name: 'One Ltd', kind: 'organisation' }, { id: 'two', name: 'Two Ltd', kind: 'organisation' }] })),
    http.post('/api/relationships', async ({ request }) => { saved = await request.json() as Record<string, unknown>; return HttpResponse.json({ id: 'human-relationship', ...saved }) }),
  )
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('link', { name: 'Relationships' }))
  await user.selectOptions(await screen.findByLabelText('From entity'), 'one')
  await user.selectOptions(screen.getByLabelText('To entity'), 'two')
  await user.selectOptions(screen.getByLabelText('Evidence basis'), 'human')
  expect(screen.queryByLabelText('Source evidence record ID')).not.toBeInTheDocument()
  await user.type(screen.getByLabelText('Relationship role'), 'Main contractor')
  await user.type(screen.getByLabelText('Evidence pointer'), 'My interview note, paragraph 3')
  await user.type(screen.getByLabelText('Valid from (DD/MM/YYYY)'), '01/09/2026')
  await user.click(screen.getByRole('button', { name: 'Record relationship' }))
  expect(await screen.findByText('Describe the independent human basis for this relationship.')).toBeVisible()
  expect(saved).toBeUndefined()
  await user.type(screen.getByLabelText('Human basis'), 'Interview with the project director on 12 September 2026')
  await user.type(screen.getByLabelText('Review reason'), 'Checked against my contemporaneous notes')
  await user.click(screen.getByRole('button', { name: 'Record relationship' }))
  await waitFor(() => expect(saved).toMatchObject({ evidence_mode: 'human', human_basis: 'Interview with the project director on 12 September 2026', reason: 'Checked against my contemporaneous notes', valid_from: '2026-09-01T00:00:00Z' }))
  expect(saved).not.toHaveProperty('source_record_id')
  expect(saved).not.toHaveProperty('source_url')
})

it('directs pasted publisher references back to retained source evidence', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('link', { name: 'Relationships' }))
  await user.selectOptions(await screen.findByLabelText('Evidence basis'), 'human')
  fireEvent.change(screen.getByLabelText('Human basis'), { target: { value: 'https://caselaw.nationalarchives.gov.uk/test' } })
  await user.click(screen.getByRole('button', { name: 'Record relationship' }))
  expect(await screen.findByText('Web references require retained source evidence.')).toBeVisible()
})
