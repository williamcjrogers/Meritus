import Link from "next/link";
import type { DashboardView } from "@/lib/dashboard/types";
import { SectionFailure } from "./SectionFailure";

export function ProgressFeed({ result }: { result: DashboardView["progress"] }) {
  return <section className="home-progress" aria-labelledby="progress-heading"><div className="home-section-heading"><div><h2 id="progress-heading">Recent progress</h2><p>Recorded completions, stage changes and research decisions</p></div></div>
    {!result.ok ? <SectionFailure error={result.error} /> : result.data.length === 0 ? <p className="home-empty">No recent progress has been recorded.</p> : <ol>{result.data.map(entry => <li key={`${entry.kind}:${entry.id}`}><div><Link href={entry.href}>{entry.title}</Link><p>{entry.actorName}</p></div><time dateTime={entry.at}>{new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(entry.at))}</time></li>)}</ol>}
  </section>;
}
