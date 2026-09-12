import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

type Tone = 'success' | 'info' | 'warning' | 'error'
interface Toast { id: number; message: string; tone: Tone }
const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => undefined)
function ToastMessage({ item, onDismiss }: { item: Toast; onDismiss: (id: number) => void }) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const paused = hovered || focused
  useEffect(() => {
    if (paused || !['success', 'info'].includes(item.tone)) return
    const timer = window.setTimeout(() => onDismiss(item.id), 6_000)
    return () => window.clearTimeout(timer)
  }, [item.id, item.tone, onDismiss, paused])
  return <div className={`toast toast-${item.tone}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}><span>{item.message}</span><button type="button" onClick={() => onDismiss(item.id)} aria-label="Dismiss notification">×</button></div>
}
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)
  const notify = useCallback((message: string, tone: Tone = 'info') => { const id = ++nextId.current; setToasts(current => current.some(item => item.message === message) ? current : [...current.slice(-2), { id, message, tone }]) }, [])
  const dismiss = useCallback((id: number) => setToasts(current => current.filter(item => item.id !== id)), [])
  const value = useMemo(() => notify, [notify])
  return <ToastContext.Provider value={value}>{children}<div className="toast-viewport" aria-live="polite">{toasts.map(item => <ToastMessage key={item.id} item={item} onDismiss={dismiss} />)}</div></ToastContext.Provider>
}
export function useToast() { return useContext(ToastContext) }
