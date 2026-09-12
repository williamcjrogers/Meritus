import Link from "next/link";
import type { DashboardView } from "@/lib/dashboard/types";
import { SectionFailure } from "./SectionFailure";

export function LiveLeadSummary({ result }: { result: DashboardView["leads"] }) {
  return <section className="home-leads" aria-labelledby="leads-heading"><div className="home-section-heading"><div><h2 id="leads-heading">Live leads</h2><p>Commercial progress</p></div><Link href="/portal/pursuits" aria-label="Open live leads">Open live leads <span aria-hidden="true">↗</span></Link></div>
    {!result.ok ? <SectionFailure error={result.error} /> : <><div className="home-stage-counts">{(["enquiry", "scoping", "proposal"] as const).map(stage => <Link key={stage} href="/portal/pursuits"><strong>{result.data.stages[stage]}</strong><span>{stage[0].toUpperCase() + stage.slice(1)}</span></Link>)}</div><div className="home-muted flex flex-wrap gap-x-3 gap-y-1">{(["instructed", "dormant", "declined"] as const).map(stage => <Link key={stage} href={`/portal/pursuits?stage=${stage}`}>{result.data.stages[stage]} {stage}</Link>)}</div></>}
  </section>;
}

export function ContextSummary({ view }: { view: DashboardView }) {
  return <div className="home-summary-grid">
    <section aria-labelledby="prospects-heading"><div className="home-section-heading"><h2 id="prospects-heading">Prospects</h2><span className="home-tag">Team totals</span></div>
      {!view.prospects.ok ? <SectionFailure error={view.prospects.error} /> : <><p className="home-context-number"><strong>{view.prospects.data.availableToApproach}</strong> available to approach</p><p className="home-muted">{view.prospects.data.statuses.approaching} approaching · {view.prospects.data.statuses.contacted} contacted</p></>}
      <Link className="home-workspace-link" href="/portal/prospects">Open prospects <span aria-hidden="true">↗</span></Link>
    </section>
    <section aria-labelledby="research-heading"><div className="home-section-heading"><h2 id="research-heading">Research</h2></div>
      {!view.research.ok ? <SectionFailure error={view.research.error} /> : <><p className="home-context-number"><strong>{view.research.data.signalsAwaitingReview}</strong> signals awaiting review</p><p className="home-muted">{view.research.data.runningInvestigations} running · {view.research.data.queuedInvestigations} queued</p><p className="home-muted">{view.research.data.reportsAwaitingReview} reports to review{view.research.data.failedLatestRuns > 0 ? ` · ${view.research.data.failedLatestRuns} runs need attention` : ""}</p></>}
      <Link className="home-workspace-link" href="/portal/research">Open research <span aria-hidden="true">↗</span></Link>
    </section>
    <section aria-labelledby="programmes-heading"><div className="home-section-heading"><h2 id="programmes-heading">Programme analysis</h2><span className="home-tag">Team totals</span></div>
      {!view.programmes.ok ? <SectionFailure error={view.programmes.error} /> : <><p className="home-context-number"><strong>{view.programmes.data.analysed}</strong> analysed of {view.programmes.data.uploaded} uploaded</p><p className="home-muted">{view.programmes.data.analysing} being analysed · {view.programmes.data.analysisFailed} analysis failed</p><p className="home-muted">{view.programmes.data.parseNeedsAttention} uploads need attention</p></>}
      <Link className="home-workspace-link" href="/portal/programmes">Open programmes <span aria-hidden="true">↗</span></Link>
    </section>
  </div>;
}
