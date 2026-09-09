"use client";

import { useState } from "react";
import type { CompanyCandidate } from "@/lib/db/schema";
import type { ActionResult } from "@/lib/portal/types";

export const COMPANIES_HOUSE_ENDPOINT = "/api/portal/companies-house";

/**
 * Search the register by name and store the chosen number on the pursuit.
 * The route returns up to five candidates; a 503 means the key is not set.
 */
export function CompanyPicker({
  query,
  onPick,
  endpoint = COMPANIES_HOUSE_ENDPOINT,
}: {
  query: string;
  onPick: (number: string) => Promise<ActionResult> | ActionResult;
  endpoint?: string;
}) {
  const [term, setTerm] = useState(query);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [hits, setHits] = useState<CompanyCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);

  async function search() {
    const q = term.trim();
    if (!q || searching) return;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`${endpoint}?q=${encodeURIComponent(q)}`);
      const data = (await res.json().catch(() => ({}))) as { candidates?: CompanyCandidate[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Companies House is not responding");
        setHits([]);
      } else {
        setHits(data.candidates ?? []);
      }
      setSearched(true);
    } catch {
      setError("Companies House is not responding");
    } finally {
      setSearching(false);
    }
  }

  async function pick(candidate: CompanyCandidate) {
    setPicking(candidate.number);
    setError(null);
    try {
      const result = await onPick(candidate.number);
      if (!result.ok) setError(result.error);
      else setHits([]);
    } finally {
      setPicking(null);
    }
  }

  return (
    <div className="space-y-3">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <label className="block flex-1">
          <span className="portal-label">Company name</span>
          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            className="portal-field"
            aria-label="Company name"
            placeholder="As registered"
          />
        </label>
        <button type="submit" className="btn-secondary shrink-0" disabled={searching || !term.trim()}>
          {searching ? "Searching…" : "Find on Companies House"}
        </button>
      </form>
      {error && <p className="text-[12px] text-oxblood">{error}</p>}
      {hits.length > 0 && <CandidateList candidates={hits} picking={picking} onPick={pick} />}
      {searched && !error && hits.length === 0 && (
        <p className="text-[12px] text-ink/70">No companies found for that name.</p>
      )}
    </div>
  );
}

/** Register hits with a Pick button each. Shared with the brief's unconfirmed-match state. */
export function CandidateList({
  candidates,
  picking,
  onPick,
}: {
  candidates: CompanyCandidate[];
  picking: string | null;
  onPick: (candidate: CompanyCandidate) => void | Promise<void>;
}) {
  return (
    <ul aria-label="Companies House candidates" className="divide-y divide-green/10 border border-green/10">
      {candidates.map((candidate) => (
        <li key={candidate.number} className="flex items-center justify-between gap-4 px-3 py-2 text-[13px]">
          <div className="min-w-0">
            <p className="truncate text-green">{candidate.title}</p>
            <p className="font-mono text-[10px] tracking-[0.08em] text-ink/70">
              {[candidate.number, candidate.status, candidate.address].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button
            type="button"
            className="btn-quiet shrink-0"
            aria-label={`Pick ${candidate.title}`}
            disabled={picking !== null}
            onClick={() => void onPick(candidate)}
          >
            {picking === candidate.number ? "Picking…" : "Pick"}
          </button>
        </li>
      ))}
    </ul>
  );
}
