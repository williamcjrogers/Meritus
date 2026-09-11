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
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block">
        <span className="portal-eyebrow">Director notes</span>
        <textarea
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setSaved(false);
          }}
          rows={5}
          className="mt-2 w-full border border-green/15 bg-transparent px-3 py-2 text-[14px] text-green focus:border-brass focus:outline-none"
        />
      </label>
      <button type="submit" disabled={pending} className="btn-outline text-[13px] disabled:opacity-40">
        {pending ? "Saving…" : "Save notes"}
      </button>
      {saved ? <p className="text-[12px] text-ink/70">Saved.</p> : null}
      {error ? <p className="text-[12px] text-oxblood">{error}</p> : null}
    </form>
  );
}
