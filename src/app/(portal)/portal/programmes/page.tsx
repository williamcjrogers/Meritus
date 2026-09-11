import Link from "next/link";
import { Eyebrow } from "@/components/portal/Eyebrow";
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
      <Eyebrow rule={false} className="mb-3">
        Programme
      </Eyebrow>
      <h1 className="font-serif text-4xl text-green">Programme intelligence</h1>
      <p className="mt-3 mb-8 max-w-2xl text-[14px] text-ink/70">
        Adjudication-grade schedule interrogation for the desk. Method choice follows the records (SCL Protocol: no
        single preferred method). Figures cite the block engine. Native Asta .pp files are inspected; export XML or CSV
        for activity-level CPM. Instructed evidence still lives in VeriCase.
      </p>
      <div className="panel-brackets mb-8 border border-green/10 bg-parchment p-6">
        <ProgrammeUpload />
      </div>
      <ul className="divide-y divide-green/10">
        {items.map((item) => (
          <li key={item.id} className="py-4">
            <Link href={`/portal/programmes/${item.id}`} className="text-[15px] text-green hover:text-brass">
              {item.fileName}
            </Link>
            <p className="mt-1 font-mono text-[10px] tracking-[0.12em] text-ink/70">
              {item.parseStatus} · {item.format}
              {item.report?.method ? ` · ${item.report.method}` : ""}
              {item.report?.healthScore != null ? ` · health ${item.report.healthScore} (${item.report.healthLevel})` : ""}
              {item.report?.status === "failed" ? ` · ${item.report.error ?? "failed"}` : ""}
              {` · ${fullDate(new Date(item.createdAt))}`}
            </p>
          </li>
        ))}
        {items.length === 0 && <li className="py-4 text-[13px] text-ink/70">No programmes yet.</li>}
      </ul>
    </div>
  );
}
