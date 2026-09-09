"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Eyebrow } from "./Eyebrow";

/**
 * Right-hand panel on a native dialog: focus is trapped, Escape closes, the
 * background is inert, and focus returns to the trigger when it closes.
 */
export function SlideOver({
  open,
  title,
  eyebrow,
  onClose,
  children,
  width = 480,
}: {
  open: boolean;
  title: ReactNode;
  eyebrow?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  width?: number;
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
      className="portal-dialog portal-drawer"
      style={{ ["--drawer-width" as string]: `${width}px` }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="flex h-full flex-col bg-parchment text-ink shadow-[-12px_0_32px_rgba(11,59,36,0.18)]">
        <header className="flex items-start justify-between gap-4 border-b border-green/10 px-6 py-5">
          <div>
            {eyebrow && <Eyebrow rule={false}>{eyebrow}</Eyebrow>}
            <h2 className="mt-1 font-serif text-2xl text-green">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="btn-quiet" aria-label="Close">
            Close
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
      </div>
    </dialog>
  );
}
