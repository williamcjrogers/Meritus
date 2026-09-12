"use client";

import { useState, useTransition } from "react";
import type { Prospect, ProspectOutreach } from "@/lib/db/schema";
import { saveProspectOutreach } from "@/lib/portal/prospect-actions";
import { PROSPECT_OUTREACH_STATUSES, outreachLabel } from "@/lib/prospects/model";

export function ProspectStatusForm({ prospect }: { prospect: Prospect }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onChange(outreachStatus: ProspectOutreach) {
    startTransition(async () => {
      const result = await saveProspectOutreach(prospect.id, outreachStatus);
      setError(result.ok ? null : result.error);
    });
  }

  return (
    <label className="block">
      <span className="app-context">Outreach</span>
      <select
        defaultValue={prospect.outreachStatus}
        onChange={(event) => onChange(event.target.value as ProspectOutreach)}
        disabled={pending}
        className="mt-2 w-full border-0 border-b border-line bg-transparent py-2 text-[15px] text-primary focus:border-primary focus:outline-none disabled:opacity-50"
      >
        {PROSPECT_OUTREACH_STATUSES.map((status) => (
          <option key={status} value={status}>
            {outreachLabel(status)}
          </option>
        ))}
      </select>
      {error ? <p className="mt-2 text-[13px] text-danger">{error}</p> : null}
    </label>
  );
}
