import { useState } from 'react'
import { apiRequest } from '../api'
import { applicationPath } from '../runtime'
import type { ListResponse, Snapshot } from '../types'
import { useApi } from '../hooks/useApi'
import { usePageTitle } from '../hooks/usePageTitle'
import { Button, FormError, Page, StatePanel, Status, TableFrame } from '../components/Ui'
import { useToast } from '../components/Toast'
import { formatDateTime } from '../format'

export default function Reports() {
  usePageTitle('Reports'); const snapshots = useApi<ListResponse<Snapshot>>('/api/snapshots'); const [created, setCreated] = useState<Snapshot[]>([]); const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const notify = useToast(); const items = [...created, ...(snapshots.data?.items ?? []).filter(item => !created.some(current => current.id === item.id))]
  const create = async (kind: 'weekly' | 'digest') => { setBusy(kind); setError(''); try { const snapshot = await apiRequest<Snapshot>('/api/snapshots', { method: 'POST', body: JSON.stringify({ kind }) }); setCreated(current => [snapshot, ...current]); notify(`${kind === 'weekly' ? 'Weekly' : 'Digest'} snapshot created`, 'success') } catch (reason) { setError(reason instanceof Error ? reason.message : 'Snapshot could not be created') } finally { setBusy('') } }
  return <Page title="Reports" eyebrow="Saved, reproducible snapshots" actions={<><Button intent="brand" emphasis="solid" busy={busy === 'weekly'} onClick={() => create('weekly')}>Create weekly snapshot</Button><Button busy={busy === 'digest'} onClick={() => create('digest')}>Create digest snapshot</Button></>}><p className="lede">A snapshot fixes the server rule version and as-of time. Exports are generated from that saved record.</p><FormError message={error} />{snapshots.loading && !snapshots.data && !created.length ? <StatePanel state="loading" /> : snapshots.error ? <StatePanel state="error" message={snapshots.error} onRetry={snapshots.reload} /> : !items.length ? <StatePanel state="empty" title="No saved reports" message="Create a weekly or digest snapshot to make export links available." /> : <TableFrame label="Saved report snapshots"><table><thead><tr><th scope="col">Snapshot</th><th scope="col">As of</th><th scope="col">Rule version</th><th scope="col">State</th><th scope="col">Exports</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td><strong>{item.kind === 'weekly' ? 'Weekly watchlist' : 'Analyst digest'}</strong><span className="cell-meta"><code>{item.id}</code></span></td><td>{formatDateTime(item.as_of)}</td><td>{item.rule_version ?? 'Recorded in snapshot'}</td><td><Status value={item.redacted_at ? 'redacted' : 'saved'} /></td><td className="export-links"><a href={applicationPath(`/api/exports/${item.id}.csv`)}>Download CSV</a><a href={applicationPath(`/api/exports/${item.id}.html`)}>Download HTML report</a></td></tr>)}</tbody></table></TableFrame>}</Page>
}
