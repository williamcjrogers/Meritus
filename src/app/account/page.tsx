import { redirect } from "next/navigation";
import { requirePageIdentity } from "@/lib/portal/auth";
import { destinationFor, safeReturnPath } from "@/lib/portal/destination";
export const metadata = { title: "Your account", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo } = await searchParams;
  const identity = await requirePageIdentity(safeReturnPath(returnTo) ?? "/portal");
  redirect(destinationFor(identity.role, returnTo));
}
