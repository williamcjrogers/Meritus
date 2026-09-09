"use client";

import { UserButton } from "@clerk/nextjs";

export const CLERK_APPEARANCE = {
  variables: {
    colorPrimary: "#B5975A",
    colorBackground: "#EDE7DB",
    borderRadius: "0px",
    fontFamily: "var(--font-inter)",
  },
  elements: {
    userButtonAvatarBox: "h-7 w-7 ring-1 ring-brass bg-green",
  },
} as const;

/** The signed-in director's name beside Clerk's user button. */
export function DirectorMenu({ name, compact = false }: { name: string | null; compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {name && !compact && <span className="truncate text-[13px] text-cream/85">{name}</span>}
      <UserButton appearance={CLERK_APPEARANCE} />
    </div>
  );
}
