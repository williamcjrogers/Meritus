import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../api'
import type { Alert, ListResponse } from '../types'
import { useApi } from '../hooks/useApi'
import { usePageTitle } from '../hooks/usePageTitle'
import { Button, FormError, Page, Pagination, StatePanel, Status } from '../components/Ui'
import { useToast } from '../components/Toast'
import { formatDateTime, sentence } from '../format'

export default function Alerts() {
  usePageTitle('Alerts')
  const [params, setParams] = useSearchParams()
  const requested = Number(params.get('page') ?? 1)
  const page = Number.isInteger(requested) && requested > 0 ? requested : 1
  const alerts = useApi<ListResponse<Alert>>(`/api/alerts?page=${page}&page_size=25`)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [acknowledged, setAcknowledged] = useState<Record<string, boolean>>({})
  const notify = useToast()
  const markRead = async (alert: Alert) => {
    if (busy[alert.id]) return
    setBusy(current => ({ ...current, [alert.id]: true })); setErrors(current => ({ ...current, [alert.id]: '' }))
    try {
      await apiRequest(`/api/alerts/${encodeURIComponent(alert.id)}/read`, { method: 'POST' })
      setAcknowledged(current => ({ ...current, [alert.id]: true })); notify('Alert marked as read', 'success'); alerts.reload()
    } catch (reason) { setErrors(current => ({ ...current, [alert.id]: reason instanceof Error ? reason.message : 'The alert could not be marked as read.' })) }
    finally { setBusy(current => ({ ...current, [alert.id]: false })) }
  }
  return <Page title="Alerts" eyebrow="Recorded changes and source notices" actions={<Button onClick={alerts.reload}>Refresh alerts</Button>}>
    {alerts.loading && !alerts.data ? <StatePanel state="loading" /> : alerts.error ? <StatePanel state="error" message={alerts.error} onRetry={alerts.reload} /> : !alerts.data?.items.length ? <StatePanel state="empty" title={page > 1 ? 'No alerts on this page' : 'No alerts'} message="Alerts appear here when the server records a relevant change or source notice." /> : <div className="review-list">{alerts.data.items.map(alert => {
      const read = Boolean(alert.read_at || acknowledged[alert.id])
      return <article className="review-card" key={alert.id} aria-labelledby={`alert-${alert.id}`}><header><div><p className="eyebrow">{sentence(alert.category)}</p><h2 id={`alert-${alert.id}`}>{alert.title}</h2></div><Status value={read ? 'read' : 'unread'} /></header><p className="cell-meta">Recorded {formatDateTime(alert.created_at)}{alert.read_at && ` · Read ${formatDateTime(alert.read_at)}`}</p><p>{alert.body}</p><FormError message={errors[alert.id] ?? ''} /><div className="form-actions">{alert.entity_id && <Link to={`/entities/${encodeURIComponent(alert.entity_id)}`}>Open entity</Link>}{!read && <Button type="button" busy={busy[alert.id]} onClick={() => markRead(alert)}>Mark as read</Button>}</div></article>
    })}</div>}
    {alerts.data && <Pagination page={alerts.data.page} pageSize={alerts.data.page_size} total={alerts.data.total} onPage={next => setParams({ page: String(next), page_size: '25' })} />}
  </Page>
}
