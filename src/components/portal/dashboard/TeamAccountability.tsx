import Link from "next/link";
import { actionQueryHref } from "@/lib/actions/filters";
import type { ActionFilter } from "@/lib/actions/types";
import type { DashboardView } from "@/lib/dashboard/types";
import { SectionFailure } from "./SectionFailure";

export function TeamAccountability({ result }: { result: DashboardView["team"] }) {
  const countLink = (ownerId: string | null, filter: ActionFilter) => actionQueryHref({ scope: "team", filter, ownerId, page: 1, pageSize: 50 });
  return <section className="home-team" aria-labelledby="team-heading">
    <div className="home-section-heading"><div><h2 id="team-heading">Team accountability</h2><p>Assigned work across the team</p></div><span className="home-tag">Team totals</span></div>
    {!result.ok ? <SectionFailure error={result.error} /> : result.data.length === 0 ? <p className="home-empty">No team action records are available.</p> : <div className="home-table-scroll"><table>
      <thead><tr><th scope="col">Assignee</th><th scope="col">Open</th><th scope="col">Overdue</th><th scope="col">Next 7 days</th><th scope="col">Completed<br />last 7 days</th></tr></thead>
      <tbody>{result.data.map(row => <tr key={row.ownerId ?? "unassigned"}><th scope="row"><Link href={countLink(row.ownerId, "open")}>{row.ownerName}</Link></th>
        {([['open', row.open], ['overdue', row.overdue], ['upcoming', row.upcoming], ['completed_recent', row.completedRecent]] as const).map(([filter, count]) => <td key={filter}><Link className={filter === "overdue" && count > 0 ? "home-overdue" : ""} href={countLink(row.ownerId, filter)} aria-label={`${row.ownerName}: ${count} ${filter.replaceAll('_', ' ')} actions`}>{count}</Link></td>)}
      </tr>)}</tbody>
    </table></div>}
  </section>;
}
