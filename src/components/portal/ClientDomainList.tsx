"use client";

import { useState, useTransition } from "react";
import type { ClientDomain } from "@/lib/db/schema";
import { linkClientDomainAction, removeClientDomainAction } from "@/lib/portal/client-actions";
import { fullDate, shortDate } from "@/lib/portal/dates";
import { formatBytes } from "@/lib/portal/files";

export type PursuitOption = { id: string; firm: string; stage: string };
export type ClientFileSummary = { id: string; title: string; size: number; createdAt: Date; uploaderEmail: string | null };

export function ClientDomainList({
  domains,
  pursuits,
  files,
}: {
  domains: ClientDomain[];
  pursuits: PursuitOption[];
  files: Record<string, ClientFileSummary[]>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (domains.length === 0) {
    return <p className="text-[14px] text-ink/70">No client domains yet. Add one above and the firm can start sending files.</p>;
  }

  function act(work: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await work();
      setError(result.ok ? null : (result.error ?? "Something went wrong"));
    });
  }

  return (
    <div className="space-y-6">
      {error ? <p className="text-[12px] text-oxblood">{error}</p> : null}
      {domains.map((row) => {
        const rowFiles = files[row.id] ?? [];
        return (
          <article key={row.id} className="border border-green/10 bg-parchment p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="font-serif text-xl text-green">{row.firm}</h3>
                <p className="font-mono text-[10px] tracking-[0.12em] text-ink/70">@{row.domain} · added {fullDate(row.createdAt)}</p>
              </div>
              <div className="flex items-center gap-4">
                <label className="text-[12px] text-ink/70">
                  <span className="portal-label">Pursuit</span>
                  <select
                    className="portal-field"
                    value={row.pursuitId ?? ""}
                    disabled={pending}
                    onChange={(event) => {
                      const value = event.target.value;
                      act(() => linkClientDomainAction(row.id, value ? value : null));
                    }}
                  >
                    <option value="">Not linked</option>
                    {pursuits.map((pursuit) => (
                      <option key={pursuit.id} value={pursuit.id}>
                        {pursuit.firm} · {pursuit.stage}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn-quiet text-[12px] hover:text-oxblood"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm(`Remove @${row.domain}? People there can no longer request links. Files already sent stay.`)) {
                      act(() => removeClientDomainAction(row.id));
                    }
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
            {rowFiles.length === 0 ? (
              <p className="mt-4 text-[13px] text-ink/70">Nothing sent yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-green/10">
                {rowFiles.map((file) => (
                  <li key={file.id} className="flex items-center justify-between gap-4 py-2 text-[13px]">
                    <a href={`/api/portal/documents/${file.id}`} className="min-w-0 truncate text-green hover:text-brass">
                      {file.title}
                    </a>
                    <span className="font-mono text-[10px] tracking-[0.12em] text-ink/70">
                      {formatBytes(file.size)} · {shortDate(file.createdAt)}
                      {file.uploaderEmail ? ` · ${file.uploaderEmail}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        );
      })}
    </div>
  );
}
