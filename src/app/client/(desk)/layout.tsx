import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { HallmarkLogo } from "@/components/icons/HallmarkLogo";
import { DirectorMenu } from "@/components/portal/DirectorMenu";
import { Eyebrow } from "@/components/portal/Eyebrow";
import { NavLink } from "@/components/portal/NavLink";
import { clerkPrimaryEmail } from "@/lib/client/invite";
import { isClerkConfigured } from "@/lib/env";
import { initialsFor } from "@/lib/portal/director-helpers";

export const metadata: Metadata = {
  title: "Client desk",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

async function signedInClient(): Promise<{ name: string; initials: string } | null> {
  if (!isClerkConfigured()) return null;
  try {
    const user = await currentUser();
    if (!user) return null;
    const email = clerkPrimaryEmail(user);
    const name = [user.firstName, user.lastName]
      .map((part) => part?.trim() ?? "")
      .filter(Boolean)
      .join(" ");
    return {
      name: name || email || "Client",
      initials: initialsFor({ firstName: user.firstName, lastName: user.lastName, email }),
    };
  } catch {
    return null;
  }
}

export default async function ClientDeskLayout({ children }: { children: React.ReactNode }) {
  const client = await signedInClient();
  const clerk = isClerkConfigured();

  return (
    <div className="portal min-h-screen bg-stone text-ink">
      <aside className="portal-rail fixed inset-y-0 left-0 z-20 hidden w-56 flex-col bg-green text-cream lg:flex">
        <div className="border-b border-brass/15 px-3 pb-5 pt-7">
          <Link href="/client" aria-label="Client desk home" className="block">
            <HallmarkLogo size="header" variant="light" />
          </Link>
          <Eyebrow tone="brass" className="mt-3 px-1">
            Client desk
          </Eyebrow>
        </div>
        <nav className="flex-1 space-y-1 py-5" aria-label="Client desk">
          <NavLink href="/client" match="exact">
            Home
          </NavLink>
        </nav>
        <div className="space-y-4 border-t border-brass/15 px-4 py-5">
          {clerk && <DirectorMenu name={client?.name ?? null} initials={client?.initials ?? null} />}
          <Link href="/" className="inline-block font-mono text-[10px] tracking-[0.2em] uppercase text-brass hover:text-brass-light">
            Back to site
          </Link>
        </div>
      </aside>

      <div className="lg:pl-56">
        <header className="portal-rail sticky top-0 z-10 flex items-center justify-between gap-4 bg-green px-4 py-3 text-cream lg:hidden">
          <Link href="/client" aria-label="Client desk home" className="shrink-0">
            <HallmarkLogo size="favicon" variant="light" />
          </Link>
          <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-brass/80">Client desk</p>
          {clerk ? <DirectorMenu name={client?.name ?? null} initials={client?.initials ?? null} compact /> : <span />}
        </header>
        <main id="main-content" className="px-4 py-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
