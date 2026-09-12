import { useMemo, useState, type FormEvent } from 'react'
import { apiRequest } from '../api'
import type { IngestionRun, ListResponse, Source } from '../types'
import { useApi } from '../hooks/useApi'
import { usePageTitle } from '../hooks/usePageTitle'
import { Button, DependencyState, FormError, Page, SelectField, StatePanel, Status, TextAreaField, TextField } from '../components/Ui'
import { useToast } from '../components/Toast'
import { SourceLicenceNotice } from '../components/SourceLicenceNotice'
import { formatDateTime, formatNumber, parseUkDate, sentence } from '../format'

const operations = ['retrieve', 'import', 'analyse', 'export'] as const
interface PermissionForm {
  reference: string; scope: string; reviewed_at: string; expires_at: string
  operations: string[]; retention_days: string; retain_full_text: string; denied: boolean
}
function permissionForm(source: Source): PermissionForm {
  const permission = source.permissions
  const scope = permission.scope
  return {
    reference: String(permission.reference ?? permission.permission_reference ?? ''),
    scope: typeof scope === 'string' ? scope : scope == null ? '' : JSON.stringify(scope, null, 2),
    reviewed_at: String(permission.reviewed_at ?? ''), expires_at: String(permission.expires_at ?? ''),
    operations: Array.isArray(permission.operations) ? permission.operations.filter((item): item is string => typeof item === 'string') : [],
    retention_days: String(permission.retention_days ?? ''),
    retain_full_text: typeof permission.retain_full_text === 'boolean' ? String(permission.retain_full_text) : '',
    denied: permission.denied === true,
  }
}
function validOffsetDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.exec(value)
  return Boolean(match && parseUkDate(`${match[3]}/${match[2]}/${match[1]}`) && Number.isFinite(Date.parse(value)))
}

function PermissionEditor({ source, busy, onSave, onClose }: { source: Source; busy: boolean; onSave: (permissions: Record<string, unknown>) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState(() => permissionForm(source))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const change = (key: keyof PermissionForm, value: string | boolean | string[]) => { setForm(current => ({ ...current, [key]: value })); setErrors(current => ({ ...current, [key]: '' })) }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const next: Record<string, string> = {}
    let scope: unknown = form.scope.trim()
    if (typeof scope === 'string' && /^[{[]/.test(scope)) {
      try { scope = JSON.parse(scope) } catch { next.scope = 'Enter valid JSON or a plain-text scope.' }
    }
    if (!form.denied) {
      if (!form.reference.trim()) next.reference = 'Enter the approval or licence reference.'
      if (!form.scope.trim()) next.scope = 'Describe the approved scope.'
      if (!validOffsetDate(form.reviewed_at.trim())) next.reviewed_at = 'Enter a valid ISO date and time including Z or a UTC offset.'
      else if (Date.parse(form.reviewed_at) > Date.now()) next.reviewed_at = 'The review date cannot be in the future.'
    }
    if (form.expires_at.trim() && !validOffsetDate(form.expires_at.trim())) next.expires_at = 'Enter a valid ISO date and time including Z or a UTC offset.'
    if (form.retention_days && (!/^\d+$/.test(form.retention_days) || !Number.isSafeInteger(Number(form.retention_days)) || Number(form.retention_days) <= 0)) next.retention_days = 'Enter a positive whole number of days.'
    setErrors(next)
    if (Object.keys(next).length) { document.getElementById(`grant-${source.id}-${Object.keys(next)[0]}`)?.focus(); return }
    await onSave({ reference: form.reference.trim(), scope, reviewed_at: form.reviewed_at.trim(), operations: operations.filter(operation => form.operations.includes(operation)), expires_at: form.expires_at.trim() || null, retention_days: form.retention_days ? Number(form.retention_days) : null, retain_full_text: form.retain_full_text === '' ? null : form.retain_full_text === 'true', denied: form.denied })
  }
  const id = (key: string) => `grant-${source.id}-${key}`
  return <form className="form-panel" onSubmit={submit} noValidate aria-label={`Permission for ${source.name}`}>
    <h3>Recorded permission</h3>
    <p>Enter the terms of an actual reviewed approval. Select only the operations it permits. Saving these terms does not enable collection.</p>
    <TextField id={id('reference')} label="Permission reference" value={form.reference} onChange={event => change('reference', event.target.value)} error={errors.reference} autoFocus />
    <TextAreaField id={id('scope')} label="Permission scope (text or JSON)" value={form.scope} onChange={event => change('scope', event.target.value)} error={errors.scope} hint="Preserve restrictions such as permitted publication sensitivity or authorised uses. Existing structured scopes remain JSON." />
    <TextField id={id('reviewed_at')} label="Reviewed at (ISO date and time with offset)" value={form.reviewed_at} onChange={event => change('reviewed_at', event.target.value)} error={errors.reviewed_at} placeholder="2026-09-12T09:30:00+01:00" />
    <fieldset><legend>Explicitly permitted operations</legend>{operations.map(operation => <label key={operation}><input type="checkbox" checked={form.operations.includes(operation)} onChange={event => change('operations', event.target.checked ? [...form.operations, operation] : form.operations.filter(item => item !== operation))} /> {sentence(operation)}</label>)}</fieldset>
    <TextField id={id('expires_at')} label="Expires at (ISO date and time, optional)" value={form.expires_at} onChange={event => change('expires_at', event.target.value)} error={errors.expires_at} hint="Include Z or a UTC offset. Leave blank only if no expiry was specified." />
    <TextField id={id('retention_days')} label="Retention days (optional)" inputMode="numeric" value={form.retention_days} onChange={event => change('retention_days', event.target.value)} error={errors.retention_days} />
    <SelectField id={id('retain_full_text')} label="Retain full text" value={form.retain_full_text} onChange={event => change('retain_full_text', event.target.value)}><option value="">Not specified</option><option value="true">Expressly permitted</option><option value="false">Not permitted</option></SelectField>
    <label><input type="checkbox" checked={form.denied} onChange={event => change('denied', event.target.checked)} /> Permission denied or withdrawn</label>
    <div className="form-actions"><Button type="submit" intent="brand" busy={busy}>Save permission</Button><Button type="button" onClick={onClose} disabled={busy}>Cancel editing</Button></div>
  </form>
}

function CompanyWatchlist({ source, busy, onSave }: { source: Source; busy: boolean; onSave: (numbers: string[]) => Promise<void> }) {
  const existing = [source.config.company_keys, source.config.company_numbers, source.config.watchlist].find(item => Array.isArray(item) && item.length)
  const [value, setValue] = useState(Array.isArray(existing) ? existing.map(item => String(item).replace(/^GB-COH:/, '')).join('\n') : '')
  const [error, setError] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const numbers = value.split(/\r?\n/).map(item => item.trim().toUpperCase()).filter(Boolean)
    if (numbers.length > 200) { setError('Enter at most 200 approved company numbers.'); return }
    setError(''); await onSave(numbers)
  }
  return <form className="form-panel" onSubmit={submit} noValidate>
    <TextAreaField id="company-numbers" label="Approved company numbers" value={value} onChange={event => { setValue(event.target.value); setError('') }} error={error} rows={4} hint="Enter one Companies House number per line, up to 200 approved companies. Clearing the list blocks collection until a new list is saved." />
    <Button type="submit" busy={busy}>Save company watchlist</Button>
  </form>
}

export default function Sources() {
  usePageTitle('Sources')
  const sources = useApi<ListResponse<Source>>('/api/sources'); const runs = useApi<ListResponse<IngestionRun>>('/api/runs'); const notify = useToast()
  const [editing, setEditing] = useState<string | null>(null); const [busy, setBusy] = useState(''); const [error, setError] = useState('')
  const latestRuns = useMemo(() => { const latest = new Map<string, IngestionRun>(); for (const run of runs.data?.items ?? []) { if (!latest.has(run.source_id)) latest.set(run.source_id, run) } return latest }, [runs.data])
  const update = async (source: Source, changes: Record<string, unknown>) => {
    setBusy(source.id); setError('')
    try {
      await apiRequest<Source>(`/api/sources/${source.id}`, { method: 'PATCH', body: JSON.stringify(changes) })
      notify(`${source.name} configuration saved`, 'success'); if ('permissions' in changes) setEditing(null); sources.reload()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Configuration could not be saved') } finally { setBusy('') }
  }
  const queue = async (source: Source) => {
    setBusy(source.id); setError('')
    try { await apiRequest(`/api/sources/${source.id}/run`, { method: 'POST' }); notify(`${source.name} run queued`, 'info'); runs.reload(); sources.reload() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Run could not be queued'); sources.reload() } finally { setBusy('') }
  }
  return <Page title="Sources" eyebrow="Coverage and permissions">
    <FormError message={error} />
    <p>Access readiness reflects current permission and this API process configuration. The worker checks access again before collection. Refresh after environment configuration changes.</p>
    <Button onClick={() => { sources.reload(); runs.reload() }} disabled={sources.loading || runs.loading}>Refresh source readiness</Button>
    <DependencyState label="ingestion run history" loading={runs.loading} error={runs.error} onRetry={runs.reload} />
    {sources.loading && !sources.data ? <StatePanel state="loading" /> : sources.error ? <StatePanel state="error" message={sources.error} onRetry={sources.reload} /> : !sources.data?.items.length ? <StatePanel state="empty" title="No sources configured" message="Source seeds must be created by the API before ingestion can run." /> : <div className="source-list">{sources.data.items.map(source => {
      const run = latestRuns.get(source.id); const readiness = source.readiness
      const coverage = runs.loading ? 'Checking run history' : runs.error ? 'Unavailable' : source.partial || run?.status === 'partial' ? 'Partial' : !run ? 'No run recorded' : ['complete', 'completed', 'success'].includes(run.status) ? 'Current run boundary' : `Run ${sentence(run.status)}`
      const allowed = operations.filter(operation => readiness?.operations[operation])
      return <article className="source-card" key={source.id}>
        <header><div><h2>{source.name}</h2><p>{source.description || 'No description supplied.'}</p></div><Status value={readiness ? readiness.can_run ? 'ready' : 'blocked' : 'unknown'} /></header>
        <SourceLicenceNotice source={source.name} permissions={source.permissions} />
        <dl className="source-facts">
          <div><dt>Configured</dt><dd>{source.enabled ? 'Enabled' : 'Disabled'}</dd></div>
          <div><dt>Current permitted operations</dt><dd>{readiness ? allowed.length ? allowed.map(sentence).join(', ') : 'No current grant' : 'Not checked'}</dd></div>
          <div><dt>Permission reference</dt><dd>{String(source.permissions?.reference ?? source.permissions?.permission_reference ?? (source.requires_permission ? 'Permission required' : 'Catalogue terms'))}</dd></div>
          <div><dt>Credentials</dt><dd>{readiness ? readiness.credentials.length ? readiness.credentials.map(credential => <div key={credential.name}>{credential.name}: {credential.configured ? 'Configured' : 'Missing'}{credential.required_for_run === false ? ' (separate stream)' : ''}</div>) : 'Not required' : 'Presence not checked'}</dd></div>
          {readiness?.contact.required && <div><dt>Organisational contact</dt><dd>{readiness.contact.configured ? 'Configured' : 'Missing'}</dd></div>}
          <div><dt>Freshness</dt><dd>{formatDateTime(source.last_success_at)}</dd></div><div><dt>Coverage</dt><dd>{coverage}</dd></div>
        </dl>
        {source.licence_url && <p className="source-links"><a href={source.licence_url} target="_blank" rel="noreferrer">Licence and permitted use</a>{source.home_url && <a href={source.home_url} target="_blank" rel="noreferrer">Open source service</a>}</p>}
        {readiness && !readiness.can_run && <div className="notice notice-warning">{readiness.reasons.join(' ')}</div>}
        {source.credential_names.length > 0 && <p>Credentials are configured in the process environment. Their values cannot be entered or viewed here.</p>}
        {source.id === 'companies_house' && <CompanyWatchlist key={JSON.stringify(source.config)} source={source} busy={busy === source.id} onSave={company_numbers => update(source, { config: { company_numbers } })} />}
        {editing === source.id ? <PermissionEditor key={source.id} source={source} busy={busy === source.id} onSave={permissions => update(source, { permissions })} onClose={() => setEditing(null)} /> : source.requires_permission && <Button onClick={() => { setEditing(source.id); setError('') }} disabled={Boolean(busy)}>Edit permission for {source.name}</Button>}
        <footer><div>{runs.loading ? <span>Loading ingestion run status…</span> : runs.error ? <span>Run status unavailable</span> : run ? <><span>Latest run</span><Status value={run.status} /><span>{formatNumber(run.fetched)} fetched · {formatNumber(run.inserted)} inserted · {formatNumber(run.rejected)} rejected</span></> : <span>No ingestion run recorded</span>}</div>
          <Button onClick={() => update(source, { enabled: !source.enabled })} disabled={Boolean(busy) || sources.loading}>{source.enabled ? 'Disable' : 'Enable'} {source.name}</Button>
          <Button intent="brand" emphasis="solid" onClick={() => queue(source)} busy={busy === source.id} disabled={!source.enabled || !readiness?.can_run || run?.status === 'running' || sources.loading}>Run {source.name}</Button>
        </footer>{source.last_error && <p className="field-error">Last run error: {sentence(source.last_error)}</p>}
      </article>
    })}</div>}
  </Page>
}
