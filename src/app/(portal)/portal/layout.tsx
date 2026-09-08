import type { Metadata } from "next";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { HallmarkLogo } from "@/components/icons/HallmarkLogo";
import { isClerkConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Partner portal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/portal", label: "Home" },
  { href: "/portal/leads", label: "Leads" },
  { href: "/portal/library", label: "Library" },
] as const;

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone text-ink">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col bg-green text-cream lg:flex">
        <div className="px-5 pt-8 pb-6 border-b border-brass/15">
          <HallmarkLogo size="header" variant="light" />
          <p className="mt-3 font-mono text-[9px] tracking-[0.25em] uppercase text-brass/80">
            Partner portal
          </p>
        </div>
        <nav className="flex-1 px-3 py-6 space-y-1" aria-label="Portal">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-3 py-2 text-[13px] text-cream/75 hover:text-brass hover:bg-white/5 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-5 py-5 border-t border-brass/15">
          <Link href="/" className="font-mono text-[10px] tracking-[0.2em] uppercase text-brass hover:text-brass-light">
            Back to site
          </Link>
        </div>
      </aside>

      <div className="lg:pl-56">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-green/10 bg-stone/95 px-4 py-3 backdrop-blur lg:px-8">
          <nav className="flex items-center gap-4 lg:hidden" aria-label="Portal mobile">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="text-[12px] text-green/70 hover:text-green">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {isClerkConfigured() ? <UserButton /> : null}
          </div>
        </header>
        <main id="main-content" className="px-4 py-8 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
