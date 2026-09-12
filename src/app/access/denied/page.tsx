import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import { HallmarkLogo } from "@/components/icons/HallmarkLogo";
import { isClerkConfigured } from "@/lib/env";

export const metadata = {
  title: "No access",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** A signed-in account with no role lands here instead of looping between sign-in and the portal. */
export default function AccessDeniedPage() {
  return (
    <main id="main-content" className="min-h-screen bg-green grain flex flex-col items-center justify-center px-6 py-20">
      <Link href="/" className="mb-10">
        <HallmarkLogo size="standalone" variant="light" showDescriptor />
      </Link>
      <h1 className="mb-3 font-serif text-3xl text-cream">This account has no access yet</h1>
      <p className="mb-8 max-w-sm text-center text-[13px] leading-relaxed text-cream/70">
        Clients get in with an emailed link from the access page. Directors are set up by Meritus.
        If you expected access, contact enquiries@meritusvia.com.
      </p>
      <div className="flex items-center gap-6">
        <Link href="/access" className="btn-brass text-[12px]">Request a link</Link>
        {isClerkConfigured() ? (
          <SignOutButton redirectUrl="/access">
            <button type="button" className="text-[12px] text-cream/70 hover:text-brass">Sign out</button>
          </SignOutButton>
        ) : null}
      </div>
    </main>
  );
}
