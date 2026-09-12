import Link from "next/link";
import { HallmarkLogo } from "@/components/icons/HallmarkLogo";
import { AccessForm } from "@/components/access/AccessForm";

export const metadata = {
  title: "Send documents to Meritus",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function AccessPage() {
  return (
    <main id="main-content" className="min-h-screen bg-green grain flex flex-col items-center justify-center px-6 py-20">
      <Link href="/" className="mb-10">
        <HallmarkLogo size="standalone" variant="light" showDescriptor />
      </Link>
      <h1 className="mb-3 font-serif text-3xl text-cream">Send documents to Meritus</h1>
      <p className="mb-8 max-w-sm text-center text-[13px] leading-relaxed text-cream/70">
        Enter your work email. If your organisation has been given access, we will email you a
        link to a private upload desk. No password, nothing to install.
      </p>
      <AccessForm />
      <p className="mt-10 text-[12px] text-cream/50">
        Meritus directors sign in <Link href="/sign-in" className="text-brass hover:underline">here</Link>.
      </p>
    </main>
  );
}
