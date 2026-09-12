import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccessShell } from "@/components/access/AccessShell";
import { isClerkConfigured } from "@/lib/env";
import { accountDestination, unavailableDestination } from "@/lib/portal/destination";
export const metadata = { title: "Sign in to Meritus", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo } = await searchParams;
  const destination = accountDestination(returnTo);
  if (isClerkConfigured()) {
    let signedIn = false;
    try { signedIn = Boolean((await auth()).userId); } catch { redirect(unavailableDestination(returnTo)); }
    if (signedIn) redirect(destination);
  }
  return <AccessShell title="Sign in to Meritus">
    {isClerkConfigured() ? <SignIn routing="hash" withSignUp={false} fallbackRedirectUrl={destination} forceRedirectUrl={destination} appearance={{ elements: { header: { display: "none" }, footerAction: { display: "none" } } }} /> : <>
      <p className="app-status">Sign-in is temporarily unavailable. Please try again shortly.</p>
      <Link className="app-button" href="/sign-in" prefetch={false}>Retry</Link>
    </>}
  </AccessShell>;
}
