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
      <span className="portal-eyebrow">Outreach</span>
      <select
        defaultValue={prospect.outreachStatus}
        onChange={(event) => onChange(event.target.value as ProspectOutreach)}
        disabled={pending}
        className="mt-2 w-full border-0 border-b border-green/15 bg-transparent py-2 text-[14px] text-green focus:border-brass focus:outline-none disabled:opacity-50"
      >
        {PROSPECT_OUTREACH_STATUSES.map((status) => (
          <option key={status} value={status}>
            {outreachLabel(status)}
          </option>
        ))}
      </select>
      {error ? <p className="mt-2 text-[12px] text-oxblood">{error}</p> : null}
    </label>
  );
}
