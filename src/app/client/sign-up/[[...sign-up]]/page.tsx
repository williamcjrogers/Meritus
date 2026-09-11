import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { HallmarkLogo } from "@/components/icons/HallmarkLogo";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { isClerkConfigured } from "@/lib/env";

export const metadata = {
  title: "Client invitation",
  robots: { index: false, follow: false },
};

export default function ClientSignUpPage() {
  return (
    <main id="main-content" className="min-h-screen bg-green grain flex flex-col items-center justify-center px-6 py-20">
      <Link href="/" className="mb-10">
        <HallmarkLogo size="standalone" variant="light" showDescriptor />
      </Link>
      <p className="mb-6 max-w-sm text-center text-[13px] leading-relaxed text-cream/70">
        This page completes a client invitation. Open Accept invitation from the email a
        director sent you. Matter files stay in VeriCase WR2.0 S3 — this login does not
        create a second archive. This is not Partner login.
      </p>
      {isClerkConfigured() ? (
        <SignUp
          signInUrl="/client/sign-in"
          fallbackRedirectUrl="/client"
          forceRedirectUrl="/client"
          appearance={{
            variables: {
              colorPrimary: "#B5975A",
              colorBackground: "#EDE7DB",
              borderRadius: "0px",
              fontFamily: "var(--font-inter)",
            },
          }}
        />
      ) : (
        <div className="w-full max-w-lg">
          <SetupNotice title="Client sign-up is not configured yet" />
        </div>
      )}
    </main>
  );
}
