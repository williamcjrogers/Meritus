import Link from "next/link";
import { displayDate } from "@/lib/actions/dates";
import type { DashboardView } from "@/lib/dashboard/types";
import { SectionFailure } from "./SectionFailure";

export function Agenda({ result, onAddAction }: { result: DashboardView["agenda"]; onAddAction?: (id: string) => void }) {
  return <section className="home-agenda" aria-labelledby="agenda-heading">
    <div className="home-section-heading"><div><h2 id="agenda-heading">Dates ahead</h2><p>The next 14 days</p></div></div>
    {!result.ok ? <SectionFailure error={result.error} /> : <>
      {result.data.warnings.map(warning => <p className="home-warning" role="status" key={warning}>{warning}</p>)}
      {result.data.entries.length === 0 ? <p className="home-empty">No recorded dates in the next 14 days.</p> : <ol className="home-agenda-list">{result.data.entries.map(entry => <li key={`${entry.kind}:${entry.id}`}>
        <time dateTime={entry.date}>{displayDate(entry.date)}</time>
        <span className="home-record-kind">{entry.kind === "action" ? "Action due" : entry.kind === "review" ? "Lead review" : "Reviewed research date"}</span>
        <Link href={entry.href}>{entry.title}</Link>
        {entry.ownerName && <p>{entry.ownerName}</p>}
        {entry.qualification && <details><summary>Source and assumptions</summary><p>{entry.qualification}</p></details>}
        {entry.kind === "research" && onAddAction && <button type="button" className="home-text-button" onClick={() => onAddAction(entry.id)}>Add action for this date</button>}
      </li>)}</ol>}
    </>}
  </section>;
}
