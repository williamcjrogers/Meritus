import type { Metadata } from "next";
import { PortalNavigation } from "@/components/portal/PortalNavigation";
import { isClerkConfigured } from "@/lib/env";
import { getDirector } from "@/lib/portal/directors";
import { requireWorkspacePage } from "@/lib/portal/auth";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "Meritus workspace",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

async function signedInDirector(userId: string): Promise<{ name: string; initials: string } | null> {
  try {
    const director = await getDirector(userId);
    return director ? { name: director.name, initials: director.initials } : null;
  } catch {
    return null;
  }
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const userId = await requireWorkspacePage("/portal");
  const director = await signedInDirector(userId);
  const clerk = isClerkConfigured();

  return (
    <div className="workspace-shell">
      <PortalNavigation clerk={clerk} director={director} />

      <ToastProvider><div className="workspace-body">
        <main id="main-content" className="workspace-main">
          {children}
        </main>
      </div></ToastProvider>
    </div>
  );
}
