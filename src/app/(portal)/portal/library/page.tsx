import { SetupNotice } from "@/components/portal/SetupNotice";
import { FileList } from "@/components/portal/LeadFiles";
import { isDatabaseConfigured, missingRequiredSetup } from "@/lib/env";
import { listDocuments } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  if (missingRequiredSetup() || !isDatabaseConfigured()) {
    return <SetupNotice />;
  }

  let files;
  try {
    files = await listDocuments({ scope: "library" });
  } catch {
    return <SetupNotice title="Database is configured but not migrated" />;
  }

  return (
    <div className="max-w-3xl">
      <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-brass mb-3">DMS</p>
      <h1 className="font-serif text-4xl text-green italic">Firm library</h1>
      <p className="mt-3 text-[14px] text-slate max-w-xl mb-8">
        Non-client documents. Lead files stay on the lead. Instructed evidence stays in VeriCase.
      </p>
      <div className="bg-parchment border border-green/10 p-6">
        <FileList documents={files} uploadUrl="/api/portal/library" />
      </div>
    </div>
  );
}
