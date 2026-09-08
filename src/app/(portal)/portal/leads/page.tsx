import Link from "next/link";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { NewLeadForm } from "@/components/portal/NewLeadForm";
import { isDatabaseConfigured, missingRequiredSetup } from "@/lib/env";
import { listLeads } from "@/lib/db/queries";
import { leadStatusLabel } from "@/lib/portal/status";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  if (missingRequiredSetup() || !isDatabaseConfigured()) {
    return <SetupNotice />;
  }

  let rows;
  try {
    rows = await listLeads();
  } catch {
    return <SetupNotice title="Database is configured but not migrated" />;
  }

  return (
    <div className="max-w-5xl space-y-10">
      <div>
        <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-brass mb-3">CRM</p>
        <h1 className="font-serif text-4xl text-green italic">Leads</h1>
      </div>

      <NewLeadForm />

      <div className="overflow-x-auto border border-green/10 bg-parchment">
        <table className="w-full text-left text-[13px]">
          <thead className="font-mono text-[10px] tracking-[0.15em] uppercase text-slate/60 border-b border-green/10">
            <tr>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-slate">
                  No leads yet.
                </td>
              </tr>
            ) : (
              rows.map((lead) => (
                <tr key={lead.id} className="border-t border-green/10 hover:bg-stone/40">
                  <td className="px-4 py-3">
                    <Link href={`/portal/leads/${lead.id}`} className="text-green hover:text-brass">
                      {lead.companyName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate">{lead.contactName ?? "—"}</td>
                  <td className="px-4 py-3">{leadStatusLabel(lead.status)}</td>
                  <td className="px-4 py-3 text-slate">
                    {lead.updatedAt.toLocaleDateString("en-GB")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
