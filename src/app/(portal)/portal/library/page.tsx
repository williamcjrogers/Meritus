import { requireResearchDirector } from "@/lib/research/roles";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { Eyebrow } from "@/components/portal/Eyebrow";
import { FileList } from "@/components/portal/FileList";
import { isDatabaseConfigured, missingRequiredSetup } from "@/lib/env";
import { listDocuments } from "@/lib/db/documents";
import { summariseDocument } from "@/lib/portal/files";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  if (missingRequiredSetup() || !isDatabaseConfigured()) {
    return <SetupNotice />;
  }
  await requireResearchDirector();

  let files;
  try {
    files = await listDocuments({ scope: "library" });
  } catch {
    return <SetupNotice title="Database is configured but not migrated" />;
  }

  return (
    <div className="max-w-3xl">
      <Eyebrow rule={false} className="mb-3">Library</Eyebrow>
      <h1 className="font-serif text-4xl text-green">Firm library</h1>
      <p className="mt-3 text-[14px] text-ink/70 max-w-xl mb-8">
        Firm documents that belong to no single pursuit. Files about a pursuit live on the pursuit. Instructed evidence stays in VeriCase.
      </p>
      <div className="panel-brackets bg-parchment border border-green/10 p-6">
        <FileList documents={files.map(summariseDocument)} uploadUrl="/api/portal/library" />
      </div>
    </div>
  );
}
