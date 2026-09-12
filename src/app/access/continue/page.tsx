import Link from "next/link";
import { Suspense } from "react";
import { AccessContinue } from "@/components/access/AccessContinue";
import { HallmarkLogo } from "@/components/icons/HallmarkLogo";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { isClerkConfigured } from "@/lib/env";

export const metadata = {
  title: "Opening your upload desk",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function AccessContinuePage() {
  return (
    <main id="main-content" className="min-h-screen bg-green grain flex flex-col items-center justify-center px-6 py-20">
      <Link href="/" className="mb-10">
        <HallmarkLogo size="standalone" variant="light" showDescriptor />
      </Link>
      {isClerkConfigured() ? (
        <Suspense fallback={null}>
          <AccessContinue />
        </Suspense>
      ) : (
        <div className="w-full max-w-lg">
          <SetupNotice title="Client access is not configured yet" />
        </div>
      )}
    </main>
  );
}
