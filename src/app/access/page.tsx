import { AccessForm } from "@/components/access/AccessForm";
import { AccessShell } from "@/components/access/AccessShell";
import { destinationFor } from "@/lib/portal/destination";
export const metadata = { title: "Send documents", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function AccessPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo } = await searchParams;
  return <AccessShell title="Send documents" description="Enter your work email to request a secure link to your organisation’s documents.">
    <AccessForm returnTo={destinationFor("client", returnTo)} />
  </AccessShell>;
}
