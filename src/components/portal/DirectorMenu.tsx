"use client";

import { UserButton } from "@clerk/nextjs";
import { OwnerAvatar } from "./OwnerAvatar";

export const CLERK_APPEARANCE = {
  variables: {
    colorPrimary: "#B5975A",
    colorBackground: "#EDE7DB",
    borderRadius: "0px",
    fontFamily: "var(--font-inter)",
  },
  elements: {
    userButtonAvatarBox: "h-7 w-7",
    // Clerk's generated avatar is hidden; the director's initials in Meritus green sit over the trigger.
    userButtonAvatarImage: "opacity-0",
  },
} as const;

/** The signed-in director's name beside Clerk's user button, which keeps the menu and sign-out. */
export function DirectorMenu({
  name,
  initials,
  compact = false,
}: {
  name: string | null;
  initials: string | null;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {name && !compact && <span className="truncate text-[13px] text-cream/85">{name}</span>}
      <span className="relative inline-flex h-7 w-7 items-center justify-center">
        <UserButton appearance={CLERK_APPEARANCE} />
        {initials && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <OwnerAvatar initials={initials} name={name ?? undefined} size="md" current className="ring-offset-green" />
          </span>
        )}
      </span>
    </div>
  );
}
