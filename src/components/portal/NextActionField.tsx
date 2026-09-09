"use client";

import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { dueLabel } from "@/lib/portal/dates";
import type { ActionResult } from "@/lib/portal/types";

export const NEXT_ACTION_MAX = 140;

/**
 * The next action and its due date, edited in place. Click to edit; Enter or
 * leaving the editor saves; Escape puts the original back.
 */
export function NextActionField({
  text,
  due,
  overdue = false,
  onSave,
}: {
  text: string | null;
  due: string | null;
  overdue?: boolean;
  onSave: (text: string, due: string | null) => Promise<ActionResult> | ActionResult;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text ?? "");
  const [draftDue, setDraftDue] = useState(due ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function open() {
    setDraft(text ?? "");
    setDraftDue(due ?? "");
    setError(null);
    cancelled.current = false;
    setEditing(true);
  }

  function close() {
    setEditing(false);
    setError(null);
    triggerRef.current?.focus();
  }

  function cancel() {
    cancelled.current = true;
    close();
  }

  async function save() {
    if (busy || cancelled.current) return;
    const nextText = draft.trim();
    const nextDue = nextText && draftDue ? draftDue : null;
    if (nextText === (text ?? "") && nextDue === (due ?? null)) {
      close();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await onSave(nextText, nextDue);
      if (result.ok) close();
      else setError(result.error);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong, try again");
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  }

  function onBlur(event: FocusEvent<HTMLFormElement>) {
    const next = event.relatedTarget as Node | null;
    if (next && formRef.current?.contains(next)) return;
    if (!editing || cancelled.current) return;
    void save();
  }

  if (!editing) {
    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={open}
        className="group flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-transparent py-1 text-left hover:border-brass/40"
      >
        <span className="portal-label mb-0 shrink-0">Next action</span>
        <span className="sr-only">{text ? "Edit next action:" : "Set a next action:"}</span>
        {text ? (
          <span className={`text-[14px] ${overdue ? "text-oxblood" : "text-green"}`}>
            {overdue && (
              <span aria-hidden="true" className="mr-2 text-[9px]">
                ●
              </span>
            )}
            {text}
          </span>
        ) : (
          <span className="text-[14px] text-ink/70">Set a next action</span>
        )}
        {text && due && (
          <span className={`font-mono text-[11px] tracking-[0.05em] ${overdue ? "text-oxblood" : "text-ink/70"}`}>
            {overdue ? "overdue" : `due ${dueLabel(due)}`}
          </span>
        )}
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <label className="block flex-1">
        <span className="portal-label">Next action</span>
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={NEXT_ACTION_MAX}
          placeholder="What happens next"
          aria-label="Next action"
          className="portal-field"
          disabled={busy}
        />
      </label>
      <label className="block sm:w-44">
        <span className="portal-label">Due</span>
        <input
          type="date"
          value={draftDue}
          onChange={(event) => setDraftDue(event.target.value)}
          aria-label="Due"
          className="portal-field"
          disabled={busy}
        />
      </label>
      <div className="flex items-center gap-2 pb-1">
        <span className="font-mono text-[10px] tracking-[0.05em] text-ink/60">
          {draft.length}/{NEXT_ACTION_MAX}
        </span>
        <button type="button" className="btn-quiet" onClick={cancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="btn-secondary" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
      {error && <p className="w-full text-[12px] text-oxblood sm:basis-full">{error}</p>}
    </form>
  );
}
