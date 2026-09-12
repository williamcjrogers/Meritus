"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { shortDate } from "@/lib/portal/dates";
import { MAX_UPLOAD_LABEL, type DocumentSummary } from "@/lib/portal/files";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileList({ documents, uploadUrl }: { documents: DocumentSummary[]; uploadUrl: string }) {
  const router = useRouter();
  const notify = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState<DocumentSummary | null>(null);
  async function onUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || pending) return;
    setPending(true); setError(null);
    const form = new FormData(); form.append("file", file);
    try {
      const res = await fetch(uploadUrl, { method: "POST", body: form });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { setError(data.error ?? "The file could not be uploaded. Select it again to retry."); return; }
      notify("File uploaded"); router.refresh();
    } catch { setError("The upload could not finish. Check your connection and select the file again to retry."); }
    finally { setPending(false); input.value = ""; }
  }
  async function onDelete() {
    if (!deleting || pending) return;
    setPending(true); setError(null);
    try {
      const res = await fetch(`/api/portal/documents/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) { const data = await res.json().catch(() => ({})) as { error?: string }; setError(data.error ?? "The file could not be deleted. Try again."); return; }
      setDeleting(null); notify("File deleted"); router.refresh();
    } catch { setError("The file could not be deleted. Check your connection and try again."); }
    finally { setPending(false); }
  }
  return <div>
    <div className="flex flex-wrap items-center gap-3"><label className="app-button app-button--secondary cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-offset-2"><input type="file" className="sr-only" onChange={onUpload} disabled={pending} />{pending && !deleting ? "Uploading…" : "Upload file"}</label><span className="text-[13px] text-muted">PDF, DOCX, XLSX, images, TXT, EML, MSG. Up to {MAX_UPLOAD_LABEL}.</span></div>
    {error && !deleting && <p role="alert" className="app-status app-status--error mt-4">{error}</p>}
    <ul className="mt-4 divide-y divide-line">{documents.map(doc => <li key={doc.id} className="flex items-center justify-between gap-4 py-4"><div className="min-w-0"><a href={`/api/portal/documents/${doc.id}`} className="block break-words text-[15px] font-medium text-primary hover:underline">{doc.title}</a><p className="mt-1 text-[13px] text-muted">{formatSize(doc.size)} · {shortDate(doc.createdAt)} · {doc.hasText ? "Readable text available" : "No readable text"}</p></div><button type="button" className="app-button app-button--ghost shrink-0" disabled={pending} onClick={() => { setError(null); setDeleting(doc); }} aria-label={`Delete ${doc.title}`}>Delete</button></li>)}{documents.length === 0 && <li className="py-6 text-muted">No documents yet. Upload a file to add it here.</li>}</ul>
    <ConfirmDialog open={deleting !== null} title={`Delete ${deleting?.title ?? "this file"}?`} body={<><p>This removes the document from this workspace. This cannot be undone.</p>{error && <p role="alert" className="mt-3 text-danger">{error}</p>}</>} confirmLabel="Delete file" danger pending={pending} onCancel={() => setDeleting(null)} onConfirm={() => void onDelete()} />
  </div>;
}
