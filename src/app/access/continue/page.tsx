import Link from "next/link";
import { Suspense } from "react";
import { AccessContinue } from "@/components/access/AccessContinue";
import { AccessShell } from "@/components/access/AccessShell";
import { isClerkConfigured } from "@/lib/env";
export const metadata = { title: "Open client documents", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export const dynamic = "force-dynamic";
export default function AccessContinuePage() {
  return <AccessShell title="Open client documents">
    {isClerkConfigured() ? <Suspense fallback={<p role="status">Checking your link…</p>}><AccessContinue /></Suspense> : <>
      <p className="app-status">We cannot open your documents at the moment. Please try again shortly.</p>
      <Link href="/access" className="app-button">Request a new link</Link>
    </>}
  </AccessShell>;
}
