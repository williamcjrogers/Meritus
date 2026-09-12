"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CLIENT_ALLOWED_LABEL, MAX_CLIENT_UPLOAD_LABEL } from "@/lib/client-uploads/rules";
import { browserTransport } from "@/lib/client/transport";
import { uploadFile } from "@/lib/client/upload";
import { formatBytes } from "@/lib/portal/files";

type Row = {
  key: string;
  file: File;
  progress: number;
  status: "queued" | "uploading" | "done" | "error";
  error: string | null;
};

const STORE_PREFIX = "meritus-upload:";

function fingerprint(file: File): string {
  return `${STORE_PREFIX}${file.name}:${file.size}:${file.lastModified}`;
}

function readSession(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, id: string | null): void {
  try {
    if (id) window.localStorage.setItem(key, id);
    else window.localStorage.removeItem(key);
  } catch {
    // Storage may be unavailable; the upload still works, it just cannot resume.
  }
}

export function ClientUploadDesk() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  function patch(key: string, changes: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...changes } : row)));
  }

  async function run(queue: Row[]) {
    setBusy(true);
    for (const row of queue) {
      patch(row.key, { status: "uploading", error: null });
      try {
        await uploadFile(row.file, browserTransport, {
          resumeId: readSession(row.key),
          onSession: (id) => writeSession(row.key, id),
          onProgress: (fraction) => patch(row.key, { progress: fraction }),
        });
        writeSession(row.key, null);
        patch(row.key, { status: "done", progress: 1 });
        router.refresh();
      } catch (error) {
        patch(row.key, { status: "error", error: error instanceof Error ? error.message : "Upload failed" });
      }
    }
    setBusy(false);
  }

  function onSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    const queue: Row[] = files.map((file) => ({ key: fingerprint(file), file, progress: 0, status: "queued", error: null }));
    setRows((current) => [...current.filter((row) => !queue.some((q) => q.key === row.key)), ...queue]);
    void run(queue);
  }

  function retry(row: Row) {
    void run([row]);
  }

  return (
    <div>
      <label className="btn-brass cursor-pointer text-[12px] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-green has-[:focus-visible]:outline-offset-2">
        <input type="file" multiple className="sr-only" onChange={onSelect} disabled={busy} />
        {busy ? "Uploading…" : "Choose files"}
      </label>
      <p className="mt-3 font-mono text-[10px] tracking-[0.08em] text-ink/70">
        {CLIENT_ALLOWED_LABEL} · up to {MAX_CLIENT_UPLOAD_LABEL} each. Large files resume if the connection drops: choose the same file again.
      </p>
      {rows.length > 0 ? (
        <ul className="mt-5 divide-y divide-green/10" aria-live="polite">
          {rows.map((row) => (
            <li key={row.key} className="py-3 text-[13px]">
              <div className="flex items-center justify-between gap-4">
                <span className="min-w-0 truncate text-green">{row.file.name}</span>
                <span className="font-mono text-[10px] tracking-[0.12em] text-ink/70">
                  {formatBytes(row.file.size)} ·{" "}
                  {row.status === "done" ? "received" : row.status === "error" ? "failed" : `${Math.round(row.progress * 100)}%`}
                </span>
              </div>
              <div className="mt-2 h-1 w-full bg-green/10" aria-hidden="true">
                <div className="h-1 bg-brass" style={{ width: `${Math.round(row.progress * 100)}%` }} />
              </div>
              {row.status === "error" ? (
                <p className="mt-2 text-[12px] text-oxblood">
                  {row.error}{" "}
                  <button type="button" className="btn-quiet ml-2" onClick={() => retry(row)} disabled={busy}>
                    Try again
                  </button>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
