import type { Metadata } from "next";
import { IntelligenceWorkspace } from "@/components/portal/intelligence/IntelligenceWorkspace";
import { intelligenceServiceConfig } from "@/lib/intelligence/config";
import { requireWorkspacePage } from "@/lib/portal/auth";

export const metadata: Metadata = { title: "Intelligence", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function IntelligencePage() {
  await requireWorkspacePage("/portal/intelligence");
  return <IntelligenceWorkspace configured={intelligenceServiceConfig() !== null} />;
}
