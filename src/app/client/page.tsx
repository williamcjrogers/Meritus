import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientDocumentsView } from "@/components/client/ClientDocumentsView";
import { findActiveClientDomain } from "@/lib/db/client-domains";
import { listClientDocuments } from "@/lib/db/documents";
import { isDatabaseConfigured, isStorageConfigured } from "@/lib/env";
import { requirePageIdentity } from "@/lib/portal/auth";
export const dynamic = "force-dynamic";
function signOut() { return <SignOutButton redirectUrl="/access"><button type="button" className="app-button app-button--secondary">Sign out</button></SignOutButton>; }
export default async function ClientDeskPage() {
  const identity = await requirePageIdentity("/client");
  if (identity.role === "director") redirect("/portal/clients");
  if (identity.role !== "client" || !identity.domain) redirect("/access/denied");
  if (!isDatabaseConfigured() || !isStorageConfigured()) return <section className="client-section"><h1>Documents are temporarily unavailable</h1><p className="app-status">Please try again shortly.</p><Link href="/client" prefetch={false} className="app-button">Retry</Link></section>;
  const domain = await findActiveClientDomain(identity.domain);
  if (!domain) return <section className="client-section"><h1>Your organisation’s access has ended</h1><p className="app-status">To send more documents, contact Meritus at enquiries@meritusvia.com.</p>{signOut()}</section>;
  const files = await listClientDocuments(domain.id);
  return <ClientDocumentsView organisation={domain.firm} email={identity.email} receipts={files} accountControl={signOut()} />;
}
