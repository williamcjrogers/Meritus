import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = { title: "Client documents", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <div className="client-shell">
    <header className="client-header"><Link href="/" className="access-brand">Meritus Via</Link><Link href="/account" className="app-button app-button--ghost">Account</Link></header>
    <main id="main-content" className="client-main">{children}</main>
  </div>;
}
