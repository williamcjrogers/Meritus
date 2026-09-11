import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { HallmarkLogo } from "@/components/icons/HallmarkLogo";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { isClerkConfigured } from "@/lib/env";

export const metadata = {
  title: "Client sign in",
  robots: { index: false, follow: false },
};

export default function ClientSignInPage() {
  return (
    <main id="main-content" className="min-h-screen bg-green grain flex flex-col items-center justify-center px-6 py-20">
      <Link href="/" className="mb-10">
        <HallmarkLogo size="standalone" variant="light" showDescriptor />
      </Link>
      <p className="mb-6 max-w-sm text-center text-[13px] leading-relaxed text-cream/70">
        Use the invitation email a director sent you. Matter files live in VeriCase WR2.0 S3.
        This is not{" "}
        <Link href="/sign-in" className="text-brass hover:text-brass-light">
          Partner
        </Link>{" "}
        login.
      </p>
      {isClerkConfigured() ? (
        <SignIn
          signUpUrl="/client/sign-up"
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
          <SetupNotice title="Client sign-in is not configured yet" />
        </div>
      )}
    </main>
  );
}
