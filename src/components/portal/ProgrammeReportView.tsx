import type { ProgrammeDetail } from "@/lib/programme/view";
import type { CitedFigure, ProgrammeIssue, ProgrammeReport } from "@/lib/programme/types";

function severityClass(severity: ProgrammeIssue["severity"]): string {
  switch (severity) {
    case "high":
      return "text-oxblood";
    case "medium":
      return "text-ink";
    case "low":
      return "text-ink/70";
    default: {
      const _exhaustive: never = severity;
      return _exhaustive;
    }
  }
}

function figureValue(figure: CitedFigure): string {
  const value = String(figure.value);
  return figure.unit ? `${value} ${figure.unit}` : value;
}

export function ProgrammeReportView({ detail }: { detail: ProgrammeDetail }) {
  const report = detail.reportBody;
  const run = detail.report;
  const failed = run?.status === "failed" || Boolean(run?.error);
  const running = run?.status === "running";

  return (
    <div className="space-y-6">
      {running && (
        <p className="text-[13px] text-ink/80" role="status">
          Generating report… {run?.progress?.stage ?? "running"} ({run?.progress?.percent ?? 0}%).
        </p>
      )}
      {failed && run?.error && (
        <p className="text-[13px] text-oxblood" role="alert">
          {run.error}
        </p>
      )}

      <ParseBanner detail={detail} />

      {!report && !running && (
        <p className="text-[13px] text-ink/70">
          {detail.parseStatus === "failed"
            ? "No report: ingest failed. The issues above say what the file is missing."
            : detail.activityCount === 0
              ? "No activity-level schedule was mapped, so delay figures were not computed."
              : "No report has been stored for this programme yet."}
        </p>
      )}

      {report && <ReportBody report={report} />}
    </div>
  );
}

function ParseBanner({ detail }: { detail: ProgrammeDetail }) {
  return (
    <div className="border border-green/10 bg-stone/40 px-4 py-3">
      <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink/70">
        {detail.parseStatus} · {detail.format} · {detail.parseEngine} · confidence {detail.parseConfidence}
        {detail.activityCount ? ` · ${detail.activityCount} activities` : ""}
      </p>
      {detail.issues.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {detail.issues.map((issue) => (
            <li key={`${issue.code}-${issue.title}`} className={`text-[13px] ${severityClass(issue.severity)}`}>
              <span className="font-medium">{issue.title}.</span> {issue.detail}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[13px] text-ink/70">No ingest warnings.</p>
      )}
    </div>
  );
}

function ReportBody({ report }: { report: ProgrammeReport }) {
  return (
    <>
      <section>
        <h3 className="font-serif text-xl text-green">Method</h3>
        <p className="mt-1 text-[14px] text-ink">{report.method.selected.replace(/_/g, " ")}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-ink/80">
          {report.method.criteria.map((line) => (
            <li key={line}>{line}</li>
          ))}
          {report.method.assumptions.map((line) => (
            <li key={line}>Assumption: {line}</li>
          ))}
          {report.method.limitations.map((line) => (
            <li key={line}>Limitation: {line}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="font-serif text-xl text-green">Fences</h3>
        <ul className="mt-2 space-y-2">
          {report.fences.map((fence) => (
            <li key={fence.id}>
              <p className="text-[13px] font-medium text-green">{fence.title}</p>
              <p className="text-[13px] text-ink/80">{fence.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="font-serif text-xl text-green">Figures</h3>
        <p className="mt-1 text-[12px] text-ink/70">Each figure cites the engine block that produced it ({report.engine}).</p>
        <dl className="mt-3 divide-y divide-green/10">
          {report.figures.map((figure) => (
            <div key={figure.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
              <dt className="text-[13px] text-ink">
                {figure.label}
                <span className="ml-2 font-mono text-[10px] tracking-[0.12em] text-ink/60">
                  {figure.id} → {figure.blockId}
                </span>
              </dt>
              <dd className="font-mono text-[13px] text-green">{figureValue(figure)}</dd>
              <p className="w-full text-[12px] text-ink/70">{figure.basis}</p>
            </div>
          ))}
        </dl>
      </section>

      {report.blocks.map((block) => (
        <section key={block.id} id={block.id}>
          <h3 className="font-serif text-xl text-green">{block.title}</h3>
          <p className="font-mono text-[10px] tracking-[0.14em] text-ink/50">{block.id}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-ink/80">
            {block.findings.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
