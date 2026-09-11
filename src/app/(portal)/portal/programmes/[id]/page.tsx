import Link from "next/link";
import { notFound } from "next/navigation";
import { Eyebrow } from "@/components/portal/Eyebrow";
import { ProgrammeRecompute } from "@/components/portal/ProgrammeRecompute";
import { ProgrammeReportView } from "@/components/portal/ProgrammeReportView";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { expireStaleProgrammeReports, getProgramme, latestCompleteReport, latestReport } from "@/lib/db/programmes";
import { isDatabaseConfigured, missingRequiredSetup } from "@/lib/env";
import { detailProgramme } from "@/lib/programme/view";

export const dynamic = "force-dynamic";

export default async function ProgrammeReportPage({ params }: { params: Promise<{ id: string }> }) {
  if (missingRequiredSetup() || !isDatabaseConfigured()) {
    return <SetupNotice />;
  }

  const { id } = await params;
  let detail;
  try {
    const row = await getProgramme(id);
    if (!row) notFound();
    await expireStaleProgrammeReports(id);
    const [run, complete] = await Promise.all([latestReport(id), latestCompleteReport(id)]);
    detail = detailProgramme(row, complete ?? run);
  } catch {
    return <SetupNotice title="Database is configured but not migrated" />;
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link href="/portal/programmes" className="btn-quiet">
          <span aria-hidden="true">←</span> Programmes
        </Link>
      </div>
      <Eyebrow rule={false}>Programme report</Eyebrow>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-serif text-3xl text-green sm:text-4xl">{detail.fileName}</h1>
        <ProgrammeRecompute programmeId={detail.id} />
      </div>
      <p className="mt-2 mb-8 text-[13px] text-ink/70">
        Health {detail.report?.healthScore ?? "—"}
        {detail.report?.method ? ` · ${detail.report.method}` : ""}
        {detail.report?.status === "running" && detail.report.progress
          ? ` · ${detail.report.progress.stage} (${detail.report.progress.percent}%)`
          : ""}
      </p>
      <div className="panel-brackets border border-green/10 bg-parchment p-6">
        <ProgrammeReportView detail={detail} />
      </div>
    </div>
  );
}
