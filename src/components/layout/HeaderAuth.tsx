"use client";

import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import { isClerkPublishable } from "@/lib/env";

export function HeaderAuth({ darkChrome }: { darkChrome: boolean }) {
  const linkClass = darkChrome
    ? "text-[12px] font-medium tracking-wide text-green/70 hover:text-green transition-colors duration-300"
    : "text-[12px] font-medium tracking-wide text-cream/80 hover:text-cream transition-colors duration-300";

  if (!isClerkPublishable()) {
    return (
      <Link href="/sign-in" className={linkClass}>
        Staff sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <Show
        when="signed-in"
        fallback={
          <Link href="/sign-in" className={linkClass}>
            Staff sign in
          </Link>
        }
      >
        <Link href="/account" className={linkClass}>
          Account
        </Link>
        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-7 w-7",
            },
          }}
        />
      </Show>
    </div>
  );
}
