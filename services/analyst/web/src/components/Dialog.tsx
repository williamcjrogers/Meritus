import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button, FormError } from './Ui'

export function Dialog({ open, title, description, children, confirmLabel, onConfirm, onClose, busy, error }: { open: boolean; title: string; description: string; children?: ReactNode; confirmLabel: string; onConfirm: () => void; onClose: () => void; busy?: boolean; error?: string }) {
  const panel = useRef<HTMLDivElement>(null); const cancel = useRef<HTMLButtonElement>(null); const restore = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!open) return
    restore.current = document.activeElement as HTMLElement
    const app = document.getElementById('app-shell'); if (app) app.inert = true
    cancel.current?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) { event.preventDefault(); onClose() }
      if (event.key === 'Tab' && panel.current) {
        const nodes = Array.from(panel.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]'))
        if (!nodes.length) return
        const first = nodes[0]; const last = nodes[nodes.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.removeEventListener('keydown', keydown); if (app) app.inert = false; restore.current?.focus() }
  }, [busy, onClose, open])
  if (!open) return null
  return createPortal(<><div className="dialog-backdrop" /><div className="dialog" ref={panel} role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-description"><header><p className="eyebrow">Permission change</p><h2 id="dialog-title">{title}</h2><p id="dialog-description">{description}</p></header>{children}<FormError message={error ?? ''} /><footer><Button ref={cancel} type="button" onClick={onClose} disabled={busy}>Cancel</Button><Button type="button" intent="warning" emphasis="solid" onClick={onConfirm} busy={busy}>{confirmLabel}</Button></footer></div></>, document.body)
}
