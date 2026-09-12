"use client";
import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import { isClerkPublishable } from "@/lib/env";
export function MobileAuth({ onNavigate }: { onNavigate: () => void }) {
  const signIn = <Link href="/sign-in" onClick={onNavigate} className="mobile-auth-link">Staff sign in</Link>;
  if (!isClerkPublishable()) return signIn;
  return <div className="mobile-auth-actions"><Show when="signed-in" fallback={signIn}>
    <Link href="/account" onClick={onNavigate} className="mobile-auth-link">Account</Link>
    <UserButton />
  </Show></div>;
}
