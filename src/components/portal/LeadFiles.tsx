"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DocumentRow } from "@/lib/db/schema";

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
    const data = (await res.json()) as { error?: string };
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
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Delete failed");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <label className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-brass cursor-pointer">
        <input type="file" className="sr-only" onChange={onUpload} disabled={pending} />
        {pending ? "Uploading…" : "Upload file"}
      </label>
      {error && <p className="mt-2 text-[12px] text-oxblood">{error}</p>}
      <ul className="mt-4 space-y-3">
        {documents.map((doc) => (
          <li key={doc.id} className="flex items-center justify-between gap-4 text-[13px]">
            <a
              href={`/api/portal/documents/${doc.id}`}
              className="text-green hover:text-brass truncate"
            >
              {doc.title}
            </a>
            <button
              type="button"
              onClick={() => onDelete(doc.id)}
              className="font-mono text-[9px] tracking-[0.15em] uppercase text-slate hover:text-oxblood"
            >
              Delete
            </button>
          </li>
        ))}
        {documents.length === 0 && <li className="text-slate text-[13px]">No files yet.</li>}
      </ul>
    </div>
  );
}
