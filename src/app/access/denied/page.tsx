import { SignOutButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccessShell } from "@/components/access/AccessShell";
import { isClerkConfigured } from "@/lib/env";
import { resolveIdentity } from "@/lib/portal/roles";
import { destinationFor } from "@/lib/portal/destination";
export const metadata = { title: "Account access", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function AccessDeniedPage() {
  let destination: string | null = null;
  if (isClerkConfigured()) {
    try {
      const { userId } = await auth();
      if (userId) { const identity = await resolveIdentity(userId); if (identity.role) destination = destinationFor(identity.role); }
    } catch { redirect("/access/unavailable"); }
  }
  return <AccessShell title="This account cannot open that page" description="If you expected access, contact enquiries@meritusvia.com so we can check your account.">
    <div className="access-actions">
      <Link href={destination ?? "/access"} className="app-button">{destination ? "Return to your account" : "Request a document link"}</Link>
      {isClerkConfigured() ? <SignOutButton redirectUrl="/access"><button type="button" className="app-button app-button--secondary">Sign out</button></SignOutButton> : null}
    </div>
  </AccessShell>;
}
