"use client";

import { useState } from "react";
import Link from "next/link";
import type { SourceSettings } from "@/lib/db/research-workflow";
import { date } from "./ResearchControls";
import { SourceConfiguration } from "./SourceConfiguration";

const descriptions: Record<string, string> = {
  "find-case-law": "Published judgments and tribunal decisions for legal research.",
  "companies-house": "Company records, officers and filings for a company you choose.",
  "find-a-tender": "Public procurement notices, including opportunities and contract awards.",
  "contracts-finder": "Public contract opportunities and awards published on Contracts Finder.",
  "payment-practices": "Company reports on how quickly they pay their suppliers.",
  gazette: "Published insolvency notices for the notice types you choose.",
  "building-safety": "Building Safety Regulator publications and reported application statistics.",
  publications: "A selected publisher's report, news item or other public document.",
  "research-import": "Research records imported from a CSV or JSON file.",
  "commercial-import": "Records imported from a licensed commercial dataset.",
  "court-listings": "Court hearing information from an authorised file import.",
  bailii: "Legal material from an authorised file import.",
};

export function sourceState(source: SourceSettings) {
  const missingSelection =
    (source.provider === "companies-house" && !source.selection.companyNumber) ||
    (source.provider === "gazette" &&
      (!Array.isArray(source.selection.noticeTypes) || !source.selection.noticeTypes.length));
  if (source.configurationError || missingSelection || source.status === "unavailable")
    return { group: "attention", label: "Needs attention", colour: "bg-amber-50 text-amber-950 border-amber-200" };
  if (source.status === "paused")
    return { group: "paused", label: "Paused", colour: "bg-stone text-ink border-ink/20" };
  if (source.status === "ready")
    return { group: "ready", label: source.lastSuccessAt ? "Enabled" : "Ready to collect", colour: "bg-green/10 text-green border-green/20" };
  return { group: "attention", label: "Needs attention", colour: "bg-amber-50 text-amber-950 border-amber-200" };
}

function nextStep(source: SourceSettings) {
  if (source.provider === "companies-house" && !source.selection.companyNumber)
    return "Choose the company to collect records for in Settings.";
  if (source.provider === "gazette" && (!Array.isArray(source.selection.noticeTypes) || !source.selection.noticeTypes.length))
    return "Choose the types of insolvency notice to collect in Settings.";
  if (source.configurationError) return source.configurationError;
  if (source.status === "paused") return "Collection is paused. Open Settings to enable this source.";
  if (source.status !== "ready") return "Open Settings to review why this source is unavailable.";
  if (["research-import", "commercial-import", "court-listings", "bailii"].includes(source.provider))
    return "Use Import a file to add records from this source and start an investigation.";
  return source.lastSuccessAt ? "Available to use in your research." : "Enabled, but no successful collection has been recorded yet.";
}

export function SourceOverview({ sources, save, busy = false }: {
  sources: SourceSettings[];
  save: (path: string, body: unknown, method?: string) => Promise<unknown>;
  busy?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const counts = sources.reduce((result, source) => {
    result[sourceState(source).group]++;
    return result;
  }, { ready: 0, attention: 0, paused: 0 } as Record<string, number>);
  const shown = sources.filter(source =>
    (filter === "all" || sourceState(source).group === filter) &&
    `${source.label} ${descriptions[source.provider] ?? ""}`.toLowerCase().includes(query.toLowerCase()),
  ).sort((a, b) => {
    const rank: Record<string, number> = { attention: 0, ready: 1, paused: 2 };
    return rank[sourceState(a).group] - rank[sourceState(b).group] || a.label.localeCompare(b.label);
  });
  return (
    <section aria-labelledby="source-overview-title" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="source-overview-title" className="font-serif text-2xl">Your research sources</h2>
          <p className="mt-2 text-sm text-ink/70">{sources.length} sources · {counts.ready} enabled · {counts.attention} need attention · {counts.paused} paused</p>
        </div>
        <Link href="/portal/research" className="rounded bg-green px-4 py-2.5 text-sm font-medium text-cream">Open your research desk →</Link>
      </div>
      <p className="max-w-3xl text-sm leading-relaxed text-ink/75">Your research desk automatically uses relevant material collected from these sources. Use Import a file to add your own files or licensed datasets.</p>
      <details className="rounded border border-ink/15 bg-white/30 px-4 py-3">
        <summary className="cursor-pointer text-sm">Find or filter sources</summary>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <label className="flex-1 text-sm font-medium">Find a source
          <input type="search" disabled={busy} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by name or information type" className="mt-1 block w-full rounded border border-ink/25 bg-white p-3 font-normal" />
        </label>
        <label className="text-sm font-medium sm:w-56">Show
          <select disabled={busy} value={filter} onChange={event => setFilter(event.target.value)} className="mt-1 block w-full rounded border border-ink/25 bg-white p-3 font-normal">
            <option value="all">All sources</option><option value="attention">Needs attention</option><option value="ready">Enabled sources</option><option value="paused">Paused sources</option>
          </select>
        </label>
      </div>
      </details>
      <div className="overflow-hidden rounded-lg border border-ink/15 bg-white/60">
        {!shown.length && <p role="status" className="p-6 text-ink/70">{sources.length ? "No sources match these filters." : "No sources have been added yet. Use Add a source to register one."}</p>}
        {shown.map(source => {
          const state = sourceState(source);
          const open = selected === source.id;
          return (
            <article key={source.id} className="border-b border-ink/10 last:border-b-0">
              <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_13rem_auto] lg:items-start">
                <div className="min-w-0">
                  <h3 className="font-medium text-green">{source.label}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink/75">{descriptions[source.provider] ?? "Information registered for use in your research."}</p>
                  <p className={`mt-3 text-sm ${state.group === "attention" ? "text-amber-950" : "text-ink/70"}`}>{nextStep(source)}</p>
                </div>
                <div className="space-y-2">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${state.colour}`}>{state.label}</span>
                  <p className="text-xs leading-relaxed text-ink/70">{source.lastSuccessAt ? `Last collected ${date(source.lastSuccessAt)}` : "No collection recorded"}</p>
                </div>
                <button type="button" disabled={busy} aria-label={`Settings for ${source.label}`} aria-expanded={open} aria-controls={`source-settings-${source.id}`} onClick={() => setSelected(open ? null : source.id)} className="min-h-11 rounded border border-ink/25 px-4 py-2 text-sm font-medium hover:bg-green/5 disabled:opacity-50">{open ? "Close settings" : "Settings"}</button>
              </div>
              {open && <div id={`source-settings-${source.id}`} className="border-t border-ink/10 bg-white/40 p-5"><SourceConfiguration source={source} save={save} /></div>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
