"use client";

import { useState, type KeyboardEvent } from "react";
import type { ActionResult } from "@/lib/portal/types";

export const NOTE_MAX = 4_000;

export function NoteBox({ onSave }: { onSave: (body: string) => Promise<ActionResult> | ActionResult }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await onSave(text);
      if (result.ok) setBody("");
      else setError(result.error);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong, try again");
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void save();
    }
  }

  return (
    <form noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="space-y-2"
    >
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={onKeyDown}
        rows={3}
        maxLength={NOTE_MAX}
        aria-label="Add a note"
        placeholder="Add a note. Cmd or Ctrl and Enter saves."
        className="app-field resize-none border border-line px-3 py-2"
        disabled={busy}
      />
      <div className="flex items-center justify-between gap-3">
        {error ? <p role="alert" className="text-[13px] text-danger">{error}</p> : <span className="font-sans text-[13px] text-muted">{body.length}/{NOTE_MAX}</span>}
        <button type="submit" className="app-button app-button--secondary" disabled={busy || !body.trim()}>
          {busy ? "Saving…" : "Add note"}
        </button>
      </div>
    </form>
  );
}
