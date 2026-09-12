"use client";
import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import { isClerkPublishable } from "@/lib/env";
export function HeaderAuth({ darkChrome: _darkChrome }: { darkChrome: boolean }) {
  void _darkChrome; // Public header retains this compatibility prop; semantic colours own contrast.
  const signIn = <Link href="/sign-in" className="header-auth-link">Staff sign in</Link>;
  if (!isClerkPublishable()) return signIn;
  return <div className="header-auth-actions"><Show when="signed-in" fallback={signIn}>
    <Link href="/account" className="header-auth-link">Account</Link>
    <UserButton />
  </Show></div>;
}
