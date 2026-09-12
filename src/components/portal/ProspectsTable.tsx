"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SearchField } from "@/components/ui/Field";
import type { Prospect } from "@/lib/db/schema";
import {
  conflictTierLabel,
  evidenceLabel,
  outreachLabel,
} from "@/lib/prospects/model";

function conflictClass(tier: Prospect["conflictTier"]): string {
  switch (tier) {
    case "hard_conflict":
      return "text-danger";
    case "latent_conflict":
      return "text-primary";
    case "competitor":
    case "related_party":
    case "excluded":
    case "other":
      return "text-muted";
    default: {
      const exhaustive: never = tier;
      return exhaustive;
    }
  }
}

export function ProspectsTable({ rows }: { rows: Prospect[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => {
      const haystack = [
        row.organisation,
        row.organisationType ?? "",
        row.whyTheyNeedYou ?? "",
        row.routeInNote ?? "",
        conflictTierLabel(row.conflictTier),
        outreachLabel(row.outreachStatus),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [query, rows]);

  return (
    <div className="space-y-4">
      <div className="max-w-md"><SearchField label="Search this list" value={query} onChange={event => setQuery(event.target.value)} onClear={() => setQuery("")} placeholder="Organisation, type, or note" /></div>

      <div className="overflow-x-auto border border-line bg-surface">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-line font-sans text-[13px]   text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Rank</th>
              <th className="px-4 py-3 font-medium">Organisation</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Conflict</th>
              <th className="px-4 py-3 font-medium">Score</th>
              <th className="px-4 py-3 font-medium">Evidence</th>
              <th className="px-4 py-3 font-medium">Outreach</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-muted">
                  No matching prospects.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="border-t border-line hover:bg-mist/40">
                  <td className="px-4 py-3 font-sans text-[13px] text-muted">{row.rank ?? "Not recorded"}</td>
                  <td className="px-4 py-3">
                    <Link href={`/portal/prospects/${row.id}`} className="text-primary hover:text-primary">
                      {row.organisation}
                    </Link>
                  </td>
                  <td className="max-w-[16rem] px-4 py-3 text-muted">
                    <span className="line-clamp-2">{row.organisationType ?? "Not recorded"}</span>
                  </td>
                  <td className={`px-4 py-3 ${conflictClass(row.conflictTier)}`}>
                    {conflictTierLabel(row.conflictTier)}
                  </td>
                  <td className="px-4 py-3 font-sans text-[13px] text-primary">
                    {row.valueScore ?? "Not recorded"}
                  </td>
                  <td className="px-4 py-3 text-muted">{evidenceLabel(row.evidence)}</td>
                  <td className="px-4 py-3 text-muted">{outreachLabel(row.outreachStatus)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[13px] text-muted">
        {filtered.length} of {rows.length} shown.
      </p>
    </div>
  );
}
