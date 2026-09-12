"use client";

import { UserButton } from "@clerk/nextjs";

export const CLERK_APPEARANCE = {
  variables: { colorPrimary: "var(--primary)", colorBackground: "var(--surface)", colorText: "var(--text)", borderRadius: "var(--radius-control)", fontFamily: "var(--font-sans)" },
  elements: { userButtonAvatarBox: "h-9 w-9", userButtonTrigger: "min-h-11 min-w-11" },
} as const;

/** Provider-owned account menu includes sign-out and account management. */
export function DirectorMenu({ name, compact = false }: { name: string | null; initials: string | null; compact?: boolean }) {
  return <div className="flex min-w-0 items-center gap-3"><UserButton appearance={CLERK_APPEARANCE} />{!compact && <div className="min-w-0"><p className="truncate text-[15px] font-medium text-text">{name ?? "Your account"}</p><p className="text-[13px] text-muted">Account and sign out</p></div>}</div>;
}
