"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MAX_CLIENT_UPLOAD_LABEL, type ClientFileSummary } from "@/lib/client/files";
import { shortDate } from "@/lib/portal/dates";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DumpZone({
  files,
  storageReady,
}: {
  files: ClientFileSummary[];
  storageReady: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function dumpFiles(list: FileList | File[]) {
    const chosen = Array.from(list);
    if (chosen.length === 0) return;
    if (!storageReady) {
      setError("Storage is not connected yet");
      return;
    }
    setPending(true);
    setError(null);
    try {
      for (const file of chosen) {
        await dumpOne(file);
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <label
        className={`block cursor-pointer border border-dashed px-6 py-10 text-center ${
          dragging ? "border-brass bg-brass/5" : "border-green/20 bg-parchment"
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void dumpFiles(event.dataTransfer.files);
        }}
      >
        <input
          type="file"
          className="sr-only"
          multiple
          disabled={pending || !storageReady}
          onChange={(event) => {
            const list = event.target.files;
            event.target.value = "";
            if (list) void dumpFiles(list);
          }}
        />
        <p className="font-serif text-2xl text-green">
          {pending ? "Sending…" : storageReady ? "Drop files here" : "Storage is not connected yet"}
        </p>
        <p className="mt-2 text-[13px] text-ink/70">
          pdf, docx, xlsx, zip, images, eml, msg · up to {MAX_CLIENT_UPLOAD_LABEL} each
        </p>
      </label>
      {error ? <p className="mt-3 text-[12px] text-oxblood">{error}</p> : null}

      <ul className="mt-6 divide-y divide-green/10">
        {files.map((file) => (
          <li key={file.id} className="flex items-center justify-between gap-4 py-3 text-[13px]">
            <div className="min-w-0">
              <a href={`/api/client/files/${file.id}`} className="block truncate text-green hover:text-brass">
                {file.title}
              </a>
              <p className="font-mono text-[10px] tracking-[0.12em] text-ink/70">
                {formatSize(file.size)} · {shortDate(file.createdAt)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  setError(null);
                  const res = await fetch(`/api/client/files/${file.id}`, { method: "DELETE" });
                  if (!res.ok) {
                    const data = (await res.json().catch(() => ({}))) as { error?: string };
                    setError(data.error ?? "Delete failed");
                    return;
                  }
                  router.refresh();
                })();
              }}
              className="font-mono text-[9px] tracking-[0.15em] uppercase text-ink/70 hover:text-oxblood"
            >
              Delete
            </button>
          </li>
        ))}
        {files.length === 0 ? <li className="py-3 text-[13px] text-ink/70">No files yet.</li> : null}
      </ul>
    </div>
  );
}

async function dumpOne(file: File): Promise<void> {
  const prepare = await fetch("/api/client/files/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, mime: file.type, size: file.size }),
  });
  const prepared = (await prepare.json().catch(() => ({}))) as {
    error?: string;
    id?: string;
    upload?: { url: string; method: "PUT"; headers: Record<string, string> };
  };
  if (!prepare.ok || !prepared.id || !prepared.upload) {
    throw new Error(prepared.error ?? "Could not start the upload");
  }

  const put = await fetch(prepared.upload.url, {
    method: prepared.upload.method,
    headers: prepared.upload.headers,
    body: file,
  });
  if (!put.ok) {
    throw new Error("Could not store the file");
  }

  const complete = await fetch("/api/client/files/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: prepared.id }),
  });
  const done = (await complete.json().catch(() => ({}))) as { error?: string };
  if (!complete.ok) {
    throw new Error(done.error ?? "Could not finish the upload");
  }
}
