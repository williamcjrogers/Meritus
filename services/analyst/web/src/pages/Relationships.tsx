import { useState, type FormEvent } from 'react'
import { apiRequest } from '../api'
import type { Entity, ListResponse, Relationship } from '../types'
import { useApi } from '../hooks/useApi'
import { usePageTitle } from '../hooks/usePageTitle'
import { Button, DependencyState, FormError, Page, SelectField, StatePanel, Status, TableFrame, TextAreaField, TextField } from '../components/Ui'
import { EvidenceRecordField } from '../components/EvidenceRecordField'
import { professionalRoles } from '../workflow'
import { OpportunitiesPanel } from '../components/OpportunitiesPanel'
import { EntityPicker } from '../components/EntityPicker'
import { useToast } from '../components/Toast'
import { formatDate, parseUkDate, sentence } from '../format'

const webReference = /https?:\/\/|www\.|\b(?:[a-z0-9-]+\.)+(?:com|org|net|uk|gov|io)\b/i

export default function Relationships() {
  usePageTitle('Relationships')
  const relationships = useApi<ListResponse<Relationship>>('/api/relationships')
  const entities = useApi<ListResponse<Entity>>('/api/entities')
  const notify = useToast()
  const [form, setForm] = useState({ from_entity_id: '', to_entity_id: '', role: '', matter_reference: '', matter_entity_id: '', evidence_pointer: '', evidence_mode: 'source', human_basis: '', reason: '', source_record_id: '', source_url: '', valid_from: '', valid_to: '', state: 'verified' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [opportunitiesVersion, setOpportunitiesVersion] = useState(0)
  const entitiesReady = !entities.loading && !entities.error
  const change = (key: string, value: string) => {
    setForm(current => ({ ...current, [key]: value }))
    setErrors(current => ({ ...current, [key]: '' }))
    setFormError('')
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!entitiesReady) { setFormError('Wait for the entity register before recording a relationship.'); return }
    const next: Record<string, string> = {}
    if (!form.from_entity_id) next.from_entity_id = 'Select the first entity.'
    if (!form.to_entity_id) next.to_entity_id = 'Select the second entity.'
    if (form.from_entity_id && form.from_entity_id === form.to_entity_id) next.to_entity_id = 'Choose a different second entity.'
    if ((professionalRoles as readonly string[]).includes(form.role.trim().toLowerCase()) && !form.matter_reference.trim() && !form.matter_entity_id) next.matter_reference = 'Identify the specific matter for this professional role.'
    if (!form.role.trim()) next.role = 'Enter the evidenced relationship role.'
    if (!form.evidence_pointer.trim()) next.evidence_pointer = 'Enter the source evidence location.'
    if (!form.reason.trim()) next.reason = 'Explain the review that supports this relationship.'
    if (form.evidence_mode === 'human') {
      if (!form.human_basis.trim()) next.human_basis = 'Describe the independent human basis for this relationship.'
      if (webReference.test([form.human_basis, form.evidence_pointer, form.reason].join(' '))) next.human_basis = 'Web references require retained source evidence.'
    } else if (!form.source_record_id.trim()) next.source_record_id = 'Select or enter the retained source evidence record.'
    const validFrom = parseUkDate(form.valid_from)
    const validTo = form.valid_to.trim() ? parseUkDate(form.valid_to) : null
    if (!validFrom) next.valid_from = 'Enter a valid start date as DD/MM/YYYY.'
    if (form.valid_to.trim() && !validTo) next.valid_to = 'Enter a valid end date as DD/MM/YYYY.'
    else if (validFrom && validTo && validTo < validFrom) next.valid_to = 'The end date cannot precede the start date.'
    setErrors(next)
    if (Object.keys(next).length) { document.getElementById(Object.keys(next)[0])?.focus(); return }
    setBusy(true)
    try {
      const { source_record_id, source_url, human_basis, matter_reference, matter_entity_id, ...common } = form
      const evidence = form.evidence_mode === 'human' ? { human_basis: human_basis.trim() } : { source_record_id: source_record_id.trim(), source_url: source_url.trim() }
      await apiRequest('/api/relationships', { method: 'POST', body: JSON.stringify({ ...common, ...evidence, attributes: { ...(matter_reference.trim() ? { matter_reference: matter_reference.trim() } : {}), ...(matter_entity_id ? { matter_entity_id } : {}) }, reason: form.reason.trim(), valid_from: `${validFrom}T00:00:00Z`, valid_to: validTo ? `${validTo}T00:00:00Z` : null }) })
      notify('Relationship recorded', 'success')
      setForm(current => ({ ...current, role: '', evidence_pointer: '', source_record_id: '', source_url: '', human_basis: '', reason: '', valid_from: '', valid_to: '' }))
      relationships.reload(); setOpportunitiesVersion(current => current + 1)
    } catch (reason) { setFormError(reason instanceof Error ? reason.message : 'Relationship could not be saved') } finally { setBusy(false) }
  }
  return <Page title="Relationships" eyebrow="Typed, evidenced links"><section className="split-layout">
    <form className="form-panel" noValidate onSubmit={submit}>
      <h2>Record relationship</h2>
      <p>Choose the two people, organisations or projects, describe their role and record the dates supported by retained evidence or an independently reviewed human note.</p>
      <DependencyState label="entity register" loading={entities.loading} error={entities.error} onRetry={entities.reload} />
      <FormError message={formError} />
      <EntityPicker id="from_entity_id" label="From entity" value={form.from_entity_id} onChange={value => change('from_entity_id', value)} error={errors.from_entity_id} disabled={!entitiesReady} entities={entities.data?.items ?? []} />
      <EntityPicker id="to_entity_id" label="To entity" value={form.to_entity_id} onChange={value => change('to_entity_id', value)} error={errors.to_entity_id} disabled={!entitiesReady} entities={entities.data?.items ?? []} />
      <TextField id="role" label="Relationship role" value={form.role} onChange={event => change('role', event.target.value)} error={errors.role} placeholder="supplier, adviser or another evidenced role" list="relationship-role-values" /><datalist id="relationship-role-values">{['supplier', 'main_contractor', ...professionalRoles].map(role => <option key={role} value={role}>{sentence(role)}</option>)}</datalist><p className="field-hint">Use adviser, funder, practitioner or introduction_route for the corresponding professional route. Professional roles require a specific matter.</p><TextField id="matter_reference" label="Matter reference" value={form.matter_reference} onChange={event => change('matter_reference', event.target.value)} error={errors.matter_reference} /><EntityPicker id="matter_entity_id" label="Matter entity" value={form.matter_entity_id} onChange={value => change('matter_entity_id', value)} entities={entities.data?.items ?? []} disabled={!entitiesReady} optional />
      <SelectField id="evidence_mode" label="Evidence basis" value={form.evidence_mode} onChange={event => change('evidence_mode', event.target.value)}><option value="source">Retained source evidence</option><option value="human">Human note or interview</option></SelectField>
      <TextField id="evidence_pointer" label="Evidence pointer" value={form.evidence_pointer} onChange={event => change('evidence_pointer', event.target.value)} error={errors.evidence_pointer} placeholder="Document section, paragraph or interview note" />
      {form.evidence_mode === 'human' ? <TextAreaField id="human_basis" label="Human basis" value={form.human_basis} onChange={event => change('human_basis', event.target.value)} error={errors.human_basis} hint="Describe your independent note, interview or direct knowledge, including who and when. Publisher and web references require retained source evidence." /> : <><EvidenceRecordField id="source_record_id" value={form.source_record_id} onChange={value => change('source_record_id', value)} error={errors.source_record_id} required /><TextField id="relationship_source_url" label="Source URL" type="url" value={form.source_url} onChange={event => change('source_url', event.target.value)} /></>}
      <TextAreaField id="reason" label="Review reason" value={form.reason} onChange={event => change('reason', event.target.value)} error={errors.reason} required hint="Required for every relationship. State why the retained source evidence or human note supports this relationship." />
      <TextField id="valid_from" label="Valid from (DD/MM/YYYY)" value={form.valid_from} onChange={event => change('valid_from', event.target.value)} error={errors.valid_from} placeholder="DD/MM/YYYY" required hint="Use the evidenced start date. Do not substitute the date you enter this record." />
      <TextField id="valid_to" label="Valid to (DD/MM/YYYY, optional)" value={form.valid_to} onChange={event => change('valid_to', event.target.value)} error={errors.valid_to} placeholder="DD/MM/YYYY" />
      <Button type="submit" intent="brand" emphasis="solid" busy={busy} disabled={!entitiesReady}>Record relationship</Button>
    </form>
    <section className="list-panel"><h2>Relationship register</h2>{relationships.loading && !relationships.data ? <StatePanel state="loading" /> : relationships.error ? <StatePanel state="error" message={relationships.error} onRetry={relationships.reload} /> : !relationships.data?.items.length ? <StatePanel state="empty" title="No relationships recorded" message="Reviewed entity links appear here with their evidence basis." /> : <TableFrame label="Relationships"><table><thead><tr><th scope="col">From</th><th scope="col">Role</th><th scope="col">To</th><th scope="col">Matter</th><th scope="col">Evidence</th><th scope="col">Valid from</th><th scope="col">Valid to</th><th scope="col">State</th></tr></thead><tbody>{relationships.data.items.map(item => <tr key={item.id}><td>{item.from_name ?? item.from_entity_id}</td><td>{item.role}</td><td>{item.to_name ?? item.to_entity_id}</td><td>{String(item.attributes?.matter_reference ?? item.attributes?.matter_entity_id ?? 'Not recorded')}</td><td>{item.source_url ? <a href={item.source_url} target="_blank" rel="noreferrer">Open source</a> : item.evidence_pointer}{item.attributes?.evidence_mode === 'human' && <span className="cell-meta">Human evidence: {item.attributes.human_basis}</span>}</td><td>{formatDate(item.valid_from)}</td><td>{formatDate(item.valid_to)}</td><td><Status value={item.state ?? 'verified'} /></td></tr>)}</tbody></table></TableFrame>}</section>
  </section><OpportunitiesPanel entities={entities.data?.items ?? []} disabled={!entitiesReady} version={opportunitiesVersion} /></Page>
}
