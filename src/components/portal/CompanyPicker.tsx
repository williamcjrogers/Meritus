"use client";

import { useRef, useState } from "react";
import { SearchField } from "@/components/ui/Field";
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
  const sequence = useRef(0);
  const [term, setTerm] = useState(query);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [hits, setHits] = useState<CompanyCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);

  async function search() {
    const q = term.trim();
    if (!q || searching) return;
    const current = ++sequence.current;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`${endpoint}?q=${encodeURIComponent(q)}`);
      const data = (await res.json().catch(() => ({}))) as { candidates?: CompanyCandidate[]; error?: string };
      if (current !== sequence.current) return;
      if (!res.ok) {
        setError(data.error ?? "Companies House is not responding");
        setHits([]);
      } else {
        setHits(data.candidates ?? []);
      }
      setSearched(true);
    } catch {
      if (current === sequence.current) setError("Companies House is not responding");
    } finally {
      if (current === sequence.current) setSearching(false);
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
      <form noValidate
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <div className="flex-1"><SearchField label="Company name" value={term} onChange={event => { sequence.current++; setTerm(event.target.value); setSearching(false); setSearched(false); setHits([]); }} onClear={() => { sequence.current++; setTerm(""); setHits([]); setSearching(false); setSearched(false); setError(null); }} placeholder="As registered" /></div>
        <button type="submit" className="app-button app-button--secondary shrink-0" disabled={searching || !term.trim()}>
          {searching ? "Searching…" : "Find on Companies House"}
        </button>
      </form>
      {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
      {hits.length > 0 && <CandidateList candidates={hits} picking={picking} onPick={pick} />}
      {searched && !error && hits.length === 0 && (
        <p className="text-[13px] text-muted">No companies found for that name.</p>
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
    <ul aria-label="Companies House candidates" className="divide-y divide-line border border-line">
      {candidates.map((candidate) => (
        <li key={candidate.number} className="flex items-center justify-between gap-4 px-3 py-2 text-[13px]">
          <div className="min-w-0">
            <p className="truncate text-primary">{candidate.title}</p>
            <p className="font-sans text-[13px]  text-muted">
              {[candidate.number, candidate.status, candidate.address].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button
            type="button"
            className="app-button app-button--ghost shrink-0"
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
