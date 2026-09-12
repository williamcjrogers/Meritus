import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { formatDateTime, sentence } from '../format'
import { applicationPath } from '../runtime'

export function Page({ title, eyebrow, actions, children }: { title: string; eyebrow?: string; actions?: ReactNode; children: ReactNode }) {
  return <main className="page" id="main-content"><header className="page-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1></div>{actions && <div className="page-actions">{actions}</div>}</header>{children}</main>
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { intent?: 'brand' | 'neutral' | 'success' | 'warning' | 'danger'; emphasis?: 'solid' | 'outline' | 'ghost'; busy?: boolean }
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ intent = 'neutral', emphasis = 'outline', busy = false, children, disabled, ...props }, ref) {
  return <button {...props} ref={ref} className={`button button-${intent} button-${emphasis} ${props.className ?? ''}`} disabled={disabled || busy} aria-busy={busy || undefined}><span className={busy ? 'button-label busy' : 'button-label'}>{children}</span><span className="button-spinner" aria-hidden="true" /></button>
})

interface BaseField { label: string; error?: string; hint?: string }
function FieldFrame({ id, label, error, hint, children }: BaseField & { id: string; children: ReactNode }) {
  const described = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  return <div className="field"><label htmlFor={id}>{label}</label>{children}{hint && <p className="field-hint" id={`${id}-hint`}>{hint}</p>}{error && <p className="field-error" id={`${id}-error`}>{error}</p>}<span className="sr-only" data-described={described} /></div>
}
export const TextField = forwardRef<HTMLInputElement, BaseField & InputHTMLAttributes<HTMLInputElement> & { id: string }>(function TextField({ label, error, hint, id, ...props }, ref) {
  const described = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  return <FieldFrame id={id} label={label} error={error} hint={hint}><input {...props} ref={ref} id={id} aria-invalid={Boolean(error)} aria-describedby={described} /></FieldFrame>
})
export const TextAreaField = forwardRef<HTMLTextAreaElement, BaseField & TextareaHTMLAttributes<HTMLTextAreaElement> & { id: string }>(function TextAreaField({ label, error, hint, id, ...props }, ref) {
  const described = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  return <FieldFrame id={id} label={label} error={error} hint={hint}><textarea {...props} ref={ref} id={id} className={`resize-none ${props.className ?? ''}`} aria-invalid={Boolean(error)} aria-describedby={described} /></FieldFrame>
})
export function SelectField({ label, error, hint, id, children, ...props }: BaseField & SelectHTMLAttributes<HTMLSelectElement> & { id: string }) {
  const described = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  return <FieldFrame id={id} label={label} error={error} hint={hint}><select {...props} id={id} aria-invalid={Boolean(error)} aria-describedby={described}>{children}</select></FieldFrame>
}

export function FormError({ message }: { message: string }) { return message ? <div className="form-error" role="alert">{message}</div> : null }
export function Status({ value, tone }: { value: string; tone?: 'success' | 'warning' | 'error' | 'info' }) { return <span className={`status status-${tone ?? statusTone(value)}`}><span aria-hidden="true" className="status-dot" />{sentence(value)}</span> }
const statusTones: Record<string, 'success' | 'warning' | 'error' | 'info'> = {
  active: 'success', complete: 'success', completed: 'success', confirmed: 'success', current: 'success', enabled: 'success', passed: 'success', success: 'success', verified: 'success',
  blocked: 'warning', incomplete: 'warning', needs_credentials: 'warning', needs_permission: 'warning', never_run: 'warning', partial: 'warning', pending: 'warning', provisional: 'warning', queued: 'warning', unconfirmed: 'warning',
  error: 'error', failed: 'error', rejected: 'error', withdrawn: 'error',
  disabled: 'info', inactive: 'info', unknown: 'info', unassigned: 'info',
}
function statusTone(value: string) { return statusTones[value.trim().toLowerCase().replace(/[\s-]+/g, '_')] ?? 'info' }

export function DependencyState({ label, loading, error, onRetry }: { label: string; loading: boolean; error: string; onRetry: () => void }) {
  if (loading) return <div className="dependency-state" role="status" aria-busy="true">Loading {label}…</div>
  if (error) return <div className="dependency-state dependency-error" role="alert"><span>{label} could not be loaded: {error}</span><Button type="button" onClick={onRetry}>Retry</Button></div>
  return null
}

export function StatePanel({ state, title, message, onRetry, action }: { state: 'loading' | 'empty' | 'no-results' | 'error'; title?: string; message?: string; onRetry?: () => void; action?: ReactNode }) {
  const copy = state === 'loading' ? ['Loading records', 'Meritus is requesting current data from the local API.'] : state === 'error' ? [title ?? 'Records could not be loaded', message ?? 'Check the API and try again.'] : state === 'no-results' ? [title ?? 'No matching records', message ?? 'Change or clear the current filters.'] : [title ?? 'No records yet', message ?? 'There is no data to show here.']
  return <section className={`state-panel state-${state}`} aria-live="polite" aria-busy={state === 'loading'}><span className="state-mark" aria-hidden="true">{state === 'loading' ? '···' : state === 'error' ? '!' : '○'}</span><h2>{copy[0]}</h2><p>{copy[1]}</p>{state === 'error' && onRetry && <Button onClick={onRetry}>Retry</Button>}{action}</section>
}

export function EvidencePair({ source, event, age, title, href }: { source: string; event: string; age?: number | string | null; title: string; href?: string }) {
  const target = href?.startsWith('/') && !href.startsWith('//') ? applicationPath(href) : href
  return <div className="evidence-pair"><div className="evidence-meta"><span>{sentence(source)}</span><span>{sentence(event)}</span>{age != null && <span>{typeof age === 'number' ? `${age} days` : age}</span>}</div>{href ? <a href={target} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noreferrer' : undefined}>{title}</a> : <strong>{title}</strong>}</div>
}

export function DataAuthenticity({ truncated }: { truncated?: boolean }) { return truncated ? <div className="authenticity authenticity-partial" role="status"><strong>Partial coverage</strong><span>The API returned a bounded result set.</span></div> : null }
export function AuditLine({ actor, date, reason }: { actor?: string | null; date?: string | null; reason?: string | null }) { return <p className="audit-line"><span>{actor || 'No reviewer recorded'}</span><span>{formatDateTime(date)}</span>{reason && <span>{reason}</span>}</p> }
export function TableFrame({ label, range, children }: { label: string; range?: string; children: ReactNode }) { return <section className="table-frame" aria-label={label}><div className="table-scroll">{children}</div>{range && <footer className="table-footer">{range}</footer>}</section> }

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const from = total ? (page - 1) * pageSize + 1 : 0; const to = Math.min(page * pageSize, total); const last = Math.max(1, Math.ceil(total / pageSize))
  return <nav className="pagination" aria-label="Table pagination"><span>{from}–{to} of {total}</span><div><Button onClick={() => onPage(page - 1)} disabled={page <= 1}>Previous</Button><span aria-current="page">Page {page} of {last}</span><Button onClick={() => onPage(page + 1)} disabled={page >= last}>Next</Button></div></nav>
}
