import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from './Ui'

interface Props { committed: string; onCommit: (value: string) => void; loading?: boolean; id?: string; label?: string; hint?: string; embedded?: boolean; disabled?: boolean }
export function SearchField({ committed, onCommit, loading, id = 'watchlist-search', label = 'Search watchlist', hint, embedded = false, disabled }: Props) {
  const [value, setValue] = useState(committed)
  const [composing, setComposing] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => setValue(committed), [committed])
  useEffect(() => {
    if (composing || value === committed) return
    const timer = window.setTimeout(() => onCommit(value.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [committed, composing, onCommit, value])
  const submit = (event: FormEvent) => { event.preventDefault(); if (!composing) onCommit(value.trim()) }
  const content = <><label htmlFor={id}>{label}</label><div className="search-control"><input ref={input} id={id} type="search" value={value} disabled={disabled} onChange={event => setValue(event.target.value)} onCompositionStart={() => setComposing(true)} onCompositionEnd={event => { setComposing(false); setValue(event.currentTarget.value) }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (!composing && !event.nativeEvent.isComposing) onCommit(value.trim()) } }} aria-busy={loading || undefined} aria-describedby={hint ? `${id}-hint` : undefined} />{loading && <span className="search-progress" aria-label="Searching" />}{value && <Button type="button" emphasis="ghost" disabled={disabled} onClick={() => { setValue(''); onCommit(''); input.current?.focus() }} aria-label={id === 'watchlist-search' ? 'Clear search' : `Clear ${label.toLowerCase()}`}>×</Button>}</div>{hint && <p className="field-hint" id={`${id}-hint`}>{hint}</p>}</>
  return embedded ? <div className="search" role="search" aria-label={`${label} controls`}>{content}</div> : <form className="search" role="search" noValidate onSubmit={submit}>{content}</form>
}
