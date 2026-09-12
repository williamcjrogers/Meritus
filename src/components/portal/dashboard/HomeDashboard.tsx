"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { displayDate } from "@/lib/actions/dates";
import { actionQueryHref } from "@/lib/actions/filters";
import { completeDeskAction } from "@/lib/actions/server";
import type { ActionView, WorkLink } from "@/lib/actions/types";
import type { DashboardView } from "@/lib/dashboard/types";
import { ActionEditor } from "@/components/portal/actions/ActionEditor";
import { ActionRow } from "@/components/portal/actions/ActionRow";
import { ScopeControl } from "./ScopeControl";
import { AttentionSummary } from "./AttentionSummary";
import { Agenda } from "./Agenda";
import { TeamAccountability } from "./TeamAccountability";
import { ContextSummary, LiveLeadSummary } from "./ContextSummary";
import { ProgressFeed } from "./ProgressFeed";
import { SectionFailure } from "./SectionFailure";

export function HomeDashboard({ view }: { view: DashboardView }) {
  const router = useRouter();
  const [editor, setEditor] = useState<{ action: ActionView | null; link: WorkLink } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const actionsHref = actionQueryHref({ scope: view.scope, filter: "open", page: 1, pageSize: 50 });
  async function complete(action: ActionView, requestId = crypto.randomUUID()) {
    const result = await completeDeskAction(action.id, action.version, requestId);
    if (result.ok) { setError(null); router.refresh(); }
    else { setError(result.error); }
    return result;
  }
  return <div className="home-dashboard">
    <header className="home-header"><div><p className="home-intro">Directors&apos; overview</p><h1>Home</h1><p>{displayDate(view.today)} <span aria-hidden="true">·</span> {view.scope === "team" ? "The team's commitments at a glance" : "Your assigned work at a glance"}</p></div><div className="home-header-controls"><ScopeControl scope={view.scope} /><button className="home-primary-button" type="button" onClick={() => setEditor({ action: null, link: { kind: "general" } })}>+ Add action</button></div></header>
    <AttentionSummary result={view.actions} scope={view.scope} />
    <div className="home-work-grid">
      <section className="home-action-section" aria-labelledby="attention-heading"><div className="home-section-heading"><div><h2 id="attention-heading">Actions requiring attention</h2><p>Overdue, due today and the next 7 days</p></div><Link href={actionsHref}>View all actions <span aria-hidden="true">↗</span></Link></div>
        {error && <p role="alert" className="home-warning">{error}</p>}
        {!view.actions.ok ? <SectionFailure error={view.actions.error} /> : view.actions.data.rows.length === 0 ? <div className="home-empty"><p>No dated actions require attention in this window.</p><Link href={actionsHref}>{view.actions.data.counts.open > 0 ? `Review ${view.actions.data.counts.open} open actions` : "Add the next commitment"}</Link></div> : <ul className="home-action-list">{view.actions.data.rows.map(action => <ActionRow key={action.id} action={action} today={view.today} onEdit={() => setEditor({ action, link: action.link })} onComplete={complete} />)}</ul>}
      </section>
      <Agenda result={view.agenda} onAddAction={id => setEditor({ action: null, link: { kind: "calendar", id } })} />
    </div>
    <section className="home-commitments" aria-labelledby="commitments-heading"><div><h2 id="commitments-heading">Close the gaps</h2><p>Make the next commitment clear.</p></div><div className="home-gap-items">
      {view.actions.ok && <>
        {view.scope === "mine" && <Link href={actionQueryHref({ scope: "team", filter: "unassigned", page: 1, pageSize: 50 })}>Team-wide unassigned actions <strong>{view.actions.data.unassignedTeam}</strong></Link>}
        <Link href={actionQueryHref({ scope: view.scope, filter: "undated", page: 1, pageSize: 50 })}><strong>{view.actions.data.counts.undated}</strong> {view.actions.data.counts.undated === 1 ? "action" : "actions"} without a due date</Link>
      </>}
      {!view.leads.ok ? <SectionFailure error={view.leads.error} /> : <><p><strong>{view.leads.data.withoutOwner}</strong> live leads without an owner · <strong>{view.leads.data.withoutAction}</strong> without an open action</p>{view.leads.data.exceptionRows.map(lead => <Link key={lead.id} href={`/portal/pursuits/${encodeURIComponent(lead.id)}`}>{lead.firm} needs {lead.missingOwner && lead.missingAction ? "an owner and a next action" : lead.missingOwner ? "an owner" : "a next action"} <span aria-hidden="true">↗</span></Link>)}</>}
    </div></section>
    <div className="home-context-grid"><TeamAccountability result={view.team} /><LiveLeadSummary result={view.leads} /></div>
    <ContextSummary view={view} />
    <ProgressFeed result={view.progress} />
    <p className="home-refreshed">Updated {new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(view.refreshedAt))} London time</p>
    {editor && <ActionEditor action={editor.action} link={editor.link} directory={view.directory} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); router.refresh(); }} />}
  </div>;
}
