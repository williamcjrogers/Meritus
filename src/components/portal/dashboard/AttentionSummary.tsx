import Link from "next/link";
import { actionQueryHref } from "@/lib/actions/filters";
import type { ActionFilter } from "@/lib/actions/types";
import type { DashboardView } from "@/lib/dashboard/types";
import { SectionFailure } from "./SectionFailure";

export function AttentionSummary({ result, scope }: { result: DashboardView["actions"]; scope: DashboardView["scope"] }) {
  if (!result.ok) return <SectionFailure error={result.error} />;
  const { counts } = result.data;
  const metrics: { label: string; count: number; filter: ActionFilter; detail: string }[] = [
    { label: "Overdue", count: counts.overdue, filter: "overdue", detail: "Past the agreed date" },
    { label: "Due today", count: counts.today, filter: "today", detail: "Today's commitments" },
    { label: "Next 7 days", count: counts.upcoming, filter: "upcoming", detail: "Tomorrow onwards" },
    { label: "Unassigned", count: counts.unassigned, filter: "unassigned", detail: "An owner is needed" },
  ];
  return <nav className="home-attention" aria-label="Action overview">
    {metrics.map(metric => <Link key={metric.filter} className={`home-metric ${metric.filter === "overdue" && metric.count > 0 ? "is-overdue" : ""}`} href={actionQueryHref({ scope, filter: metric.filter, page: 1, pageSize: 50 })} aria-label={`${metric.count} ${metric.label.toLowerCase()} ${metric.count === 1 ? "action" : "actions"}`}>
      <span className="home-metric-label">{metric.label}</span><strong>{metric.count}</strong><span className="home-metric-detail">{metric.detail}<span aria-hidden="true">↗</span></span>
    </Link>)}
  </nav>;
}
