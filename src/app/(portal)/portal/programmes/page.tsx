export const metadata = { title: "Programmes" };
import { requireWorkspacePage } from "@/lib/portal/auth";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgrammeUpload } from "@/components/portal/ProgrammeUpload";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { expireStaleProgrammeReports, latestReport, listProgrammes } from "@/lib/db/programmes";
import { isDatabaseConfigured, missingRequiredSetup } from "@/lib/env";
import { fullDate } from "@/lib/portal/dates";
import { summariseProgramme } from "@/lib/programme/view";

export const dynamic = "force-dynamic";

export default async function ProgrammesPage() {
  if (missingRequiredSetup() || !isDatabaseConfigured()) {
    return <SetupNotice />;
  }
  await requireWorkspacePage("/portal/programmes");

  let items;
  try {
    const rows = await listProgrammes();
    items = await Promise.all(
      rows.map(async (row) => {
        await expireStaleProgrammeReports(row.id);
        return summariseProgramme(row, await latestReport(row.id));
      })
    );
  } catch {
    return <SetupNotice title="Database is configured but not migrated" />;
  }

  return (
    <div className="max-w-4xl">
      <PageHeader title="Programmes" description="Review programme records, assess schedule quality and examine delay. Upload XML or CSV for activity-level analysis; native Asta files can be inspected. Instructed evidence remains in VeriCase." />
      <div className="app-panel mb-8 border border-line bg-surface p-6">
        <ProgrammeUpload />
      </div>
      <ul className="divide-y divide-line">
        {items.map((item) => (
          <li key={item.id} className="py-4">
            <Link href={`/portal/programmes/${item.id}`} className="text-[15px] text-primary hover:text-primary">
              {item.fileName}
            </Link>
            <p className="mt-1 font-sans text-[13px]  text-muted">
              {item.parseStatus} · {item.format}
              {item.report?.method ? ` · ${item.report.method}` : ""}
              {item.report?.healthScore != null ? ` · health ${item.report.healthScore} (${item.report.healthLevel})` : ""}
              {item.report?.status === "failed" ? ` · ${item.report.error ?? "failed"}` : ""}
              {` · ${fullDate(new Date(item.createdAt))}`}
            </p>
          </li>
        ))}
        {items.length === 0 && <li className="py-4 text-[13px] text-muted">No programmes yet.</li>}
      </ul>
    </div>
  );
}
