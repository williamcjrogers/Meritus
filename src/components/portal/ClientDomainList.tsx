"use client";

import { ConfirmDialog } from "./ConfirmDialog";
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
  const [removing, setRemoving] = useState<ClientDomain | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (domains.length === 0) {
    return <p className="text-[15px] text-muted">No client domains yet. Add one above and the firm can start sending files.</p>;
  }

  function act(work: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      try {
        const result = await work();
        setError(result.ok ? null : (result.error ?? "The change could not be saved. Try again."));
        if (result.ok) setRemoving(null);
      } catch { setError("The change could not be saved. Try again."); }
    });
  }

  return (
    <div className="space-y-6">
      {error ? <p role="alert" className="app-status app-status--error">{error}</p> : null}
      <ConfirmDialog open={removing !== null} title={`Remove access for ${removing?.firm ?? "this organisation"}?`} body={<><p>People at @{removing?.domain} will no longer be able to request access links. Documents already received will remain.</p>{error && <p role="alert" className="mt-3 text-danger">{error}</p>}</>} confirmLabel="Remove access" danger pending={pending} onCancel={() => setRemoving(null)} onConfirm={() => { if (removing) act(() => removeClientDomainAction(removing.id)); }} />
      {domains.map((row) => {
        const rowFiles = files[row.id] ?? [];
        return (
          <article key={row.id} className="border border-line bg-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="font-sans text-xl text-primary">{row.firm}</h3>
                <p className="font-sans text-[13px]  text-muted">@{row.domain} · added {fullDate(row.createdAt)}</p>
              </div>
              <div className="flex items-center gap-4">
                <label className="text-[13px] text-muted">
                  <span className="app-label">Pursuit</span>
                  <select
                    className="app-field"
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
                  className="app-button app-button--ghost text-[13px] hover:text-danger"
                  disabled={pending}
                  onClick={() => { setError(null); setRemoving(row); }}
                >
                  Remove
                </button>
              </div>
            </div>
            {rowFiles.length === 0 ? (
              <p className="mt-4 text-[13px] text-muted">Nothing sent yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-line">
                {rowFiles.map((file) => (
                  <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-[15px]">
                    <a href={`/api/portal/documents/${file.id}`} className="min-w-0 truncate text-primary hover:text-primary">
                      {file.title}
                    </a>
                    <span className="font-sans text-[13px]  text-muted">
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
