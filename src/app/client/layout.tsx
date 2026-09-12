import type { Metadata } from "next";
import Link from "next/link";
import { HallmarkLogo } from "@/components/icons/HallmarkLogo";

export const metadata: Metadata = {
  title: "Meritus upload desk",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="portal min-h-screen bg-stone text-ink">
      <header className="bg-green grain px-6 py-5">
        <Link href="/" className="inline-flex">
          <HallmarkLogo size="standalone" variant="light" showDescriptor />
        </Link>
      </header>
      <main id="main-content" className="mx-auto max-w-3xl px-6 py-10">
        {children}
      </main>
    </div>
  );
}
