/** Real browser acceptance against an isolated restored copy. No mocked responses. */
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { chmod, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, expect as baseExpect } from '@playwright/test'

const expect = baseExpect.configure({ timeout: 45_000 })
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const origin = process.env.MERITUS_ACCEPTANCE_URL || 'http://127.0.0.1:8090'
assert.equal(origin, 'http://127.0.0.1:8090', 'Acceptance is restricted to the isolated copy on port 8090')
const verificationRoot = path.join(root, 'data/verification')
const credentialPath = path.resolve(process.env.MERITUS_ACCEPTANCE_CREDENTIAL_FILE || path.join(verificationRoot, 'browser-acceptance-credentials.json'))
assert.ok(credentialPath.startsWith(`${verificationRoot}${path.sep}`), 'Credentials must remain in ignored data/verification')
const phase = process.env.MERITUS_ACCEPTANCE_PHASE || 'full'
assert.ok(['full', 'exports', 'keyboard', 'persistence'].includes(phase), 'Acceptance phase must be full, exports, keyboard or persistence')
const existingSnapshotId = process.env.MERITUS_ACCEPTANCE_SNAPSHOT_ID
assert.ok(!existingSnapshotId || ['exports', 'persistence'].includes(phase), 'An existing snapshot may only be reused for a focused export or persistence check')
assert.ok(phase !== 'persistence' || existingSnapshotId, 'Persistence verification requires the known saved snapshot ID')
const runId = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const output = path.join(verificationRoot, 'browser-acceptance', runId)
await mkdir(output, { recursive: true, mode: 0o700 })
const report = { run_id: runId, phase, target: origin, started_at: new Date().toISOString(), status: 'running', mocked_responses: false, steps: [], gaps: [], browser_errors: [], api_timings: [], artifacts: [], writes: [] }
if (phase === 'exports') report.gaps.push('Focused export and narrow-layout run; full workflow acceptance requires a separate complete run.')
if (phase === 'keyboard') report.gaps.push('Focused actual keyboard and client-validation run; complete workflow acceptance is reported separately.')
if (phase === 'persistence') report.gaps.push('Focused read-only persisted Reports verification; the runtime restart and complete workflow acceptance are recorded separately.')
const secrets = []
let credentials
let authenticated = false
let browser
let page
let csrf = ''
const safe = value => secrets.reduce((text, secret) => secret ? text.replaceAll(secret, '[redacted]') : text, String(value)).replace(/((?:set-)?cookie:)[^\r\n]*/gi, '$1 [redacted]').replace(/meritus_session=[^\s;]+/g, 'meritus_session=[redacted]')
const textFile = async (name, content) => { const filename = path.join(output, name); await writeFile(filename, content, { mode: 0o600 }); report.artifacts.push(filename); return filename }
const saveReport = () => writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2), { mode: 0o600 })
const step = async (name, action) => {
  if (name === 'Actual keyboard navigation and client validation' && phase !== 'keyboard') return
  if (phase === 'exports' && !['Real runtime preflight', 'Setup or login through the real form', 'Saved snapshot and actual CSV/HTML exports', 'Reload, narrow layout, sign out and sign back in'].includes(name)) return
  if (phase === 'keyboard' && !['Real runtime preflight', 'Setup or login through the real form', 'Actual keyboard navigation and client validation'].includes(name)) return
  if (phase === 'persistence' && !['Real runtime preflight', 'Setup or login through the real form', 'Read-only persisted Reports verification'].includes(name)) return
  const item = { name, started_at: new Date().toISOString(), status: 'running' }
  report.steps.push(item)
  await saveReport()
  try { item.result = await action(); item.status = 'passed'; console.log(`PASS ${name}`) }
  catch (error) { item.status = 'failed'; item.error = safe(error.message); throw error }
  finally { item.finished_at = new Date().toISOString(); await saveReport() }
}
const shot = async (name, { settled = true, fullPage = true } = {}) => {
  assert.ok(authenticated, 'Screenshots are forbidden on authentication screens')
  assert.equal(await page.getByLabel('Password', { exact: true }).count(), 0, 'Password field must not appear in screenshots')
  if (settled) { await expect(page.locator('[aria-busy="true"]')).toHaveCount(0); await expect(page.locator('.toast-success, .toast-info')).toHaveCount(0) }
  await page.evaluate(() => window.scrollTo(0, 0))
  const filename = path.join(output, `${name}.png`)
  await page.screenshot({ path: filename, fullPage })
  await chmod(filename, 0o600)
  report.artifacts.push(filename)
}
const api = async (pathname, options = {}) => {
  assert.ok(pathname.startsWith('/api/') && !pathname.startsWith('//'), 'API path must be relative')
  const response = await page.request.fetch(`${origin}${pathname}`, { timeout: 60_000, ...options })
  assert.ok(response.ok(), `${options.method || 'GET'} ${pathname}: HTTP ${response.status()} ${safe(await response.text())}`)
  return response
}
const json = async pathname => (await api(pathname)).json()
const mutateThroughUi = async (pathname, action) => {
  const timeout = pathname === '/api/snapshots' ? 90_000 : 60_000
  const [response] = await Promise.all([page.waitForResponse(response => new URL(response.url()).pathname === pathname && response.request().method() === 'POST', { timeout }), action()])
  assert.ok(response.ok(), `UI POST ${pathname}: HTTP ${response.status()} ${safe(await response.text())}`)
  const body = await response.json()
  if (body.persisted !== false) report.writes.push({ path: pathname, id: body.id || null, at: new Date().toISOString(), method: 'UI' })
  await saveReport()
  return body
}
const navigate = async (label, heading = label) => {
  await page.getByRole('navigation', { name: 'Analyst desk' }).getByRole('link', { name: label, exact: true }).click()
  await expect(page.getByRole('heading', { name: heading, exact: true, level: 1 })).toBeVisible()
}
const ukDate = value => `${String(value.getUTCDate()).padStart(2, '0')}/${String(value.getUTCMonth() + 1).padStart(2, '0')}/${value.getUTCFullYear()}`
const markers = { first: `SYNTHETIC ACCEPTANCE A ${runId}`, second: `SYNTHETIC ACCEPTANCE B ${runId}`, duplicate: `SYNTHETIC ACCEPTANCE DUPLICATE ${runId}` }
let first
let second
let duplicate
let publicEntity
let relationId
let calendarId
let snapshotId
const pipelineNote = `Browser acceptance ${runId}: isolated copy only; no commercial assessment.`
const chooseEntity = async (label, entity) => {
  const search = page.getByLabel(`Search ${label.toLowerCase()}`, { exact: true })
  await expect(search).toBeEnabled()
  await search.fill(entity.name)
  const field = page.getByLabel(label, { exact: true })
  await expect(field.locator(`option[value="${entity.id}"]`)).toHaveCount(1)
  await field.selectOption(entity.id)
  await expect(field).toHaveValue(entity.id)
}
const approvedStages = ['review', 'shortlisted', 'introduction_considered', 'contacted', 'conversation', 'instruction', 'dismissed', 'snoozed']
const engineFamilies = ['insolvency', 'proceedings', 'procurement_performance', 'corporate_governance_finance', 'payment_practice', 'project_delivery', 'context_amplifiers', 'evidence_only']
const reviewReason = `Browser acceptance ${runId}: reject this deliberately synthetic unresolved identity.`

try {
  browser = await chromium.launch({ headless: process.env.MERITUS_ACCEPTANCE_HEADED !== '1' })
  const context = await browser.newContext({ baseURL: origin, viewport: { width: 1440, height: 1050 }, acceptDownloads: true })
  // This guard only permits real same-origin traffic; it never fulfils or fabricates a response.
  await context.route('**/*', route => {
    const requestUrl = new URL(route.request().url())
    return requestUrl.origin === origin ? route.continue() : route.abort('blockedbyclient')
  })
  page = await context.newPage()
  page.setDefaultTimeout(45_000)
  page.setDefaultNavigationTimeout(60_000)
  const requestStarts = new WeakMap()
  page.on('request', request => requestStarts.set(request, Date.now()))
  page.on('pageerror', error => report.browser_errors.push({ kind: 'pageerror', message: safe(error.message) }))
  page.on('response', response => {
    const url = new URL(response.url())
    if (url.origin === origin && url.pathname.startsWith('/api/')) report.api_timings.push({ path: url.pathname, method: response.request().method(), status: response.status(), elapsed_ms: Date.now() - (requestStarts.get(response.request()) || Date.now()) })
    if (url.origin === origin && response.status() >= 400 && !(response.status() === 401 && url.pathname === '/api/auth/me')) report.browser_errors.push({ kind: 'http', path: url.pathname, status: response.status() })
  })

  await step('Real runtime preflight', async () => {
    const health = await json('/api/health')
    assert.equal(health.database, 'ok', 'Acceptance database must be available')
    assert.equal(health.search, 'ok', 'Acceptance search must be available')
    return { database: health.database, search: health.search }
  })
  await step('Setup or login through the real form', async () => {
    const status = await json('/api/auth/setup-status')
    try { credentials = JSON.parse(await readFile(credentialPath, 'utf8')) }
    catch (error) {
      if (error.code !== 'ENOENT') throw error
      assert.ok(status.needs_setup, 'Existing operator requires a private acceptance credentials file')
      credentials = { username: 'browser.acceptance', password: randomBytes(32).toString('base64url') }
      await mkdir(path.dirname(credentialPath), { recursive: true, mode: 0o700 })
      await writeFile(credentialPath, JSON.stringify(credentials), { mode: 0o600, flag: 'wx' })
    }
    await chmod(credentialPath, 0o600)
    assert.equal((await stat(credentialPath)).mode & 0o777, 0o600)
    assert.equal(typeof credentials.username, 'string')
    assert.equal(typeof credentials.password, 'string')
    secrets.push(credentials.password)
    await page.goto(origin)
    await page.getByLabel('Username', { exact: true }).fill(credentials.username)
    await page.getByLabel('Password', { exact: true }).fill(credentials.password)
    await page.getByRole('button', { name: status.needs_setup ? 'Create operator' : 'Sign in', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Watchlist', exact: true, level: 1 })).toBeVisible()
    authenticated = true
    const session = await json('/api/auth/me')
    csrf = session.csrf_token
    secrets.push(csrf, ...(await context.cookies()).map(cookie => cookie.value))
    assert.equal(session.username, credentials.username)
    return { path: status.needs_setup ? 'setup UI' : 'login UI', credential_file_mode: '0600' }
  })
  await step('Current source state without collection requests', async () => {
    const sources = await json('/api/sources?page_size=100')
    assert.ok(sources.items.length > 0)
    await navigate('Sources')
    await page.getByRole('button', { name: 'Refresh source readiness', exact: true }).click()
    await expect(page.locator('.source-card')).toHaveCount(sources.items.length)
    for (const source of sources.items) {
      const card = page.locator('.source-card').filter({ has: page.getByRole('heading', { name: source.name, exact: true }) })
      await expect(card.getByRole('button', { name: `${source.enabled ? 'Disable' : 'Enable'} ${source.name}`, exact: true })).toBeVisible()
      if (!source.readiness.can_run) await expect(card.getByRole('button', { name: `Run ${source.name}`, exact: true })).toBeDisabled()
    }
    await shot('sources-desktop')
    return { sources: sources.items.length, ready: sources.items.filter(item => item.readiness.can_run).length, collection_jobs_queued: 0 }
  })
  await step('Actual keyboard navigation and client validation', async () => {
    const fixtures = await json('/api/entities?q=SYNTHETIC%20ACCEPTANCE%20B&page_size=25')
    const fixture = fixtures.items.find(item => item.name.startsWith('SYNTHETIC ACCEPTANCE B'))
    assert.ok(fixture, 'An existing synthetic acceptance identity is required for this non-persisted check')
    await page.setViewportSize({ width: 390, height: 844 })
    const tabTo = async locator => {
      await expect(locator).toBeEnabled()
      for (let count = 0; count < 100; count += 1) {
        if (await locator.evaluate(element => element === document.activeElement)) return count
        await page.keyboard.press('Tab')
      }
      throw new Error('Keyboard traversal could not reach the required control in 100 Tab presses')
    }
    const calendarLink = page.getByRole('navigation', { name: 'Analyst desk' }).getByRole('link', { name: 'Calendar', exact: true })
    const navigationTabs = await tabTo(calendarLink)
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Calendar', level: 1, exact: true })).toBeVisible()
    const search = page.getByLabel('Search entity', { exact: true })
    await tabTo(search)
    await page.keyboard.type(fixture.name)
    const entity = page.getByLabel('Entity', { exact: true })
    await expect(entity.locator(`option[value="${fixture.id}"]`)).toHaveCount(1)
    const picker = page.locator('.entity-picker').filter({ has: entity })
    await tabTo(picker.locator('summary'))
    await page.keyboard.press('Enter')
    await tabTo(page.getByLabel('Exact entity ID', { exact: true }))
    await page.keyboard.type(fixture.id)
    await tabTo(page.getByRole('button', { name: 'Use entity ID', exact: true }))
    await page.keyboard.press('Enter')
    await expect(entity).toHaveValue(fixture.id)
    const title = page.getByLabel('Title', { exact: true })
    await tabTo(title)
    const titleText = `SYNTHETIC keyboard validation ${runId}; not saved`
    await page.keyboard.type(titleText)
    const date = page.getByLabel('Date (DD/MM/YYYY)', { exact: true })
    await tabTo(date)
    await page.keyboard.type('31/02/2026')
    let attemptedWrites = 0
    const watchWrite = request => { if (new URL(request.url()).pathname === '/api/calendar' && request.method() === 'POST') attemptedWrites += 1 }
    page.on('request', watchWrite)
    await tabTo(page.getByRole('button', { name: 'Add calendar entry', exact: true }))
    await page.keyboard.press('Enter')
    await expect(page.getByText('Enter a valid date as DD/MM/YYYY.', { exact: true })).toBeVisible()
    await expect(date).toBeFocused()
    await expect(title).toHaveValue(titleText)
    assert.equal(attemptedWrites, 0, 'Invalid keyboard input must not reach a mutation endpoint')
    await shot('keyboard-invalid-date-narrow')
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.type('28/02/2026')
    await expect(date).toHaveValue('28/02/2026')
    await expect(page.getByText('Enter a valid date as DD/MM/YYYY.', { exact: true })).toHaveCount(0)
    await tabTo(page.getByRole('navigation', { name: 'Analyst desk' }).getByRole('link', { name: 'Watchlist', exact: true }))
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Watchlist', level: 1, exact: true })).toBeVisible()
    assert.equal(attemptedWrites, 0)
    page.off('request', watchWrite)
    await page.setViewportSize({ width: 1440, height: 1050 })
    return { navigation: 'Tab and Enter only', form_input: 'Keyboard typing and exact entity-ID disclosure/button', native_popup_keyboard_tested: false, navigation_tab_presses: navigationTabs, invalid_date_focused: true, input_preserved: true, corrected_without_saving: true, mutation_requests: attemptedWrites, upstream_failures_mocked: false }
  })
  await step('Actual alert empty state or read acknowledgement', async () => {
    const received = page.waitForResponse(response => new URL(response.url()).pathname === '/api/alerts' && response.request().method() === 'GET', { timeout: 60_000 })
    await navigate('Alerts')
    const response = await received
    assert.ok(response.ok(), `Alerts page HTTP ${response.status()}`)
    const alerts = await response.json()
    if (!alerts.items.length) {
      await expect(page.getByRole('heading', { name: 'No alerts', exact: true })).toBeVisible()
      await shot('alerts-empty-state')
      return { count: 0, actual_empty_state: true, fabricated_alerts: 0 }
    }
    const target = alerts.items.find(item => !item.read_at)
    if (!target) { await shot('alerts-already-read'); return { count: alerts.total, all_already_read: true, fabricated_alerts: 0 } }
    const card = page.locator(`article[aria-labelledby="alert-${target.id}"]`)
    await expect(card.getByText(target.body, { exact: true })).toBeVisible()
    await mutateThroughUi(`/api/alerts/${target.id}/read`, () => card.getByRole('button', { name: 'Mark as read', exact: true }).click())
    await expect(card.getByText('Read', { exact: true })).toBeVisible()
    await page.reload()
    await expect(card.getByText('Read', { exact: true })).toBeVisible()
    await shot('alerts-read-state')
    return { count: alerts.total, read_alert_id: target.id, persisted_after_reload: true, fabricated_alerts: 0 }
  })
  if (phase === 'persistence') await step('Read-only persisted Reports verification', async () => {
    await navigate('Reports')
    const row = page.getByRole('row').filter({ hasText: existingSnapshotId })
    await expect(row).toBeVisible()
    await expect(row.getByRole('link', { name: 'Download CSV', exact: true })).toBeVisible()
    await expect(row.getByRole('link', { name: 'Download HTML report', exact: true })).toBeVisible()
    await page.reload()
    await expect(row).toBeVisible()
    await shot('reports-after-restart')
    await page.setViewportSize({ width: 390, height: 844 })
    await navigate('Indices')
    await expect(page.getByText('Published market measures', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Coverage', exact: true })).toBeVisible()
    await shot('indices-after-restart-narrow-viewport', { fullPage: false })
    await navigate('Relationships')
    await expect(page.getByText('Choose the two people, organisations or projects, describe their role and record the dates supported by retained evidence or an independently reviewed human note.', { exact: true })).toBeVisible()
    await shot('relationships-after-restart-narrow-viewport', { fullPage: false })
    assert.equal(report.writes.length, 0)
    return { snapshot_id: existingSnapshotId, authenticated_reports_row: true, persisted_after_reload: true, final_copy_verified: true, workflow_mutations: 0, restart_executed_by_script: false }
  })
  await step('Restored public watchlist, detail and explanation', async () => {
    const entities = await json('/api/entities?page_size=25')
    assert.ok(entities.items.length, 'Restored public entities are required')
    publicEntity = entities.items[0]
    await navigate('Watchlist')
    assert.deepEqual(await page.getByLabel('Signal family', { exact: true }).locator('option').evaluateAll(items => items.map(item => item.value).filter(Boolean)), engineFamilies)
    await expect(page.getByLabel('Watchlist coverage', { exact: true })).toBeVisible()
    const ranked = await json('/api/watchlist?page_size=25')
    if (ranked.items.length) {
      publicEntity = { ...publicEntity, id: ranked.items[0].entity_id, name: ranked.items[0].name }
      await expect(page.locator(`a.entity-link[href="/entities/${publicEntity.id}"]`)).toBeVisible()
      await page.locator(`a.entity-link[href="/entities/${publicEntity.id}"]`).click()
    } else {
      await expect(page.getByText('No entities are currently eligible for the watchlist.')).toBeVisible()
      report.gaps.push('The restored data has no ranked watchlist rows; empty-state behaviour was verified.')
      await page.goto(`${origin}/entities/${publicEntity.id}`)
    }
    await expect(page.getByRole('heading', { name: publicEntity.name, exact: true, level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Score contributions', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Source records', exact: true })).toBeVisible()
    const detail = await json(`/api/entities/${publicEntity.id}`)
    if (!detail.score?.contributions?.length) report.gaps.push('No non-zero explanation was invented: this public entity has no supplied score contributions.')
    await shot('public-entity-detail')
    return { entity_id: publicEntity.id, source_records: detail.records.length, score_contributions: detail.score?.contributions?.length || 0 }
  })
  await step('Import clearly synthetic acceptance identities through the UI', async () => {
    await navigate('Imports')
    await page.getByLabel('CSV or JSON rows').fill(JSON.stringify([{ name: markers.first, properties: { synthetic: true, acceptance_run: runId } }, { name: markers.second, scheme: 'SYNTHETIC-ACCEPTANCE', identifier: runId, verified: true, properties: { synthetic: true, acceptance_run: runId } }, { name: markers.duplicate, properties: { synthetic: true, acceptance_run: runId } }]))
    await page.getByLabel('Import kind', { exact: true }).selectOption('organisations')
    await page.getByLabel('Permission reference', { exact: true }).fill(`Author-created synthetic acceptance fixture ${runId}`)
    const preview = await mutateThroughUi('/api/imports/preview', () => page.getByRole('button', { name: 'Preview import', exact: true }).click())
    assert.equal(preview.valid, true, `Synthetic preview rejected: ${JSON.stringify(preview.errors)}`)
    const committed = await mutateThroughUi('/api/imports/commit', () => page.getByRole('button', { name: 'Commit reviewed import', exact: true }).click())
    assert.equal(committed.inserted, 3)
    first = (await json(`/api/entities?q=${encodeURIComponent(markers.first)}`)).items[0]
    second = (await json(`/api/entities?q=${encodeURIComponent(markers.second)}`)).items[0]
    duplicate = (await json(`/api/entities?q=${encodeURIComponent(markers.duplicate)}`)).items[0]
    assert.ok(first?.id && second?.id && duplicate?.id)
    return { inserted: committed.inserted, first_entity_id: first.id, second_entity_id: second.id, synthetic: true }
  })
  await step('Review the synthetic pending entity through Review queue', async () => {
    await navigate('Review queue')
    const allCards = page.locator('.review-card')
    await expect(allCards.first()).toBeVisible()
    let card = allCards.filter({ hasText: first.id })
    if (!await card.count()) card = allCards.filter({ hasText: markers.first })
    await expect(card.first()).toBeVisible()
    card = card.first()
    await card.getByLabel('Reason', { exact: true }).fill(reviewReason)
    const review = await mutateThroughUi('/api/reviews', () => card.getByRole('button', { name: /^Reject (entity|identity)$/ }).click())
    assert.equal(review.target_id, first.id)
    assert.equal(review.action, 'rejected')
    assert.equal(review.actor, credentials.username)
    await expect(page.getByText(reviewReason, { exact: true }).first()).toBeVisible()
    await page.reload()
    await expect(page.getByText(reviewReason, { exact: true }).first()).toBeVisible()
    const audited = page.locator('.review-card').filter({ hasText: reviewReason }).first()
    await expect(audited.getByText('Rejected', { exact: true })).toBeVisible()
    await expect(audited.getByRole('button', { name: /^Reject / })).toHaveCount(0)
    await shot('entity-review-audit')
    return { review_id: review.id, path: 'Imported pending identity, Review queue Reject UI', persisted_after_reload: true }
  })
  await step('Audited entity name correction and identity merge through the UI', async () => {
    await page.goto(`${origin}/entities/${second.id}`)
    await page.getByRole('button', { name: 'Edit entity details', exact: true }).click()
    const corrected = `${markers.second} reviewed`
    await page.getByLabel('Entity name', { exact: true }).fill(corrected)
    const correctionReason = `Corrected the synthetic acceptance display name ${runId}`
    await page.getByLabel('Review reason', { exact: true }).fill(correctionReason)
    const correction = await mutateThroughUi('/api/reviews', () => page.getByRole('button', { name: 'Save reviewed correction', exact: true }).click())
    assert.equal(correction.action, 'update')
    await expect(page.getByRole('heading', { name: corrected, exact: true, level: 1 })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: corrected, exact: true, level: 1 })).toBeVisible()
    second = { ...second, name: corrected }
    await navigate('Review queue')
    const card = page.locator('.review-card').filter({ hasText: markers.duplicate }).filter({ has: page.getByRole('button', { name: 'Merge identity', exact: true }) }).first()
    await expect(card).toBeVisible()
    await card.getByLabel('Find a confirmed entity', { exact: true }).fill(markers.second)
    const candidate = card.locator(`input[type="radio"][value="${second.id}"]`)
    await candidate.check()
    const mergeReason = `Confirmed this intentionally synthetic duplicate belongs to the acceptance identity ${runId}`
    await card.getByLabel('Reason', { exact: true }).fill(mergeReason)
    const merged = await mutateThroughUi('/api/reviews', () => card.getByRole('button', { name: 'Merge identity', exact: true }).click())
    assert.equal(merged.action, 'merge')
    await page.reload()
    const audit = page.locator('.review-card').filter({ hasText: mergeReason }).first()
    await expect(audit.getByText('Merged', { exact: true })).toBeVisible()
    await expect(audit.getByRole('button')).toHaveCount(0)
    await shot('entity-correction-and-merge-audit')
    return { corrected_entity_id: second.id, correction_review_id: correction.id, merged_entity_id: duplicate.id, merge_review_id: merged.id, persisted_after_reload: true }
  })
  await step('Canonical shortlist, pipeline history and server outcome metrics', async () => {
    await navigate('Pipeline')
    await chooseEntity('Entity', second)
    const options = await page.getByLabel('Pipeline stage', { exact: true }).locator('option').evaluateAll(items => items.map(item => item.value))
    assert.deepEqual(options, approvedStages)
    await page.getByLabel('Pipeline stage', { exact: true }).selectOption('shortlisted')
    await page.getByLabel('Action note', { exact: true }).fill(pipelineNote)
    const action = await mutateThroughUi('/api/pipeline', () => page.getByRole('button', { name: 'Record pipeline action', exact: true }).click())
    assert.equal(action.stage, 'shortlisted')
    await expect(page.getByText(pipelineNote, { exact: true })).toBeVisible()
    for (const stage of ['contacted', 'conversation']) {
      await page.getByLabel('Pipeline stage', { exact: true }).selectOption(stage)
      await page.getByLabel('Action note', { exact: true }).fill(`SYNTHETIC workflow acceptance ${stage} ${runId}; no external contact occurred.`)
      await mutateThroughUi('/api/pipeline', () => page.getByRole('button', { name: 'Record pipeline action', exact: true }).click())
    }
    await page.getByLabel('Reviewed from (DD/MM/YYYY)', { exact: true }).fill(ukDate(new Date()))
    await page.getByLabel('Reviewed to (DD/MM/YYYY)', { exact: true }).fill(ukDate(new Date()))
    const metricResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/metrics' && new URL(response.url()).searchParams.has('date_from'))
    await page.getByRole('button', { name: 'Apply metric filters', exact: true }).click()
    const metrics = await (await metricResponse).json()
    await expect(page.getByText(`${metrics.counts.conversations} conversations / ${metrics.denominators.conversation_rate_reviewed} reviewed recommendations`, { exact: true })).toBeVisible()
    await expect(page.getByText(`${metrics.counts.conversations} conversations / ${metrics.denominators.conversation_rate_contacted} contacted opportunities`, { exact: true })).toBeVisible()
    await shot('pipeline-and-metrics')
    await navigate('Watchlist')
    const filter = page.getByLabel('Pipeline stage', { exact: true })
    await filter.selectOption('shortlisted')
    await page.reload()
    await expect(filter).toHaveValue('shortlisted')
    assert.equal(new URL(page.url()).searchParams.get('stage'), 'shortlisted')
    return { pipeline_id: action.id, stage: 'shortlisted', approved_stages: options, counts: metrics.counts, denominators: metrics.denominators, rates: { reviewed: metrics.conversation_rate_reviewed, contacted: metrics.conversation_rate_contacted } }
  })
  await step('Human relationship with explicit dates and review reason', async () => {
    await navigate('Relationships')
    await expect(page.getByLabel('From entity', { exact: true })).toBeEnabled()
    await chooseEntity('From entity', first)
    await chooseEntity('To entity', second)
    await page.getByLabel('Relationship role', { exact: true }).fill('acceptance_test_link')
    await page.getByLabel('Evidence basis', { exact: true }).selectOption('human')
    await page.getByLabel('Evidence pointer', { exact: true }).fill(`Acceptance exercise ${runId}`)
    await page.getByLabel('Human basis', { exact: true }).fill('Automated acceptance exercise on an isolated copy. Both identities are synthetic; no factual commercial relationship is asserted.')
    await page.getByLabel('Review reason', { exact: true }).fill(`Checked the synthetic acceptance fixture ${runId}`)
    await page.getByLabel('Valid from (DD/MM/YYYY)', { exact: true }).fill(ukDate(new Date()))
    const relation = await mutateThroughUi('/api/relationships', () => page.getByRole('button', { name: 'Record relationship', exact: true }).click())
    assert.equal(relation.record_id, null)
    assert.equal(relation.attributes.evidence_mode, 'human')
    relationId = relation.id
    await expect(page.getByText('acceptance_test_link', { exact: true }).first()).toBeVisible()
    await page.reload()
    await expect(page.getByText('acceptance_test_link', { exact: true }).first()).toBeVisible()
    await shot('human-relationship')
    return { relationship_id: relationId, record_id: null, explicit_date: relation.valid_from, persisted_after_reload: true }
  })
  await step('Provisional synthetic calendar entry through the real form', async () => {
    await navigate('Calendar')
    await expect(page.getByLabel('Entity', { exact: true })).toBeEnabled()
    await chooseEntity('Entity', first)
    const title = `SYNTHETIC acceptance review ${runId}`
    await page.getByLabel('Title', { exact: true }).fill(title)
    const date = new Date(Date.now() + 86400000)
    await page.getByLabel('Date (DD/MM/YYYY)', { exact: true }).fill(ukDate(date))
    await page.getByLabel('Date type', { exact: true }).selectOption('review')
    await page.getByLabel('Status', { exact: true }).selectOption('provisional')
    await page.getByLabel('Date precision', { exact: true }).selectOption('approximate')
    const entry = await mutateThroughUi('/api/calendar', () => page.getByRole('button', { name: 'Add calendar entry', exact: true }).click())
    assert.equal(entry.status, 'provisional')
    assert.equal(entry.precision, 'approximate')
    calendarId = entry.id
    await expect(page.getByText(title, { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByText(title, { exact: true })).toBeVisible()
    return { calendar_id: calendarId, provisional: true, persisted_after_reload: true }
  })
  await step('Real opportunity panels, illustrative timing and grouped indices', async () => {
    await navigate('Relationships')
    const opportunities = await json('/api/opportunities?page_size=25')
    await expect(page.getByRole('heading', { name: 'Exposure and relationship review', exact: true })).toBeVisible()
    await expect(page.getByText(opportunities.coverage, { exact: true })).toBeVisible()
    await navigate('Calendar')
    await chooseEntity('Timing entity', second)
    await page.getByLabel('Accrual date (DD/MM/YYYY)', { exact: true }).fill(ukDate(new Date()))
    await page.getByLabel('Selected period (years)', { exact: true }).fill('6')
    await page.getByLabel('Timing input basis', { exact: true }).fill(`SYNTHETIC acceptance assumption ${runId}; no legal conclusion.`)
    const timing = await mutateThroughUi('/api/calendar/timing', () => page.getByRole('button', { name: 'Preview illustrative timing', exact: true }).click())
    assert.equal(timing.persisted, false); assert.equal(timing.actionable, false)
    await expect(page.getByText('Not saved. Not actionable. Human review is required.', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Use in provisional form', exact: true }).click()
    await expect(page.getByLabel('Status', { exact: true })).toHaveValue('provisional')
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Illustrative accrual-plus-period review date')
    const savedTiming = await mutateThroughUi('/api/calendar', () => page.getByRole('button', { name: 'Add calendar entry', exact: true }).click())
    assert.equal(savedTiming.status, 'provisional')
    assert.ok(savedTiming.basis.includes('plus 6 years'))
    const indicesResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/indices' && response.request().method() === 'GET', { timeout: 60_000 })
    await navigate('Indices')
    const indexResponse = await indicesResponse
    assert.ok(indexResponse.ok(), `Indices page HTTP ${indexResponse.status()}`)
    const indices = await indexResponse.json()
    await expect(page.getByText(indices.methodology, { exact: true })).toBeVisible()
    const points = indices.series.flatMap(series => series.points)
    const plottedSeries = indices.series.filter(series => series.points.some(point => typeof point.value === 'number' && Number.isFinite(point.value)))
    await expect(page.locator('.index-chart svg[role="img"]')).toHaveCount(plottedSeries.length)
    if (points.length) await expect(page.getByTitle(points[0].window, { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Coverage', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Suppression', exact: true })).toBeVisible()
    await shot('indices-published-series')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('.index-chart-scroll').evaluateAll(plots => plots.forEach(plot => { plot.scrollLeft = plot.scrollWidth }))
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2), 'Index plots must remain within a horizontally scrolling wrapper')
    await shot('indices-narrow')
    await page.locator('.index-chart-scroll').evaluateAll(plots => plots.forEach(plot => { plot.scrollLeft = 0 }))
    await shot('indices-narrow-viewport', { fullPage: false })
    await page.setViewportSize({ width: 1440, height: 1050 })
    return { opportunity_totals: opportunities.totals, timing_preview_unpersisted: timing.persisted === false, explicitly_saved_timing_id: savedTiming.id, index_series: indices.series.length, index_points: points.length, plotted_series: plottedSeries.length, suppressed_points: indices.suppressed_points }
  })
  await step('Saved snapshot and actual CSV/HTML exports', async () => {
    await navigate('Reports')
    const snapshot = existingSnapshotId ? { id: existingSnapshotId } : await mutateThroughUi('/api/snapshots', () => page.getByRole('button', { name: 'Create weekly snapshot', exact: true }).click())
    snapshotId = snapshot.id
    const row = page.getByRole('row').filter({ hasText: snapshotId })
    await expect(row).toBeVisible()
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), row.getByRole('link', { name: 'Download CSV', exact: true }).click()])
    const csvPath = path.join(output, 'snapshot.csv')
    await download.saveAs(csvPath)
    await chmod(csvPath, 0o600)
    assert.ok((await stat(csvPath)).size > 0)
    report.artifacts.push(csvPath)
    const [htmlDownload] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), row.getByRole('link', { name: 'Download HTML report', exact: true }).click()])
    const htmlPath = path.join(output, 'snapshot.html')
    await htmlDownload.saveAs(htmlPath)
    await chmod(htmlPath, 0o600)
    assert.ok((await stat(htmlPath)).size > 0)
    assert.ok((await readFile(htmlPath, 'utf8')).includes('<html'))
    report.artifacts.push(htmlPath)
    await shot('saved-reports')
    return { snapshot_id: snapshotId, reused_existing_snapshot: Boolean(existingSnapshotId), csv_bytes: (await stat(csvPath)).size, html_downloaded_through_ui: true }
  })
  await step('Reload, narrow layout, sign out and sign back in', async () => {
    await page.reload()
    await expect(page.getByText(snapshotId, { exact: true })).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('navigation', { name: 'Analyst desk' })).toBeVisible()
    await shot('reports-narrow')
    await navigate('Relationships')
    await expect(page.getByRole('button', { name: 'Record relationship', exact: true })).toBeVisible()
    await shot('relationships-narrow')
    await shot('relationships-narrow-viewport', { fullPage: false })
    const tableScroll = await page.locator('.table-scroll').evaluateAll(tables => tables.map(table => {
      const overflow = table.scrollWidth > table.clientWidth
      table.scrollLeft = table.scrollWidth
      const lastCell = table.querySelector('thead tr > :last-child')
      const reachable = !lastCell || lastCell.getBoundingClientRect().right <= table.getBoundingClientRect().right + 2
      return { overflow, scroll_left: table.scrollLeft, final_column_reachable: reachable }
    }))
    assert.ok(tableScroll.every(table => table.final_column_reachable), 'Every relationship table final column must be reachable by horizontal scroll')
    await shot('relationships-narrow-table-end')
    const overflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)
    if (overflowing) report.gaps.push('Relationships page has horizontal viewport overflow at 390 pixels.')
    authenticated = false
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Return to the evidence desk', exact: true })).toBeVisible()
    await page.getByLabel('Username', { exact: true }).fill(credentials.username)
    await page.getByLabel('Password', { exact: true }).fill(credentials.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Relationships', exact: true, level: 1 })).toBeVisible()
    authenticated = true
    if (relationId) assert.ok((await json('/api/relationships?page_size=100')).items.some(item => item.id === relationId))
    if (calendarId) assert.ok((await json('/api/calendar?page_size=100')).items.some(item => item.id === calendarId))
    assert.ok((await json('/api/snapshots?page_size=100')).items.some(item => item.id === snapshotId))
    return { narrow_width: 390, table_scroll: tableScroll, reload_persisted: true, relogin_persisted: true, service_restart_tested: false }
  })
  if (report.browser_errors.length) report.gaps.push(`${report.browser_errors.length} browser or HTTP errors were observed; inspect the report.`)
  report.status = report.gaps.length ? 'incomplete' : 'passed'
  process.exitCode = report.gaps.length ? 2 : 0
} catch (error) {
  report.status = 'failed'
  report.failure = safe(error.message)
  if (authenticated && page && !await page.getByLabel('Password', { exact: true }).count()) {
    try { await shot('failure-after-authentication', { settled: false }) } catch { /* The report remains useful if capture fails. */ }
  }
  console.error(`FAIL ${safe(error.message)}`)
  process.exitCode = 1
} finally {
  if (authenticated && page) {
    try {
      const response = await page.request.get(`${origin}/api/auth/me`, { timeout: 10_000 })
      if (response.ok()) { const session = await response.json(); const logout = await page.request.post(`${origin}/api/auth/logout`, { headers: { 'X-CSRF-Token': session.csrf_token }, timeout: 10_000 }); report.session_cleanup = logout.ok() ? 'signed_out' : 'not_confirmed' }
    } catch { report.session_cleanup = 'not_confirmed' }
  }
  report.finished_at = new Date().toISOString()
  await saveReport()
  await browser?.close()
  console.log(`Acceptance report: ${path.join(output, 'report.json')}`)
}
