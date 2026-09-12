import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../api'
import type { Entity, ListResponse } from '../types'
import { Button, SelectField, TextField } from './Ui'
import { SearchField } from './SearchField'
import { sentence } from '../format'

interface Props { id: string; label: string; value: string; onChange: (id: string) => void; entities: Entity[]; disabled?: boolean; error?: string; optional?: boolean }
export function EntityPicker({ id, label, value, onChange, entities, disabled, error, optional }: Props) {
  const [query, setQuery] = useState('')
  const [exact, setExact] = useState('')
  const [results, setResults] = useState<Entity[]>([])
  const [cache, setCache] = useState<Record<string, Entity>>({})
  const [loading, setLoading] = useState(false)
  const [failure, setFailure] = useState('')
  const sequence = useRef(0)
  const remember = (items: Entity[]) => setCache(current => ({ ...current, ...Object.fromEntries(items.map(item => [item.id, item])) }))
  useEffect(() => { remember(entities) }, [entities])
  useEffect(() => {
    const term = query.trim(); const current = ++sequence.current
    setFailure(''); setResults([])
    if (term.length < 2) { setLoading(false); return }
    const controller = new AbortController()
      setLoading(true)
      apiRequest<ListResponse<Entity>>(`/api/entities?q=${encodeURIComponent(term)}&page_size=25`, { signal: controller.signal })
        .then(data => { if (sequence.current === current) { setResults(data.items); remember(data.items) } })
        .catch(reason => { if (sequence.current === current && !(reason instanceof DOMException && reason.name === 'AbortError')) setFailure(reason instanceof Error ? reason.message : 'Entity search failed.') })
        .finally(() => { if (sequence.current === current) setLoading(false) })
    return () => controller.abort()
  }, [query])
  useEffect(() => {
    if (!value || cache[value] || entities.some(entity => entity.id === value)) return
    const controller = new AbortController()
    apiRequest<Entity>(`/api/entities/${encodeURIComponent(value)}`, { signal: controller.signal })
      .then(entity => remember([entity]))
      .catch(reason => { if (!(reason instanceof DOMException && reason.name === 'AbortError')) setFailure(reason instanceof Error ? reason.message : 'The selected entity could not be loaded.') })
    return () => controller.abort()
  }, [value, cache, entities])
  const useExact = async () => {
    if (!exact.trim()) { setFailure('Enter an exact entity ID.'); return }
    setLoading(true); setFailure('')
    try { const entity = await apiRequest<Entity>(`/api/entities/${encodeURIComponent(exact.trim())}`); remember([entity]); onChange(entity.id) }
    catch (reason) { setFailure(reason instanceof Error ? reason.message : 'The entity ID could not be resolved.') } finally { setLoading(false) }
  }
  const options = query.trim().length >= 2 ? results : entities
  const selected = value ? cache[value] ?? entities.find(item => item.id === value) : undefined
  const visible = selected && !options.some(item => item.id === value) ? [selected, ...options] : options
  return <div className="entity-picker"><SearchField id={`${id}-search`} label={`Search ${label.toLowerCase()}`} committed={query} onCommit={setQuery} loading={loading} disabled={disabled} embedded hint="Search across the full entity register by name or identifier. Up to 25 matches are shown; refine the search if needed." /><SelectField id={id} label={label} value={value} onChange={event => { const chosen = visible.find(item => item.id === event.target.value); if (chosen) remember([chosen]); onChange(event.target.value) }} error={error} disabled={disabled}><option value="">{optional ? 'No entity selected' : 'Select entity'}</option>{value && !visible.some(item => item.id === value) && <option value={value}>{value} (selected entity)</option>}{visible.map(entity => <option key={entity.id} value={entity.id}>{entity.name} ({sentence(entity.kind)}){entity.identifier ? ` · ${entity.identifier}` : ''}</option>)}</SelectField>{loading && <p role="status">Loading entity matches…</p>}{failure && <p role="alert" className="field-error">{failure}</p>}{query.trim().length >= 2 && !loading && !failure && !results.length && <p>No matching entities. Refine the search or use an exact ID.</p>}<details><summary>Use an exact entity ID</summary><TextField id={`${id}-exact`} label={`Exact ${label.toLowerCase()} ID`} value={exact} onChange={event => setExact(event.target.value)} disabled={disabled} /><Button type="button" onClick={useExact} disabled={disabled} busy={loading}>{`Use ${label.toLowerCase()} ID`}</Button></details></div>
}
