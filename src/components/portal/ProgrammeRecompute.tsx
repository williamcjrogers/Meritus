"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ProgrammeRecompute({ programmeId }: { programmeId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  async function recompute() {
    setPending(true);
    setError(null);
    setProgress("Recomputing…");
    try {
      const res = await fetch(`/api/portal/programmes/${programmeId}/report?recompute=1`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        progress?: { stage: string; percent: number };
      };
      if (!res.ok) {
        setError(data.error ?? "Recompute failed");
        setProgress(null);
        return;
      }
      setProgress(data.progress ? `${data.progress.stage} (${data.progress.percent}%)` : "complete");
      router.refresh();
    } catch {
      setError("Recompute failed. Try again.");
      setProgress(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" className="app-button app-button--secondary" onClick={() => void recompute()} disabled={pending}>
        {pending ? "Recomputing…" : "Recompute report"}
      </button>
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
