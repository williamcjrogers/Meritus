import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import Papa from 'papaparse'
import { apiRequest } from '../api'
import { usePageTitle } from '../hooks/usePageTitle'
import { Button, FormError, Page, SelectField, StatePanel, TableFrame, TextAreaField, TextField } from '../components/Ui'
import { useToast } from '../components/Toast'

interface Preview { valid: boolean; errors: Array<string | { row: number | null; message: string }>; preview: Array<Record<string, unknown>>; token: string }
function parseRows(text: string): Array<Record<string, unknown>> {
  const trimmed = text.trim(); if (!trimmed) return []
  if (trimmed.startsWith('[')) {
    const value = JSON.parse(trimmed) as unknown
    if (!Array.isArray(value) || value.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('JSON must be an array of row objects.')
    return value as Array<Record<string, unknown>>
  }
  const result = Papa.parse<Record<string, string>>(trimmed, { header: true, skipEmptyLines: 'greedy', transformHeader: header => header.trim() })
  if (result.errors.length) { const issue = result.errors[0]; throw new Error(`CSV could not be parsed${typeof issue.row === 'number' ? ` at row ${issue.row + 1}` : ''}: ${issue.message}`) }
  return result.data
}
export default function Imports() {
  usePageTitle('Imports'); const [kind, setKind] = useState('organisations'); const [text, setText] = useState(''); const [sourceUrl, setSourceUrl] = useState(''); const [permission, setPermission] = useState(''); const [preview, setPreview] = useState<Preview | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(''); const fileInput = useRef<HTMLInputElement>(null); const notify = useToast()
  const previewGeneration = useRef(0); const previewController = useRef<AbortController | null>(null)
  useEffect(() => () => previewController.current?.abort(), [])
  const invalidatePreview = () => { previewGeneration.current += 1; previewController.current?.abort(); previewController.current = null; setPreview(null); setBusy(current => current === 'preview' ? '' : current); setError('') }
  const changed = (update: () => void) => { invalidatePreview(); update() }
  const file = async (event: ChangeEvent<HTMLInputElement>) => { const selected = event.target.files?.[0]; invalidatePreview(); if (!selected) return; if (!/\.(csv|json)$/i.test(selected.name)) { setError('Choose a CSV or JSON file.'); return } const generation = previewGeneration.current; const content = await selected.text(); if (previewGeneration.current === generation) setText(content) }
  const makePreview = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    let rows: Array<Record<string, unknown>>
    try { rows = parseRows(text) } catch (reason) { setError(reason instanceof Error ? reason.message : 'The selected content could not be parsed.'); return }
    if (!rows.length) { setError('Add at least one CSV or JSON row.'); fileInput.current?.focus(); return }
    previewController.current?.abort()
    const controller = new AbortController(); const generation = ++previewGeneration.current; previewController.current = controller; setBusy('preview')
    try { const result = await apiRequest<Preview>('/api/imports/preview', { method: 'POST', signal: controller.signal, body: JSON.stringify({ kind, rows, source_url: sourceUrl, permission_reference: permission }) }); if (previewGeneration.current === generation) setPreview(result) }
    catch (reason) { if (!(reason instanceof DOMException && reason.name === 'AbortError') && previewGeneration.current === generation) setError(reason instanceof Error ? reason.message : 'Import preview failed') }
    finally { if (previewGeneration.current === generation) { previewController.current = null; setBusy('') } }
  }
  const commit = async () => { if (!preview?.valid || !preview.token) return; setBusy('commit'); setError(''); try { const result = await apiRequest<Record<string, number>>('/api/imports/commit', { method: 'POST', body: JSON.stringify({ token: preview.token }) }); notify(`Import committed: ${Object.entries(result).map(([key, value]) => `${value} ${key}`).join(', ')}`, 'success'); setPreview(null); setText('') } catch (reason) { setError(reason instanceof Error ? reason.message : 'Import commit failed') } finally { setBusy('') } }
  const columns = preview?.preview[0] ? Object.keys(preview.preview[0]) : []
  return <Page title="Imports" eyebrow="Reviewed CSV and JSON"><section className="split-layout"><form className="form-panel" noValidate onSubmit={makePreview}><h2>Prepare import</h2><p>Preview parsing and policy errors before a single server commit. Only the supplied rows and source context are submitted for review.</p><FormError message={error} /><SelectField id="import-kind" label="Import kind" value={kind} onChange={event => changed(() => setKind(event.target.value))}><option value="organisations">Organisations</option><option value="projects">Projects</option><option value="relationships">Relationships</option><option value="calendar">Calendar entries</option><option value="metrics">Published metrics</option><option value="documents">Documents</option></SelectField><div className="field"><label htmlFor="import-file">CSV or JSON file</label><input ref={fileInput} id="import-file" type="file" accept=".csv,.json,text/csv,application/json" onChange={file} /><p className="field-hint">Choose one UTF-8 CSV or JSON file. You can also paste content below.</p></div><TextAreaField id="import-content" label="CSV or JSON rows" value={text} onChange={event => changed(() => setText(event.target.value))} rows={8} /><TextField id="import-source" label="Source URL" type="url" value={sourceUrl} onChange={event => changed(() => setSourceUrl(event.target.value))} /><TextField id="import-permission" label="Permission reference" value={permission} onChange={event => changed(() => setPermission(event.target.value))} hint="Record the licence or permission relied upon for this import." /><Button type="submit" intent="brand" emphasis="solid" busy={busy === 'preview'}>Preview import</Button></form><section className="list-panel"><h2>Server preview</h2>{!preview ? <StatePanel state="empty" title="No preview yet" message="Choose or paste rows, then preview them before commit." /> : <>{preview.errors.length > 0 && <div className="form-error" role="alert"><strong>Preview errors</strong><ul>{preview.errors.map((item, index) => <li key={index}>{typeof item === 'string' ? item : `${item.row == null ? '' : `Row ${item.row}: `}${item.message}`}</li>)}</ul></div>}{preview.preview.length ? <TableFrame label="Import preview" range={`${preview.preview.length} parsed rows`}><table><thead><tr>{columns.map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead><tbody>{preview.preview.map((row, index) => <tr key={index}>{columns.map(column => <td key={column}>{typeof row[column] === 'object' && row[column] !== null ? JSON.stringify(row[column]) : String(row[column] ?? '')}</td>)}</tr>)}</tbody></table></TableFrame> : <StatePanel state="empty" title="Preview contains no rows" message="Correct the source rows and preview again." />}<Button intent="success" emphasis="solid" onClick={commit} busy={busy === 'commit'} disabled={!preview.valid}>Commit reviewed import</Button></>}</section></section></Page>
}
