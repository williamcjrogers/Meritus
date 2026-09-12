"use client";

import { useState, useTransition } from "react";
import type { Prospect } from "@/lib/db/schema";
import { saveProspectNotes } from "@/lib/portal/prospect-actions";

export function ProspectNotesForm({ prospect }: { prospect: Prospect }) {
  const [value, setValue] = useState(prospect.partnerNotes ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveProspectNotes(prospect.id, value);
      setSaved(result.ok);
      setError(result.ok ? null : result.error);
    });
  }

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-3">
      <label className="block">
        <span className="app-context">Notes</span>
        <textarea
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setSaved(false);
          }}
          rows={5}
          className="app-field resize-none mt-2"
        />
      </label>
      <button type="submit" disabled={pending} className="btn-outline text-[13px] disabled:opacity-40">
        {pending ? "Saving…" : "Save notes"}
      </button>
      {saved ? <p className="text-[13px] text-muted">Saved.</p> : null}
      {error ? <p className="text-[13px] text-danger">{error}</p> : null}
    </form>
  );
}
