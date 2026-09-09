"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPursuit } from "@/lib/portal/actions";
import type { PursuitFormInput } from "@/lib/portal/types";
import { PursuitForm } from "./PursuitForm";
import { SlideOver } from "./SlideOver";

export function NewPursuitButton({ className = "btn-brass text-[12px]" }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function submit(input: PursuitFormInput) {
    const result = await createPursuit(input);
    if (result.ok) {
      setOpen(false);
      router.push(`/portal/pursuits/${result.id}`);
    }
    return result;
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        New pursuit
      </button>
      <SlideOver open={open} onClose={() => setOpen(false)} eyebrow="Pursuit" title="New pursuit">
        <PursuitForm mode="create" onSubmit={submit} onCancel={() => setOpen(false)} />
      </SlideOver>
    </>
  );
}
