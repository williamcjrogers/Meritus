"use client";

import { useState, useTransition } from "react";
import type { ClientDomain } from "@/lib/db/schema";
import { removeClientDomain } from "@/lib/portal/client-actions";
import { fullDate } from "@/lib/portal/dates";

export function ClientDomainList({ domains }: { domains: ClientDomain[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (domains.length === 0) {
    return <p className="text-[14px] text-ink/70">No company domains have been added yet.</p>;
  }

  return (
    <div>
      <div className="overflow-x-auto border border-green/10 bg-parchment">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-green/10 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
              <th className="px-4 py-3 font-normal">Domain</th>
              <th className="px-4 py-3 font-normal">Workspace</th>
              <th className="px-4 py-3 font-normal">Added</th>
              <th className="px-4 py-3 font-normal">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {domains.map((row) => (
              <tr key={row.id} className="border-b border-green/5 last:border-0">
                <td className="px-4 py-3 text-green">@{row.domain}</td>
                <td className="px-4 py-3 text-ink/70">
                  {row.vericaseWorkspaceName || row.vericaseWorkspaceId || "Unnamed"}
                </td>
                <td className="px-4 py-3 text-ink/70">{fullDate(row.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className="font-mono text-[9px] tracking-[0.15em] uppercase text-ink/70 hover:text-oxblood"
                    disabled={pending && pendingId === row.id}
                    onClick={() => {
                      setPendingId(row.id);
                      startTransition(async () => {
                        const result = await removeClientDomain(row.id);
                        setError(result.ok ? null : result.error);
                        setPendingId(null);
                      });
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error ? <p className="mt-3 text-[12px] text-oxblood">{error}</p> : null}
    </div>
  );
}
