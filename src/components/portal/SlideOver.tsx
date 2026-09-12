"use client";

import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
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
  returnFocusRef,
}: {
  open: boolean;
  title: ReactNode;
  eyebrow?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) { dialog.close(); returnFocusRef?.current?.focus(); }
  }, [open, returnFocusRef]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
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
      <div className="app-drawer-content">
        <header className="app-drawer-header">
          <div>
            {eyebrow && <Eyebrow rule={false}>{eyebrow}</Eyebrow>}
            <h2 id={titleId} className="mt-1 font-sans text-2xl text-primary">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="app-button app-button--ghost" aria-label="Close">
            Close
          </button>
        </header>
        <div className="app-drawer-body">{children}</div>
      </div>
    </dialog>
  );
}
