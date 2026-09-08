import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { HallmarkLogo } from "@/components/icons/HallmarkLogo";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { isClerkConfigured } from "@/lib/env";

export const metadata = {
  title: "Partner sign in",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <main id="main-content" className="min-h-screen bg-green grain flex flex-col items-center justify-center px-6 py-20">
      <Link href="/" className="mb-10">
        <HallmarkLogo size="standalone" variant="light" showDescriptor />
      </Link>
      {isClerkConfigured() ? (
        <SignIn
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
          <SetupNotice title="Sign-in is not configured yet" />
        </div>
      )}
    </main>
  );
}
