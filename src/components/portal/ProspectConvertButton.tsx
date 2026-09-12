"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Prospect } from "@/lib/db/schema";
import { openProspectAsPursuit } from "@/lib/portal/prospect-actions";

export function ProspectConvertButton({ prospect }: { prospect: Prospect }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (prospect.convertedPursuitId) {
    return (
      <Link href={`/portal/pursuits/${prospect.convertedPursuitId}`} className="btn-outline text-[13px]">
        View live lead
      </Link>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const result = await openProspectAsPursuit(prospect.id);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.push(`/portal/pursuits/${result.id}`);
          });
        }}
        className="app-button text-[13px] disabled:opacity-40"
      >
        {pending ? "Opening…" : "Convert to live lead"}
      </button>
      {error ? <p className="text-[13px] text-danger">{error}</p> : null}
    </div>
  );
}
