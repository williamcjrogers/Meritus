"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { PURSUIT_STAGES, type PursuitStage } from "@/lib/db/schema";
import { requiresReason, stageLabel } from "@/lib/portal/stages";
import type { ActionResult } from "@/lib/portal/types";

export type MoveHandler = (
  to: PursuitStage,
  reason?: string,
  revisitDue?: string
) => Promise<ActionResult> | ActionResult;

/**
 * "Move to" button and menu. Active stages move at once; Declined and Dormant
 * ask for a reason inline, and Dormant also offers a revisit date.
 */
export function MoveToMenu({
  current,
  onMove,
  align = "right",
  label = "Move to",
  className = "",
  buttonClassName = "btn-secondary",
}: {
  current: PursuitStage;
  onMove: MoveHandler;
  align?: "left" | "right";
  label?: string;
  className?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<PursuitStage | null>(null);
  const [reason, setReason] = useState("");
  const [revisitDue, setRevisitDue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  const options = PURSUIT_STAGES.filter((stage) => stage !== current);

  function close(returnFocus = true) {
    setOpen(false);
    setPending(null);
    setReason("");
    setRevisitDue("");
    setError(null);
    if (returnFocus) buttonRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    function onDocumentClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) close(false);
    }
    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, [open]);

  useEffect(() => {
    if (open && !pending) itemRefs.current[0]?.focus();
  }, [open, pending]);

  async function commit(to: PursuitStage, withReason?: string, withDue?: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await onMove(to, withReason, withDue || undefined);
      if (result.ok) {
        close();
      } else {
        setError(result.error);
      }
    } finally {
      setBusy(false);
    }
  }

  function choose(to: PursuitStage) {
    if (requiresReason(to)) {
      setPending(to);
      return;
    }
    void commit(to);
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (pending) return;
    const items = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
    const index = items.findIndex((item) => item === document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus();
    }
  }

  const reasonOk = reason.trim().length >= 3;

  return (
    <div
      ref={rootRef}
      className={`relative inline-block ${className}`}
      onBlur={(event) => {
        if (open && !rootRef.current?.contains(event.relatedTarget as Node | null)) close(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={buttonClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {label}
        <span aria-hidden="true" className="text-[10px]">
          ▾
        </span>
      </button>
      {open && (
        <div
          id={menuId}
          role={pending ? "dialog" : "menu"}
          aria-label={pending ? `Move to ${stageLabel(pending)}` : label}
          onKeyDown={onMenuKeyDown}
          className={`absolute z-30 mt-1 min-w-[220px] border border-green/15 bg-parchment p-1 shadow-[0_8px_24px_rgba(11,59,36,0.16)] ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {!pending ? (
            options.map((stage, index) => (
              <button
                key={stage}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                disabled={busy}
                onClick={() => choose(stage)}
                className="block w-full px-3 py-2 text-left text-[13px] text-green hover:bg-stone/60 focus:bg-stone/60 focus:outline-none disabled:opacity-40"
              >
                {stageLabel(stage)}
                {requiresReason(stage) && <span className="ml-2 font-mono text-[9px] tracking-[0.15em] uppercase text-ink/60">reason</span>}
              </button>
            ))
          ) : (
            <form
              className="space-y-3 p-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (reasonOk) void commit(pending, reason.trim(), revisitDue);
              }}
            >
              <p className="font-serif text-lg text-green">Move to {stageLabel(pending)}</p>
              <label className="block">
                <span className="portal-label">Reason</span>
                <input
                  autoFocus
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="portal-field"
                  placeholder="At least three characters"
                  aria-label="Reason"
                />
              </label>
              {pending === "dormant" && (
                <label className="block">
                  <span className="portal-label">Revisit on (optional)</span>
                  <input
                    type="date"
                    value={revisitDue}
                    onChange={(event) => setRevisitDue(event.target.value)}
                    className="portal-field"
                    aria-label="Revisit date"
                  />
                </label>
              )}
              {error && <p className="text-[12px] text-oxblood">{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-quiet" onClick={() => setPending(null)} disabled={busy}>
                  Back
                </button>
                <button type="submit" className="btn-secondary" disabled={!reasonOk || busy}>
                  {busy ? "Moving…" : "Confirm"}
                </button>
              </div>
            </form>
          )}
          {!pending && error && <p className="px-3 py-2 text-[12px] text-oxblood">{error}</p>}
        </div>
      )}
    </div>
  );
}
