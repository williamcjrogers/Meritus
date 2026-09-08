"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NewLeadForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/portal/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: form.get("companyName"),
        companyNumber: form.get("companyNumber"),
        contactName: form.get("contactName"),
        contactEmail: form.get("contactEmail"),
        source: form.get("source"),
      }),
    });
    const data = (await res.json()) as { lead?: { id: string }; error?: string };
    setPending(false);
    if (!res.ok || !data.lead) {
      setError(data.error ?? "Could not create lead");
      return;
    }
    router.push(`/portal/leads/${data.lead.id}`);
    router.refresh();
  }

  const field = "w-full px-0 py-2 bg-transparent border-0 border-b border-green/15 text-[14px] text-green focus:outline-none focus:border-brass";
  const label = "block font-mono text-[10px] tracking-[0.2em] uppercase text-slate/60 mb-1";

  return (
    <form id="new" onSubmit={onSubmit} className="bg-parchment border border-green/10 p-6 space-y-5">
      <h2 className="font-serif text-2xl text-green">New lead</h2>
      <div>
        <label className={label} htmlFor="companyName">Company</label>
        <input id="companyName" name="companyName" required className={field} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className={label} htmlFor="companyNumber">Company number</label>
          <input id="companyNumber" name="companyNumber" className={field} />
        </div>
        <div>
          <label className={label} htmlFor="source">Source</label>
          <input id="source" name="source" className={field} placeholder="Referral, intro, etc." />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className={label} htmlFor="contactName">Contact</label>
          <input id="contactName" name="contactName" className={field} />
        </div>
        <div>
          <label className={label} htmlFor="contactEmail">Email</label>
          <input id="contactEmail" name="contactEmail" type="email" className={field} />
        </div>
      </div>
      {error && <p className="text-[12px] text-oxblood">{error}</p>}
      <button type="submit" disabled={pending} className="btn-brass text-[13px] disabled:opacity-40">
        {pending ? "Saving…" : "Create lead"}
      </button>
    </form>
  );
}
