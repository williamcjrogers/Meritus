import { SetupNotice } from "@/components/portal/SetupNotice";
import { isDatabaseConfigured, missingRequiredSetup } from "@/lib/env";
import { countByStage } from "@/lib/db/pursuits";

export const dynamic = "force-dynamic";

export default async function PursuitDeskPage() {
  if (missingRequiredSetup() || !isDatabaseConfigured()) {
    return <SetupNotice />;
  }

  let counts;
  try {
    counts = await countByStage();
  } catch {
    return <SetupNotice title="Database is configured but not migrated" />;
  }
  const open = counts.enquiry + counts.scoping + counts.proposal;

  return (
    <div className="max-w-6xl">
      <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-brass mb-3">Pursuit desk</p>
      <h1 className="font-serif text-4xl text-green">
        {open === 0 ? "No open pursuits" : `${open} open ${open === 1 ? "pursuit" : "pursuits"}`}
      </h1>
      <p className="mt-3 text-[14px] text-slate max-w-xl">Enquiries from the site land here.</p>
    </div>
  );
}
