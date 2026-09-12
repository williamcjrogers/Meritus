import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../api'
import type { Entity, ListResponse, ReviewItem } from '../types'
import { useApi } from '../hooks/useApi'
import { usePageTitle } from '../hooks/usePageTitle'
import { AuditLine, Button, FormError, Page, Pagination, StatePanel, Status, TextAreaField } from '../components/Ui'
import { useToast } from '../components/Toast'
import { SearchField } from '../components/SearchField'
import { sentence } from '../format'

type DecisionAction = 'accept' | 'reject' | 'merge' | 'confirm_independence' | 'withdraw'

function candidateLabel(entity: Entity) {
  return `${entity.name} · ${sentence(entity.kind)} · ${entity.identifier || entity.key} · ID ${entity.id}`
}

function EntityCandidateSearch({ reviewId, selected, onSelect }: { reviewId: string; selected: string; onSelect: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState<Entity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const sequence = useRef(0)

  useEffect(() => {
    const term = query.trim()
    const request = ++sequence.current
    setCandidates([])
    if (term.length < 2) { setLoading(false); setError(''); return }
    const controller = new AbortController()
      setLoading(true); setError('')
      apiRequest<ListResponse<Entity>>(`/api/entities?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        .then(result => { if (sequence.current === request) setCandidates(result.items.filter(entity => entity.verified === true)) })
        .catch(reason => {
          if (!(reason instanceof DOMException && reason.name === 'AbortError') && sequence.current === request) setError(reason instanceof Error ? reason.message : 'Candidates could not be loaded')
        })
        .finally(() => { if (sequence.current === request) setLoading(false) })
    return () => controller.abort()
  }, [query])

  return <fieldset className="candidate-search">
    <legend>Merge target</legend>
    <SearchField id={`candidate-${reviewId}`} label="Find a confirmed entity" committed={query} onCommit={value => { setQuery(value); onSelect('') }} loading={loading} embedded hint="Search by name or identifier. Only confirmed entities can receive this identity." />
    <div className="candidate-results" aria-live="polite" aria-busy={loading || undefined}>
      {loading ? <p>Searching confirmed entities…</p> : error ? <p className="field-error">{error}</p> : query.trim().length < 2 ? <p>Enter at least two characters.</p> : !candidates.length ? <p>No confirmed matches. Leave this identity pending or reject it with a reason.</p> : candidates.map(entity => <label className="candidate-option" key={entity.id}><input type="radio" name={`merge-target-${reviewId}`} value={entity.id} checked={selected === entity.id} onChange={() => onSelect(entity.id)} /><span>{candidateLabel(entity)}</span></label>)}
    </div>
  </fieldset>
}

export default function ReviewQueue() {
  usePageTitle('Review queue')
  const [page, setPage] = useState(1)
  const reviews = useApi<ListResponse<ReviewItem>>(`/api/reviews?page=${page}&page_size=25`)
  const notify = useToast()
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [mergeTargets, setMergeTargets] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState('')

  const decide = async (item: ReviewItem, requestedAction: 'accept' | 'reject' | 'withdraw') => {
    const reason = reasons[item.id]?.trim() ?? ''
    const type = item.review_type ?? item.target_type
    if (!reason) { setErrors(current => ({ ...current, [item.id]: 'Give a reason for this decision.' })); document.getElementById(`reason-${item.id}`)?.focus(); return }
    if (type === 'identity' && requestedAction === 'accept' && !mergeTargets[item.id]) {
      setErrors(current => ({ ...current, [item.id]: 'Select the confirmed entity that should receive this identity.' }))
      document.getElementById(`candidate-${item.id}`)?.focus()
      return
    }
    const action: DecisionAction = requestedAction === 'accept' && type === 'identity' ? 'merge' : requestedAction === 'accept' && type === 'independence' ? 'confirm_independence' : requestedAction
    const payload = action === 'merge' ? { into_entity_id: mergeTargets[item.id] } : {}
    setBusy(item.id); setErrors(current => ({ ...current, [item.id]: '' }))
    try {
      await apiRequest('/api/reviews', { method: 'POST', body: JSON.stringify({ target_type: item.target_type, target_id: item.target_id, action, reason, payload }) })
      notify(`${sentence(type)} review recorded`, 'success')
      setReasons(current => ({ ...current, [item.id]: '' }))
      setMergeTargets(current => ({ ...current, [item.id]: '' }))
      setPage(1); reviews.reload()
    } catch (reasonError) {
      setErrors(current => ({ ...current, [item.id]: reasonError instanceof Error ? reasonError.message : 'Review could not be saved' }))
    } finally { setBusy('') }
  }

  return <Page title="Review queue" eyebrow="Human decisions">{reviews.loading && !reviews.data ? <StatePanel state="loading" /> : reviews.error ? <StatePanel state="error" message={reviews.error} onRetry={reviews.reload} /> : !reviews.data?.items.length ? <StatePanel state="empty" title="No reviews awaiting a decision" message="Ambiguous identities, pending observations and event-independence checks appear here." /> : <><div className="review-list">{reviews.data.items.map(item => {
    const type = item.review_type ?? item.target_type
    const pending = item.state === 'pending'
    const acceptAction = type === 'identity' ? 'merge' : type === 'independence' ? 'confirm_independence' : 'accept'
    const allowed = item.allowed_actions ?? [acceptAction, 'reject']
    const acceptLabel = type === 'identity' ? 'Merge identity' : type === 'independence' ? 'Confirm independence' : `Accept ${type}`
    return <article className="review-card" key={item.id}><header><div><p className="eyebrow">{sentence(type)} review</p><h2>{item.headline ?? `${sentence(item.target_type)} ${item.target_id}`}</h2></div><Status value={item.state ?? 'not_recorded'} /></header>{item.actor && <AuditLine actor={item.actor} date={item.created_at} reason={item.reason} />}{pending && <form noValidate onSubmit={event => { event.preventDefault(); if (allowed.includes(acceptAction)) decide(item, 'accept') }}><FormError message={errors[item.id] ?? ''} />{type === 'identity' && <EntityCandidateSearch reviewId={item.id} selected={mergeTargets[item.id] ?? ''} onSelect={id => { setMergeTargets(current => ({ ...current, [item.id]: id })); setErrors(current => ({ ...current, [item.id]: '' })) }} />}<TextAreaField id={`reason-${item.id}`} label="Reason" value={reasons[item.id] ?? ''} onChange={event => { setReasons(current => ({ ...current, [item.id]: event.target.value })); setErrors(current => ({ ...current, [item.id]: '' })) }} rows={3} hint="This reason becomes part of the audit trail. A later decision can correct this review without removing history." /><div className="form-actions">{allowed.includes('reject') && <Button type="button" intent="danger" onClick={() => decide(item, 'reject')} busy={busy === item.id}>{`Reject ${type}`}</Button>}{allowed.includes('withdraw') && <Button type="button" intent="danger" onClick={() => decide(item, 'withdraw')} busy={busy === item.id}>Withdraw source record</Button>}{allowed.includes(acceptAction) && <Button type="submit" intent="success" emphasis="solid" busy={busy === item.id}>{acceptLabel}</Button>}</div></form>}</article>
  })}</div><Pagination page={reviews.data?.page ?? page} pageSize={reviews.data?.page_size ?? 25} total={reviews.data?.total ?? 0} onPage={setPage} /></>}</Page>
}
