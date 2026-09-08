import Link from "next/link";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { missingRequiredSetup, isDatabaseConfigured } from "@/lib/env";
import { countOpenLeads, countRecentDocuments } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function PortalHomePage() {
  if (missingRequiredSetup() || !isDatabaseConfigured()) {
    return <SetupNotice />;
  }

  let openLeads = 0;
  let files = 0;
  try {
    [openLeads, files] = await Promise.all([countOpenLeads(), countRecentDocuments()]);
  } catch {
    return <SetupNotice title="Database is configured but not migrated" />;
  }

  return (
    <div className="max-w-4xl">
      <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-brass mb-3">Portal</p>
      <h1 className="font-serif text-4xl text-green italic">Partner workspace</h1>
      <p className="mt-3 text-[14px] text-slate max-w-xl">
        Leads, notes, research, and the firm library. Instructed matters still live in VeriCase.
      </p>

      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-parchment border border-green/10 p-6">
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-brass">Open leads</p>
          <p className="mt-3 font-serif text-4xl text-green">{openLeads}</p>
        </div>
        <div className="bg-parchment border border-green/10 p-6">
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-brass">Documents</p>
          <p className="mt-3 font-serif text-4xl text-green">{files}</p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-4">
        <Link href="/portal/leads" className="btn-outline text-[13px]">
          View leads
        </Link>
        <Link href="/portal/leads#new" className="btn-brass text-[13px]">
          New lead
        </Link>
      </div>
    </div>
  );
}
