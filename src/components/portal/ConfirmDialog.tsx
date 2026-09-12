"use client";

import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { Button } from "@/components/ui/Button";

export function ConfirmDialog({ open, title, body, confirmLabel = "Confirm", cancelLabel = "Cancel", danger = false, pending = false, onConfirm, onCancel, returnFocusRef }: { open: boolean; title: ReactNode; body?: ReactNode; confirmLabel?: string; cancelLabel?: string; danger?: boolean; pending?: boolean; onConfirm: () => void; onCancel: () => void; returnFocusRef?: RefObject<HTMLElement | null> }) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) { dialog.showModal(); cancelRef.current?.focus(); }
    if (!open && dialog.open) { dialog.close(); returnFocusRef?.current?.focus(); }
  }, [open, returnFocusRef]);
  return <dialog ref={ref} aria-labelledby={titleId} aria-describedby={body ? bodyId : undefined} className="portal-dialog portal-confirm" onCancel={event => { event.preventDefault(); if (!pending) onCancel(); }}><div className="app-panel p-6"><h2 id={titleId} className="text-2xl font-medium">{title}</h2>{body && <div id={bodyId} className="mt-3 text-[15px] text-muted">{body}</div>}<div className="mt-6 flex justify-end gap-3"><button ref={cancelRef} type="button" onClick={onCancel} className="app-button app-button--secondary" disabled={pending}>{cancelLabel}</button><Button onClick={onConfirm} intent={danger ? "danger" : "brand"} busy={pending}>{confirmLabel}</Button></div></div></dialog>;
}
