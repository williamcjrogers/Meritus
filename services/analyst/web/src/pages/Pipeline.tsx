import { useState, type FormEvent } from 'react'
import { apiRequest } from '../api'
import type { Entity, ListResponse, PipelineAction, OutcomeMetrics } from '../types'
import { useApi } from '../hooks/useApi'
import { usePageTitle } from '../hooks/usePageTitle'
import { Button, DependencyState, FormError, Page, SelectField, StatePanel, TableFrame, TextAreaField, TextField } from '../components/Ui'
import { EntityPicker } from '../components/EntityPicker'
import { useToast } from '../components/Toast'
import { formatDateTime, formatNumber, parseUkDate, sentence } from '../format'
import { pipelineStages } from '../workflow'

function OutcomeSummary({ data }: { data: OutcomeMetrics }) {
  const rate = (value: number | null) => value == null ? 'Not available' : new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 1 }).format(value)
  return <><div className="metrics-strip">
    {Object.entries(data.counts).map(([key, value]) => <div key={key}><span>{sentence(key)}</span><strong>{formatNumber(value)}</strong></div>)}
    <div><span>Conversation rate from reviewed</span><strong>{rate(data.conversation_rate_reviewed)}</strong><small>{data.counts.conversations} conversations / {data.denominators.conversation_rate_reviewed} reviewed recommendations</small></div>
    <div><span>Conversation rate from contacted</span><strong>{rate(data.conversation_rate_contacted)}</strong><small>{data.counts.conversations} conversations / {data.denominators.conversation_rate_contacted} contacted opportunities</small></div>
  </div><p>{data.denominator_scope.reviewed_recommendations}. {data.denominator_scope.contacted_opportunities}.</p><p>Reviewed cohort: {data.filters.cohort ?? 'All cohorts'} · {data.filters.date_from ? formatDateTime(data.filters.date_from) : 'All earlier dates'} to {formatDateTime(data.filters.date_to)}. Follow-up through {formatDateTime(data.filters.follow_up_through)}.</p><p>{data.benchmark_assessment === 'insufficient_observation_time' ? 'Insufficient observation time for benchmark assessment.' : sentence(data.benchmark_assessment)}</p></>
}

export default function Pipeline() {
  usePageTitle('Pipeline')
  const actions = useApi<ListResponse<PipelineAction>>('/api/pipeline')
  const entities = useApi<ListResponse<Entity>>('/api/entities')
  const [metricQuery, setMetricQuery] = useState('')
  const metrics = useApi<OutcomeMetrics>(`/api/metrics${metricQuery}`)
  const [filters, setFilters] = useState({ cohort: '', date_from: '', date_to: '' })
  const [filterError, setFilterError] = useState('')
  const notify = useToast()
  const [form, setForm] = useState({ entity_id: '', stage: 'review', note: '' })
  const [formError, setFormError] = useState(''); const [busy, setBusy] = useState(false)
  const entitiesReady = !entities.loading && !entities.error
  const applyFilters = (event: FormEvent) => {
    event.preventDefault(); setFilterError('')
    const from = filters.date_from ? parseUkDate(filters.date_from) : null; const to = filters.date_to ? parseUkDate(filters.date_to) : null
    if ((filters.date_from && !from) || (filters.date_to && !to)) { setFilterError('Enter valid filter dates as DD/MM/YYYY.'); return }
    if (from && to && from > to) { setFilterError('The end date must be on or after the start date.'); return }
    const params = new URLSearchParams(); if (filters.cohort.trim()) params.set('cohort', filters.cohort.trim()); if (from) params.set('date_from', from); if (to) params.set('date_to', to)
    setMetricQuery(params.size ? `?${params}` : '')
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setFormError('')
    if (!entitiesReady) { setFormError('Wait for the entity register before recording a pipeline action.'); return }
    if (!form.entity_id || !form.note.trim()) { setFormError('Select an entity and explain the human action.'); document.getElementById(!form.entity_id ? 'pipeline_entity' : 'pipeline_note')?.focus(); return }
    setBusy(true)
    try { await apiRequest('/api/pipeline', { method: 'POST', body: JSON.stringify(form) }); notify('Pipeline action recorded', 'success'); setForm(current => ({ ...current, note: '' })); actions.reload(); metrics.reload() }
    catch (reason) { setFormError(reason instanceof Error ? reason.message : 'Pipeline action could not be saved') } finally { setBusy(false) }
  }
  return <Page title="Pipeline" eyebrow="Human action history">
    <section aria-label="Server-reported outcome metrics"><h2>Outcome metrics</h2><form onSubmit={applyFilters} noValidate><div className="toolbar"><TextField id="metric-cohort" label="Cohort" value={filters.cohort} onChange={event => setFilters(current => ({ ...current, cohort: event.target.value }))} /><TextField id="metric-from" label="Reviewed from (DD/MM/YYYY)" value={filters.date_from} onChange={event => setFilters(current => ({ ...current, date_from: event.target.value }))} /><TextField id="metric-to" label="Reviewed to (DD/MM/YYYY)" value={filters.date_to} onChange={event => setFilters(current => ({ ...current, date_to: event.target.value }))} /><Button type="submit">Apply metric filters</Button></div><FormError message={filterError} /></form>{metrics.loading ? <StatePanel state="loading" /> : metrics.error ? <StatePanel state="error" message={metrics.error} onRetry={metrics.reload} /> : metrics.data ? <OutcomeSummary data={metrics.data} /> : <p>Outcome metrics have not been supplied.</p>}</section>
    <section className="split-layout"><form className="form-panel" noValidate onSubmit={submit}><h2>Record human action</h2><DependencyState label="entity register" loading={entities.loading} error={entities.error} onRetry={entities.reload} /><FormError message={formError} /><EntityPicker id="pipeline_entity" label="Entity" value={form.entity_id} onChange={value => setForm(current => ({ ...current, entity_id: value }))} disabled={!entitiesReady} entities={entities.data?.items ?? []} /><SelectField id="pipeline_stage" label="Pipeline stage" value={form.stage} onChange={event => setForm(current => ({ ...current, stage: event.target.value }))}>{pipelineStages.map(stage => <option key={stage} value={stage}>{sentence(stage)}</option>)}</SelectField><TextAreaField id="pipeline_note" label="Action note" value={form.note} onChange={event => setForm(current => ({ ...current, note: event.target.value }))} rows={4} /><Button type="submit" intent="brand" emphasis="solid" busy={busy} disabled={!entitiesReady}>Record pipeline action</Button></form>
    <section className="list-panel"><h2>Audit timeline</h2>{actions.loading && !actions.data ? <StatePanel state="loading" /> : actions.error ? <StatePanel state="error" message={actions.error} onRetry={actions.reload} /> : !actions.data?.items.length ? <StatePanel state="empty" title="No pipeline actions" message="Human stage changes and notes appear here with actor and time." /> : <TableFrame label="Pipeline actions"><table><thead><tr><th scope="col">Entity</th><th scope="col">Stage</th><th scope="col">Action</th><th scope="col">Actor and time</th></tr></thead><tbody>{actions.data.items.map(item => <tr key={item.id}><td>{item.entity_name ?? item.entity_id}</td><td>{sentence(item.stage)}</td><td>{item.note}</td><td>{item.actor ?? 'Unknown actor'}<span className="cell-meta">{formatDateTime(item.occurred_at)}</span></td></tr>)}</tbody></table></TableFrame>}</section></section>
  </Page>
}
