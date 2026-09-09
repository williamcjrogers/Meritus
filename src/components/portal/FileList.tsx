"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DocumentRow } from "@/lib/db/schema";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileList({
  documents,
  uploadUrl,
}: {
  documents: DocumentRow[];
  uploadUrl: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPending(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(uploadUrl, { method: "POST", body: form });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setPending(false);
    event.target.value = "";
    if (!res.ok) {
      setError(data.error ?? "Upload failed");
      return;
    }
    router.refresh();
  }

  async function onDelete(id: string) {
    setError(null);
    const res = await fetch(`/api/portal/documents/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Delete failed");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <label className="btn-outline text-[12px] cursor-pointer">
        <input type="file" className="sr-only" onChange={onUpload} disabled={pending} />
        {pending ? "Uploading…" : "Upload file"}
      </label>
      {error && <p className="mt-2 text-[12px] text-oxblood">{error}</p>}
      <ul className="mt-4 divide-y divide-green/10">
        {documents.map((doc) => (
          <li key={doc.id} className="flex items-center justify-between gap-4 py-3 text-[13px]">
            <div className="min-w-0">
              <a href={`/api/portal/documents/${doc.id}`} className="block truncate text-green hover:text-brass">
                {doc.title}
              </a>
              <p className="font-mono text-[10px] tracking-[0.12em] text-slate">
                {formatSize(doc.size)} · {doc.createdAt.toLocaleDateString("en-GB")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDelete(doc.id)}
              className="font-mono text-[9px] tracking-[0.15em] uppercase text-slate hover:text-oxblood"
            >
              Delete
            </button>
          </li>
        ))}
        {documents.length === 0 && <li className="py-3 text-[13px] text-slate">No files.</li>}
      </ul>
    </div>
  );
}
