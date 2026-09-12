import { InvitationAcceptance } from "@/components/access/InvitationAcceptance";
import Link from "next/link";
import { AccessShell } from "@/components/access/AccessShell";
import { isClerkConfigured } from "@/lib/env";
export const metadata = { title: "Accept your invitation", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export const dynamic = "force-dynamic";
export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ __clerk_ticket?: string }> }) {
  const { __clerk_ticket: ticket } = await searchParams;
  // This route is not a public registration entry. Clerk must also enforce restricted sign-up.
  const invitationFlow = Boolean(ticket);
  return <AccessShell title="Accept your invitation">
    {!invitationFlow ? <>
      <p className="access-intro">Open the invitation in your email to finish setting up your Meritus account.</p>
      <Link href="/sign-in" className="app-button">Sign in</Link>
    </> : isClerkConfigured() ? <InvitationAcceptance /> : <>
      <p className="app-status">Invitation acceptance is temporarily unavailable. Please reopen your invitation shortly.</p>
      <Link href="/" className="app-button app-button--secondary">Return to Meritus</Link>
    </>}
  </AccessShell>;
}
