import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const body = path === '/api/auth/setup-status' ? { needs_setup: false }
      : path === '/api/auth/me' ? { username: 'browser.analyst', csrf_token: 'browser-csrf' }
      : path === '/api/watchlist' ? { items: [], total: 0, page: 1, page_size: 25, as_of: '2026-09-12T08:00:00Z', rule_version: 'browser-fixture', synthetic: true }
      : path === '/api/alerts' || path === '/api/sources' || path === '/api/runs' || path === '/api/reviews' || path === '/api/evidence' || path === '/api/entities' || path === '/api/calendar' || path === '/api/relationships' || path === '/api/pipeline' || path === '/api/snapshots' ? { items: [], total: 0, page: 1, page_size: 25 }
      : path === '/api/metrics' ? { counts: { reviewed_recommendations: 0, contacted_opportunities: 0, conversations: 0, instructions: 0 }, denominators: { conversation_rate_reviewed: 0, conversation_rate_contacted: 0 }, denominator_scope: { reviewed_recommendations: 'Distinct reviewed entities', contacted_opportunities: 'Distinct contacted entities' }, filters: { cohort: null, date_from: null, date_to: '2026-09-12T08:00:00Z', follow_up_through: '2026-09-12T08:00:00Z' }, conversation_rate_reviewed: null, conversation_rate_contacted: null, benchmark_assessment: 'insufficient_observation_time', synthetic: true }
      : path === '/api/indices' ? { series: [], coverage: [], suppressed_points: 0, suppressed: [], methodology: 'Synthetic browser fixture only. Missing windows remain missing.' }
      : { detail: `Unhandled synthetic browser fixture: ${path}` }
    await route.fulfill({ status: 'detail' in body ? 404 : 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
})

test('keyboard navigation, empty state and narrow layout remain usable', async ({ page }, testInfo) => {
  await page.goto('/')
  await expect(page.getByText('Demo data')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Watchlist' })).toBeVisible()
  await expect(page.getByText('No entities are currently eligible for the watchlist.')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('watchlist-initial.png'), fullPage: true })
  await page.getByRole('link', { name: 'Imports' }).focus()
  await expect(page.getByRole('link', { name: 'Imports' })).toBeFocused()
  await page.setViewportSize({ width: 360, height: 740 })
  await expect(page.getByRole('navigation', { name: 'Analyst desk' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('watchlist-narrow.png'), fullPage: true })
})

test('finite index bars and all six outcome measures remain contained on narrow screens', async ({ page }, testInfo) => {
  await page.route('**/api/indices', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    series: [{ source_id: 'bsa_gateway', kind: 'gateway_metric', category: 'applications', unit: 'count', scope: 'published_gateway_measure', points: [
      { window: '2026-Q1', value: 17, record_id: 'synthetic-point-1', observation_id: 'synthetic-point-1' },
      { window: '2026-Q2', value: null, record_id: 'synthetic-point-2', observation_id: 'synthetic-point-2' },
      { window: '2026-Q4', value: 0, record_id: 'synthetic-point-4', observation_id: 'synthetic-point-4' },
    ] }], coverage: [], suppressed: [], methodology: 'Synthetic browser fixture. Missing windows remain missing.', synthetic: true,
  }) }))
  await page.goto('/indices')
  await expect(page.getByRole('img', { name: 'Applications by reporting window' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('indices-bars-initial.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
  const plot = page.getByRole('region', { name: 'Applications plot, scroll horizontally for all values' })
  await expect(plot).toBeVisible()
  await plot.evaluate(element => { element.scrollLeft = element.scrollWidth })
  expect(await plot.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('indices-bars-narrow.png'), fullPage: true })
  await page.goto('/pipeline')
  await expect(page.locator('.metrics-strip > div')).toHaveCount(6)
  const measures = await page.locator('.metrics-strip > div').evaluateAll(elements => elements.map(element => { const box = element.getBoundingClientRect(); return { top: box.top, left: box.left, right: box.right } }))
  expect(new Set(measures.map(measure => measure.top)).size).toBe(3)
  expect(measures.every(measure => measure.left >= 0 && measure.right <= 390)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('pipeline-metrics-narrow.png'), fullPage: true })
})

test('actual publication window and long category shape remain contained and readable', async ({ page }, testInfo) => {
  const window = '2026-08-31T00:00:00+00:00'
  const identity = { source_id: 'bsr_gateway', kind: 'gateway_metric', category: 'new_hrbs_and_conversions_complex_cases', unit: 'weeks' }
  await page.route('**/api/indices', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    series: [{ ...identity, scope: 'published_gateway_measure', points: [{ window, period_start: null, period_end: window, value: 33, published_at: '2026-09-04T10:52:03+00:00', record_id: 'synthetic-publication', observation_id: 'synthetic-observation', source_url: 'https://assets.publishing.service.gov.uk/media/6a9a852a5a0c25165ae468ee/Building_Safety_Regulator_building_control_approval_application_data_June_to_August_2026.pdf' }] }],
    coverage: [{ ...identity, windows: [window], first_window: window, last_window: window, point_count: 1 }], suppressed: [], methodology: 'Mocked transport using the observed public publication shape.', synthetic: true,
  }) }))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/indices')
  await expect(page.getByRole('heading', { name: 'Coverage', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true)
  await expect(page.getByRole('heading', { name: 'New HRBs and conversions complex cases', exact: true })).toBeVisible()
  await expect(page.getByRole('img')).toHaveAccessibleDescription('31 August 2026: 33 weeks. Only supplied finite values are plotted; missing windows are not estimated.')
  await expect(page.getByRole('cell', { name: '31 August 2026', exact: true })).toBeVisible()
  await expect(page.getByText('Windows: 31 August 2026', { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('indices-publication-narrow.png'), fullPage: true })
})

test('success notifications do not obstruct the next report action', async ({ page }) => {
  let created = 0
  await page.route('**/api/snapshots', route => {
    if (route.request().method() !== 'POST') return route.fallback()
    created += 1
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: `synthetic-snapshot-${created}`, kind: 'weekly', created_at: '2026-09-12T08:00:00Z', rule_version: 'synthetic' }) })
  })
  await page.setViewportSize({ width: 1440, height: 1050 })
  await page.goto('/reports')
  const create = page.getByRole('button', { name: 'Create weekly snapshot', exact: true })
  await create.click()
  await expect(page.getByText('synthetic-snapshot-1', { exact: true })).toBeVisible()
  await create.click({ timeout: 1_500 })
  await expect(page.getByText('synthetic-snapshot-2', { exact: true })).toBeVisible()
  expect(created).toBe(2)
})

test('stored Find Case Law licence notices remain readable at 390 pixels', async ({ page }, testInfo) => {
  const attribution = 'Crown copyright material reproduced by permission of The National Archives. The contents of the judgment can be used under the Open Justice – Licence.'
  const coverage = 'Find Case Law material only partially represents the activities of the courts and tribunals.'
  const permissions = { attribution, distribution_conditions: [coverage, 'Internal platform use only.'] }
  const record = { id: 'synthetic-fcl-record', source_id: 'find_case_law', source_name: 'Find Case Law', source_permissions: permissions, title: 'Synthetic judgment', source_url: 'https://caselaw.nationalarchives.gov.uk/ewhc/tcc/2026/1', active: true }
  await page.route('**/api/sources', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{ id: 'find_case_law', name: 'Find Case Law', enabled: false, requires_permission: true, credential_names: [], config: {}, permissions }] }) }))
  await page.route('**/api/evidence', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [record] }) }))
  await page.route('**/api/entities/synthetic-fcl-entity', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'synthetic-fcl-entity', key: 'TEST:FCL', name: 'Synthetic FCL entity', kind: 'organisation', verified: true, observations: [{ ...record, id: 'synthetic-observation' }], records: [record] }) }))
  await page.setViewportSize({ width: 390, height: 844 })
  for (const [path, count] of [['/sources', 1], ['/evidence', 1], ['/entities/synthetic-fcl-entity', 2]] as const) {
    await page.goto(path)
    const notices = page.getByRole('note', { name: 'Find Case Law licence conditions' })
    await expect(notices).toHaveCount(count)
    for (const notice of await notices.all()) {
      await expect(notice.getByText(attribution, { exact: true })).toBeVisible()
      await expect(notice.getByText(coverage, { exact: true })).toBeVisible()
      expect(await notice.evaluate(element => { const box = element.getBoundingClientRect(); return box.left >= 0 && box.right <= 390 && element.scrollWidth <= element.clientWidth })).toBe(true)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`licence-${path.split('/').at(-1)}-narrow.png`), fullPage: true })
  }
})
