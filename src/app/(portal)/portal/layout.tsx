import { requireResearchDirector } from "@/lib/research/roles";
import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { PortalNavigation } from "@/components/portal/PortalNavigation";
import { isClerkConfigured } from "@/lib/env";
import { getDirector } from "@/lib/portal/directors";

export const metadata: Metadata = {
  title: "Directors' workspace",
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
  if (isClerkConfigured()) await requireResearchDirector();
  const director = await signedInDirector();
  const clerk = isClerkConfigured();

  return (
    <div className="portal min-h-screen bg-stone text-ink">
      <PortalNavigation clerk={clerk} director={director} />

      <div className="lg:pl-56">
        <main id="main-content" className="px-4 py-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
