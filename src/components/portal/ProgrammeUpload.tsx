"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { programmeAcceptAttribute, programmeUploadHint } from "@/lib/programme/files";
import type { ProgrammeListItem } from "@/lib/programme/view";

export function ProgrammeUpload({
  pursuitId,
  onUploaded,
}: {
  pursuitId?: string;
  onUploaded?: (item: ProgrammeListItem) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPending(true);
    setError(null);
    setProgress("Reading file…");
    const form = new FormData();
    form.append("file", file);
    if (pursuitId) form.append("pursuitId", pursuitId);
    let res: Response;
    try {
      setProgress("Ingesting and analysing…");
      res = await fetch("/api/portal/programmes", { method: "POST", body: form });
    } catch {
      setPending(false);
      setProgress(null);
      setError("Upload failed. Check the connection and try again.");
      event.target.value = "";
      return;
    }
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      issues?: { title: string; detail: string }[];
      programme?: ProgrammeListItem;
      progress?: { stage: string; percent: number };
    };
    setPending(false);
    event.target.value = "";
    if (!res.ok) {
      setProgress(null);
      setError(data.error ?? "Upload failed");
      return;
    }
    const issueLine = data.issues?.[0] ? `${data.issues[0].title}: ${data.issues[0].detail}` : null;
    setProgress(data.progress ? `${data.progress.stage} (${data.progress.percent}%)` : "complete (100%)");
    if (data.error || issueLine) setError(data.error ?? issueLine);
    else setError(null);
    if (data.programme) onUploaded?.(data.programme);
    router.refresh();
  }

  return (
    <div>
      <label className="app-button app-button--secondary cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary has-[:focus-visible]:outline-offset-2">
        <input
          type="file"
          accept={programmeAcceptAttribute()}
          className="sr-only"
          onChange={(event) => void onUpload(event)}
          disabled={pending}
        />
        {pending ? "Working…" : "Upload programme"}
      </label>
      <span className="ml-3 font-sans text-[13px]  text-muted">{programmeUploadHint()}</span>
      {progress && (
        <p className="mt-2 text-[13px] text-muted" role="status">
          {progress}
        </p>
      )}
      {error && (
        <p className="mt-2 text-[13px] text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
