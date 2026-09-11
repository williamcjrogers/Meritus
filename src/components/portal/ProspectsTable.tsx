"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Prospect } from "@/lib/db/schema";
import {
  conflictTierLabel,
  evidenceLabel,
  outreachLabel,
} from "@/lib/prospects/model";

function conflictClass(tier: Prospect["conflictTier"]): string {
  switch (tier) {
    case "hard_conflict":
      return "text-oxblood";
    case "latent_conflict":
      return "text-brass";
    case "competitor":
    case "related_party":
    case "excluded":
    case "other":
      return "text-ink/70";
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
      <label className="block max-w-md">
        <span className="portal-eyebrow">Search this list</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Organisation, type, or note"
          className="mt-2 w-full border-0 border-b border-green/15 bg-transparent py-2 text-[14px] text-green placeholder:text-slate/40 focus:border-brass focus:outline-none"
        />
      </label>

      <div className="overflow-x-auto border border-green/10 bg-parchment">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-green/10 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
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
                <td colSpan={7} className="px-4 py-8 text-ink/70">
                  No matching prospects.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="border-t border-green/10 hover:bg-stone/40">
                  <td className="px-4 py-3 font-mono text-[12px] text-ink/70">{row.rank ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Link href={`/portal/prospects/${row.id}`} className="text-green hover:text-brass">
                      {row.organisation}
                    </Link>
                  </td>
                  <td className="max-w-[16rem] px-4 py-3 text-ink/70">
                    <span className="line-clamp-2">{row.organisationType ?? "—"}</span>
                  </td>
                  <td className={`px-4 py-3 ${conflictClass(row.conflictTier)}`}>
                    {conflictTierLabel(row.conflictTier)}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-green">
                    {row.valueScore ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-ink/70">{evidenceLabel(row.evidence)}</td>
                  <td className="px-4 py-3 text-ink/70">{outreachLabel(row.outreachStatus)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-ink/70">
        {filtered.length} of {rows.length} shown.
      </p>
    </div>
  );
}
