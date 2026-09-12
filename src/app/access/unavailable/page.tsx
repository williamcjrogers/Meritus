import Link from "next/link";
import { AccessShell } from "@/components/access/AccessShell";
import { accountDestination } from "@/lib/portal/destination";
export const metadata = { title: "Access temporarily unavailable", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function AccessUnavailablePage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo } = await searchParams;
  return <AccessShell title="We cannot verify your access right now" description="Your access has not been checked. Please try again in a moment.">
    <div className="access-actions"><Link href={accountDestination(returnTo)} prefetch={false} className="app-button">Retry</Link></div>
  </AccessShell>;
}
