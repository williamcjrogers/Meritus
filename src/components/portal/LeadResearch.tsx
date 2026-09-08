"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ResearchDossier, ResearchRun } from "@/lib/db/schema";

export function LeadResearch({
  leadId,
  research,
}: {
  leadId: string;
  research: ResearchRun | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(research?.error ?? null);
  const [pending, setPending] = useState(false);
  const dossier = (research?.dossierJson ?? null) as ResearchDossier | null;

  async function run() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/portal/leads/${leadId}/research`, { method: "POST" });
    const data = (await res.json()) as { error?: string };
    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "Research failed");
      return;
    }
    router.refresh();
  }

  return (
    <section className="bg-parchment border border-green/10 p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-serif text-2xl text-green">Research</h2>
        <button type="button" onClick={run} disabled={pending} className="btn-outline text-[12px] disabled:opacity-40">
          {pending ? "Running…" : "Research this company"}
        </button>
      </div>
      {error && <p className="mb-3 text-[12px] text-oxblood">{error}</p>}
      {dossier ? (
        <div className="space-y-3 text-[13px] text-green/90">
          <p className="leading-relaxed">{dossier.summary}</p>
          {dossier.newsAndRisks.length > 0 && (
            <ul className="list-disc pl-5 space-y-1">
              {dossier.newsAndRisks.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {dossier.sources.length > 0 && (
            <p className="text-[11px] text-slate">Sources: {dossier.sources.join("; ")}</p>
          )}
        </div>
      ) : (
        <p className="text-[13px] text-slate">No dossier yet. Run research to build one.</p>
      )}
    </section>
  );
}
