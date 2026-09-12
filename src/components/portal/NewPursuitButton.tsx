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
  const [formKey, setFormKey] = useState(0);

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
      <button type="button" className={className} onClick={() => { setFormKey((key) => key + 1); setOpen(true); }}>
        New live lead
      </button>
      <SlideOver open={open} onClose={() => setOpen(false)} eyebrow="Live lead" title="New live lead">
        <PursuitForm key={formKey} mode="create" onSubmit={submit} onCancel={() => setOpen(false)} />
      </SlideOver>
    </>
  );
}
