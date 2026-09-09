"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: ReactNode;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="portal-dialog portal-confirm"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <div className="panel-brackets bg-parchment border border-green/10 p-6 text-ink">
        <h2 className="font-serif text-2xl text-green">{title}</h2>
        {body && <div className="mt-3 text-[14px] leading-relaxed text-ink/70">{body}</div>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="btn-quiet" disabled={pending}>
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`btn-secondary ${danger ? "btn-danger" : ""}`}
            disabled={pending}
          >
            {pending ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
