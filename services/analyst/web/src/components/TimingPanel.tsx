import { useState, type FormEvent } from 'react'
import type { Entity, TimingPreview } from '../types'
import { apiRequest } from '../api'
import { EntityPicker } from './EntityPicker'
import { Button, FormError, TextAreaField, TextField } from './Ui'
import { formatDate, parseUkDate } from '../format'

export function TimingPanel({ entities, disabled, onUse }: { entities: Entity[]; disabled: boolean; onUse: (preview: TimingPreview['preview']) => void }) {
  const [form, setForm] = useState({ entity_id: '', accrual_date: '', period_years: '', input_basis: '' })
  const [preview, setPreview] = useState<TimingPreview | null>(null)
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const change = (key: string, value: string) => { setForm(current => ({ ...current, [key]: value })); setPreview(null); setError('') }
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setPreview(null)
    const date = parseUkDate(form.accrual_date); const years = Number(form.period_years)
    if (!form.entity_id || !date || !/^\d+$/.test(form.period_years) || years < 1 || years > 100 || !form.input_basis.trim()) { setError('Select an entity, enter a valid accrual date, a whole period from 1 to 100 years and the input basis.'); return }
    setBusy(true)
    try { const result = await apiRequest<TimingPreview>('/api/calendar/timing', { method: 'POST', body: JSON.stringify({ ...form, accrual_date: date, period_years: years, input_basis: form.input_basis.trim() }) }); setPreview(result) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The timing preview could not be calculated.') } finally { setBusy(false) }
  }
  return <section className="list-panel"><h2>Illustrative accrual timing</h2><p>Enter the accrual date and selected period for an illustrative review date. This is not a confirmed deadline or a legal conclusion.</p><form noValidate onSubmit={submit} className="form-panel"><FormError message={error} /><EntityPicker id="timing_entity" label="Timing entity" value={form.entity_id} onChange={value => change('entity_id', value)} entities={entities} disabled={disabled} /><TextField id="accrual_date" label="Accrual date (DD/MM/YYYY)" value={form.accrual_date} onChange={event => change('accrual_date', event.target.value)} /><TextField id="period_years" label="Selected period (years)" type="number" min="1" max="100" step="1" value={form.period_years} onChange={event => change('period_years', event.target.value)} /><TextAreaField id="input_basis" label="Timing input basis" value={form.input_basis} onChange={event => change('input_basis', event.target.value)} required /><Button type="submit" disabled={disabled} busy={busy}>Preview illustrative timing</Button></form>{preview && <section className="notice"><h3>Illustrative review date: {formatDate(preview.preview.date)}</h3><p>Entered accrual date {formatDate(preview.preview.calculation.accrual_date)} plus {preview.preview.calculation.selected_period_years} years.</p><p>Basis: {preview.preview.basis}</p><p>Not saved. Not actionable. Human review is required.</p><Button type="button" onClick={() => onUse(preview.preview)}>Use in provisional form</Button></section>}</section>
}

export function CompletionWindow({ entryId }: { entryId: string }) {
  const [data, setData] = useState<{ basis_date: string; window_start: string; window_end: string } | null>(null)
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const load = async () => {
    setBusy(true); setError('')
    try { setData(await apiRequest(`/api/calendar/${encodeURIComponent(entryId)}/post-completion-window`)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The completion window could not be loaded.') } finally { setBusy(false) }
  }
  return <div><Button type="button" busy={busy} onClick={load}>Show post-completion window</Button><FormError message={error} />{data && <p>12 to 24 months after confirmed practical completion: {formatDate(data.window_start)} to {formatDate(data.window_end)}. Basis date: {formatDate(data.basis_date)}.</p>}</div>
}
