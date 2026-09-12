"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Scope } from "@/lib/portal/board";

export const SCOPE_COOKIE = "desk_scope";

export function MineAllToggle({ scope }: { scope: Scope }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Scope) {
    if (next === scope) return;
    document.cookie = `${SCOPE_COOKIE}=${next}; path=/portal; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  const base = "px-3 py-1 font-sans text-[13px]   transition-colors";
  return (
    <div role="group" aria-label="Show pursuits" className={`inline-flex border border-line ${pending ? "opacity-60" : ""}`}>
      <button type="button" aria-pressed={scope === "mine"} onClick={() => choose("mine")} className={`${base} ${scope === "mine" ? "bg-primary text-surface" : "text-primary hover:bg-mist/60"}`}>
        Mine
      </button>
      <button type="button" aria-pressed={scope === "all"} onClick={() => choose("all")} className={`${base} ${scope === "all" ? "bg-primary text-surface" : "text-primary hover:bg-mist/60"}`}>
        All
      </button>
    </div>
  );
}
