"use client";

import { useRouter } from "next/navigation";
import type { Lead, LeadStatus } from "@/lib/db/schema";
import { LEAD_STATUSES, leadStatusLabel } from "@/lib/portal/status";

export function LeadStatusForm({ lead }: { lead: Lead }) {
  const router = useRouter();

  async function onChange(status: LeadStatus) {
    await fetch(`/api/portal/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  return (
    <label className="block">
      <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-slate/60">Status</span>
      <select
        defaultValue={lead.status}
        onChange={(e) => onChange(e.target.value as LeadStatus)}
        className="mt-2 w-full bg-transparent border-b border-green/15 py-2 text-[14px] text-green focus:outline-none focus:border-brass"
      >
        {LEAD_STATUSES.map((status) => (
          <option key={status} value={status}>
            {leadStatusLabel(status)}
          </option>
        ))}
      </select>
    </label>
  );
}
