import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { HallmarkLogo } from "@/components/icons/HallmarkLogo";
import { DirectorMenu } from "@/components/portal/DirectorMenu";
import { Eyebrow } from "@/components/portal/Eyebrow";
import { NavLink } from "@/components/portal/NavLink";
import { isClerkConfigured } from "@/lib/env";
import { getDirector } from "@/lib/portal/directors";

export const metadata: Metadata = {
  title: "Pursuit desk",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

async function signedInDirector(): Promise<{ name: string; initials: string } | null> {
  if (!isClerkConfigured()) return null;
  try {
    const { userId } = await auth();
    if (!userId) return null;
    const director = await getDirector(userId);
    return director ? { name: director.name, initials: director.initials } : null;
  } catch {
    return null;
  }
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const director = await signedInDirector();
  const clerk = isClerkConfigured();

  return (
    <div className="portal min-h-screen bg-stone text-ink">
      <aside className="portal-rail fixed inset-y-0 left-0 z-20 hidden w-56 flex-col bg-green text-cream lg:flex">
        <div className="border-b border-brass/15 px-3 pb-5 pt-7">
          <Link href="/portal" aria-label="Pursuit desk home" className="block">
            <HallmarkLogo size="header" variant="light" />
          </Link>
          <Eyebrow tone="brass" className="mt-3 px-1">
            Pursuit desk
          </Eyebrow>
        </div>
        <nav className="flex-1 space-y-1 py-5" aria-label="Portal">
          <NavLink href="/portal" match="desk">
            Home
          </NavLink>
          <NavLink href="/portal/prospects">
            Prospects
          </NavLink>
          <NavLink href="/portal/library">
            Library
          </NavLink>
          <NavLink href="/portal/clients">
            Clients
          </NavLink>
        </nav>
        <div className="space-y-4 border-t border-brass/15 px-4 py-5">
          {clerk && <DirectorMenu name={director?.name ?? null} initials={director?.initials ?? null} />}
          <Link href="/" className="inline-block font-mono text-[10px] tracking-[0.2em] uppercase text-brass hover:text-brass-light">
            Back to site
          </Link>
        </div>
      </aside>

      <div className="lg:pl-56">
        <header className="portal-rail sticky top-0 z-10 flex items-center justify-between gap-4 bg-green px-4 py-3 text-cream lg:hidden">
          <Link href="/portal" aria-label="Pursuit desk home" className="shrink-0">
            <HallmarkLogo size="favicon" variant="light" />
          </Link>
          <nav className="flex items-center gap-4" aria-label="Portal">
            <NavLink href="/portal" match="desk" variant="bar">
              Home
            </NavLink>
            <NavLink href="/portal/prospects" variant="bar">
              Prospects
            </NavLink>
            <NavLink href="/portal/library" variant="bar">
              Library
            </NavLink>
            <NavLink href="/portal/clients" variant="bar">
              Clients
            </NavLink>
          </nav>
          {clerk ? <DirectorMenu name={director?.name ?? null} initials={director?.initials ?? null} compact /> : <span />}
        </header>
        <main id="main-content" className="px-4 py-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
