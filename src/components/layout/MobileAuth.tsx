"use client";

import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { isClerkPublishable } from "@/lib/env";

export function MobileAuth({ onNavigate }: { onNavigate: () => void }) {
  const className = "text-xl text-cream/70 tracking-wide hover:text-brass transition-colors duration-200";

  if (!isClerkPublishable()) {
    return (
      <Link href="/sign-in" onClick={onNavigate} className={className}>
        Login
      </Link>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <SignedOut>
        <Link href="/sign-in" onClick={onNavigate} className={className}>
          Login
        </Link>
      </SignedOut>
      <SignedIn>
        <Link href="/portal" onClick={onNavigate} className={className}>
          Portal
        </Link>
        <UserButton />
      </SignedIn>
    </div>
  );
}
