import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Entity } from '../types'
import { apiRequest } from '../api'
import { Button, FormError, TextAreaField, TextField } from './Ui'
import { useToast } from './Toast'

export function EntityReviewEditor({ entity, onSaved }: { entity: Entity; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(entity.name)
  const [identifier, setIdentifier] = useState(entity.identifier ?? '')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const notify = useToast()
  const unresolved = entity.key.startsWith('unresolved:')
  const start = () => { setName(entity.name); setIdentifier(entity.identifier ?? ''); setReason(''); setError(''); setEditing(true) }
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    if (!name.trim()) { setError('Enter the entity name.'); document.getElementById('review-entity-name')?.focus(); return }
    if (!reason.trim()) { setError('Give a review reason for this correction.'); document.getElementById('entity-review-reason')?.focus(); return }
    const changes: Record<string, string> = {}
    if (name.trim() !== entity.name) changes.name = name.trim()
    if (!unresolved && identifier.trim() !== (entity.identifier ?? '')) changes.identifier = identifier.trim()
    if (!Object.keys(changes).length) { setError('Change the name or identifier before saving a correction.'); return }
    setBusy(true)
    try {
      await apiRequest('/api/reviews', { method: 'POST', body: JSON.stringify({ target_type: 'entity', target_id: entity.id, action: 'update', reason: reason.trim(), payload: { changes } }) })
      notify('Entity correction recorded in the audit trail', 'success'); setEditing(false); onSaved()
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The correction could not be saved.') } finally { setBusy(false) }
  }
  return <section className="list-panel"><h2>Reviewed entity details</h2>{editing ? <form onSubmit={submit} noValidate className="form-panel"><FormError message={error} /><TextField id="review-entity-name" label="Entity name" value={name} onChange={event => setName(event.target.value)} required /><TextField id="review-entity-scheme" label="Identifier scheme" value={entity.scheme ?? 'No scheme recorded'} readOnly /><TextField id="review-entity-identifier" label="Identifier" value={identifier} onChange={event => setIdentifier(event.target.value)} disabled={unresolved} hint={unresolved ? 'Resolve this identity by merging it into a confirmed entity in the review queue.' : 'Corrections must still identify the same canonical entity. A different registered identifier requires an identity merge.'} /><p><Link to="/reviews">Open identity review queue</Link></p><TextAreaField id="entity-review-reason" label="Review reason" value={reason} onChange={event => setReason(event.target.value)} required rows={3} /><div className="form-actions"><Button type="submit" intent="brand" emphasis="solid" busy={busy}>Save reviewed correction</Button><Button type="button" disabled={busy} onClick={() => setEditing(false)}>Cancel correction</Button></div></form> : <><p>{entity.name} · {entity.scheme ?? 'No identifier scheme'} · {entity.identifier ?? 'No identifier recorded'}</p><Button type="button" onClick={start}>Edit entity details</Button></>}</section>
}
