"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
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
  const inFlight = useRef(false);

  function patch(key: string, changes: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...changes } : row)));
  }

  async function run(queue: Row[]) {
    if (inFlight.current) return;
    inFlight.current = true;
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
        const message = error instanceof Error ? error.message : "";
        const safeMessages = ["The connection dropped while uploading", "The file is empty", "That file type is not accepted", `Files are limited to ${MAX_CLIENT_UPLOAD_LABEL}`, "We could not verify your access. Please try again."];
        patch(row.key, { status: "error", error: safeMessages.includes(message) ? message : "We could not confirm receipt. Check your connection and try again." });
      }
    }
    inFlight.current = false;
    setBusy(false);
  }

  function onSelect(event: React.ChangeEvent<HTMLInputElement>) {
    if (inFlight.current) return;
    const files = Array.from(event.target.files ?? []).filter((file, index, all) => all.findIndex(other => fingerprint(other) === fingerprint(file)) === index);
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
      <label className="app-button client-upload-picker" aria-disabled={busy}>
        <input type="file" multiple className="sr-only" onChange={onSelect} disabled={busy} aria-describedby="client-upload-help" />
        Choose files
      </label>
      <p id="client-upload-help" className="client-file-meta">
        {CLIENT_ALLOWED_LABEL}, up to {MAX_CLIENT_UPLOAD_LABEL} each. If the connection drops, choose the same file again to resume.
      </p>
      {busy ? <p role="status" className="app-status">Sending your documents. Keep this page open until receipt is confirmed.</p> : null}
      {rows.length > 0 ? <ul className="client-file-list" aria-live="polite">
        {rows.map(row => <li key={row.key} className="client-upload-row">
          <div className="client-file">
            <strong className="client-file-name">{row.file.name}</strong>
            <span className="client-file-meta">{formatBytes(row.file.size)}. {row.status === "done" ? "Received" : row.status === "error" ? "Failed" : row.status === "queued" ? "Queued" : row.progress >= 1 ? "Confirming receipt…" : `Uploading ${Math.round(row.progress * 100)}%`}</span>
          </div>
          {row.status === "uploading" ? <progress aria-label={`Upload progress for ${row.file.name}`} max={1} value={row.progress} /> : null}
          {row.status === "error" ? <div className="app-status app-status--error" role="alert">
            <p>{row.error}</p><button type="button" className="app-button app-button--secondary" onClick={() => retry(row)} disabled={busy}>Try again</button>
          </div> : null}
        </li>)}
      </ul> : null}
    </div>
  );
}
