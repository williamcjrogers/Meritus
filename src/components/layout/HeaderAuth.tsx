"use client";

import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { isClerkPublishable } from "@/lib/env";

export function HeaderAuth({ darkChrome }: { darkChrome: boolean }) {
  const linkClass = darkChrome
    ? "text-[12px] font-medium tracking-wide text-green/70 hover:text-green transition-colors duration-300"
    : "text-[12px] font-medium tracking-wide text-cream/80 hover:text-cream transition-colors duration-300";

  if (!isClerkPublishable()) {
    return (
      <Link href="/sign-in" className={linkClass}>
        Login
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <SignedOut>
        <Link href="/sign-in" className={linkClass}>
          Login
        </Link>
      </SignedOut>
      <SignedIn>
        <Link href="/portal" className={linkClass}>
          Portal
        </Link>
        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-7 w-7",
            },
          }}
        />
      </SignedIn>
    </div>
  );
}
