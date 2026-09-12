"use client";

import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import { isClerkPublishable } from "@/lib/env";

export function MobileAuth({ onNavigate }: { onNavigate: () => void }) {
  const className = "text-xl text-cream/70 tracking-wide hover:text-brass transition-colors duration-200";

  if (!isClerkPublishable()) {
    return (
      <Link href="/sign-in" onClick={onNavigate} className={className}>
        Staff sign in
      </Link>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <Show
        when="signed-in"
        fallback={
          <Link href="/sign-in" onClick={onNavigate} className={className}>
            Staff sign in
          </Link>
        }
      >
        <Link href="/account" onClick={onNavigate} className={className}>
          Account
        </Link>
        <UserButton />
      </Show>
    </div>
  );
}
