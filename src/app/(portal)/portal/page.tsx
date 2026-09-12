export const metadata = { title: "Home" };
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { HomeDashboard } from "@/components/portal/dashboard/HomeDashboard";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { readDashboard } from "@/lib/dashboard/read";
import { isDatabaseConfigured, missingRequiredSetup } from "@/lib/env";
import { requireWorkspacePage } from "@/lib/portal/auth";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: {
  searchParams: Promise<{ stage?: string; scope?: string }>;
}) {
  const params = await searchParams;
  if (["dormant", "instructed", "declined"].includes(params.stage ?? "")) {
    redirect(`/portal/pursuits?stage=${params.stage}`);
  }
  if (missingRequiredSetup() || !isDatabaseConfigured()) return <SetupNotice />;
  await requireWorkspacePage("/portal");
  const jar = await cookies();
  const scope = params.scope === "mine" || params.scope === "team"
    ? params.scope : jar.get("home_scope")?.value === "mine" ? "mine" : "team";
  return <HomeDashboard view={await readDashboard(scope, new Date())} />;
}
