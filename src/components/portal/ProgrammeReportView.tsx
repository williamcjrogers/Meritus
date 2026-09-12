import type { ProgrammeDetail } from "@/lib/programme/view";
import type { CitedFigure, ProgrammeIssue, ProgrammeReport } from "@/lib/programme/types";

function severityClass(severity: ProgrammeIssue["severity"]): string {
  switch (severity) {
    case "high":
      return "text-danger";
    case "medium":
      return "text-text";
    case "low":
      return "text-muted";
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
        <p className="text-[13px] text-muted" role="status">
          Generating report… {run?.progress?.stage ?? "running"} ({run?.progress?.percent ?? 0}%).
        </p>
      )}
      {failed && run?.error && (
        <p className="text-[13px] text-danger" role="alert">
          {run.error}
        </p>
      )}

      <ParseBanner detail={detail} />

      {!report && !running && (
        <p className="text-[13px] text-muted">
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
    <div className="border border-line bg-mist/40 px-4 py-3">
      <p className="font-sans text-[13px]   text-muted">
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
        <p className="mt-2 text-[13px] text-muted">No ingest warnings.</p>
      )}
    </div>
  );
}

function ReportBody({ report }: { report: ProgrammeReport }) {
  return (
    <>
      <section>
        <h3 className="font-sans text-xl text-primary">Method</h3>
        <p className="mt-1 text-[15px] text-text">{report.method.selected.replace(/_/g, " ")}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-muted">
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
        <h3 className="font-sans text-xl text-primary">Fences</h3>
        <ul className="mt-2 space-y-2">
          {report.fences.map((fence) => (
            <li key={fence.id}>
              <p className="text-[13px] font-medium text-primary">{fence.title}</p>
              <p className="text-[13px] text-muted">{fence.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="font-sans text-xl text-primary">Figures</h3>
        <p className="mt-1 text-[13px] text-muted">Each figure cites the engine block that produced it ({report.engine}).</p>
        <dl className="mt-3 divide-y divide-line">
          {report.figures.map((figure) => (
            <div key={figure.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
              <dt className="text-[13px] text-text">
                {figure.label}
                <span className="ml-2 font-sans text-[13px]  text-muted">
                  {figure.id} → {figure.blockId}
                </span>
              </dt>
              <dd className="font-sans text-[13px] text-primary">{figureValue(figure)}</dd>
              <p className="w-full text-[13px] text-muted">{figure.basis}</p>
            </div>
          ))}
        </dl>
      </section>

      {report.blocks.map((block) => (
        <section key={block.id} id={block.id}>
          <h3 className="font-sans text-xl text-primary">{block.title}</h3>
          <p className="font-sans text-[13px]  text-muted">{block.id}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-muted">
            {block.findings.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
