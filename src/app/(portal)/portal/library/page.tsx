export const metadata = { title: "Library" };
import { requireWorkspacePage } from "@/lib/portal/auth";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { PageHeader } from "@/components/ui/PageHeader";
import { FileList } from "@/components/portal/FileList";
import { isDatabaseConfigured, missingRequiredSetup } from "@/lib/env";
import { listDocuments } from "@/lib/db/documents";
import { summariseDocument } from "@/lib/portal/files";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  if (missingRequiredSetup() || !isDatabaseConfigured()) {
    return <SetupNotice />;
  }
  await requireWorkspacePage("/portal/library");

  let files;
  try {
    files = await listDocuments({ scope: "library" });
  } catch {
    return <SetupNotice title="Database is configured but not migrated" />;
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Library" description="Shared firm documents. Pursuit records remain with their pursuit; instructed evidence stays in VeriCase." />
      <div className="app-panel bg-surface border border-line p-6">
        <FileList documents={files.map(summariseDocument)} uploadUrl="/api/portal/library" />
      </div>
    </div>
  );
}
