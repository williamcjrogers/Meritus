"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionEditor } from "./ActionEditor";
import { ActionRow, actionStateLabels } from "./ActionRow";
import { completeDeskAction } from "@/lib/actions/server";
import { actionQueryHref } from "@/lib/actions/filters";
import { displayDate, dateWindow } from "@/lib/actions/dates";
import type { ActionFilter, ActionQuery, ActionView, WorkLink } from "@/lib/actions/types";
import type { DirectorDirectory } from "@/lib/portal/directors";
const filters: [ActionFilter, string][] = [["open", "Open"], ["overdue", "Overdue"], ["today", "Due today"], ["upcoming", "Next 7 days"], ["unassigned", "Unassigned"], ["undated", "No due date"], ["completed_recent", "Recently completed"], ["all", "All"]];
export function ActionRegister({ rows, total, query, directory, now, initialAction = null, initialActionError = null }: { initialAction?: ActionView | null; initialActionError?: string | null; rows: ActionView[]; total: number; query: ActionQuery; directory: DirectorDirectory; now: string }) {
  const router = useRouter();
  const [related, setRelated] = useState<WorkLink | undefined>(query.link);
  const relatedOptions = new Map<string, { link: WorkLink; label: string }>();
  relatedOptions.set(JSON.stringify({ kind: "general" }), { link: { kind: "general" }, label: "Standalone" });
  if (query.link && query.link.kind !== "general") relatedOptions.set(JSON.stringify(query.link), { link: query.link, label: rows.find(row => JSON.stringify(row.link) === JSON.stringify(query.link))?.relatedLabel ?? "Current related record" });
  for (const row of rows) if (row.link.kind !== "general") relatedOptions.set(JSON.stringify(row.link), { link: row.link, label: row.relatedLabel });
  const [editor, setEditor] = useState<{ action: ActionView | null; link: WorkLink } | null>(() => initialAction ? { action: initialAction, link: initialAction.link } : null);
  function closeEditor() { setEditor(null); if (initialAction) router.replace(actionQueryHref(query), { scroll: false }); }
  async function complete(action: ActionView, requestId?: string) { const result = await completeDeskAction(action.id, action.version, requestId ?? crypto.randomUUID()); if (result.ok) router.refresh(); return result; }
  return <section aria-labelledby="actions-title" className="action-register">
    <header><div><h1 id="actions-title">Actions</h1><p>{displayDate(dateWindow(new Date(now)).today)} · London dates</p></div><button type="button" onClick={() => setEditor({ action: null, link: { kind: "general" } })}>Add action</button></header>
    {initialActionError && <p role="alert" className="action-error">{initialActionError}</p>}
    <nav aria-label="Action views">{filters.map(([filter, label]) => <Link key={filter} aria-current={query.filter === filter ? "page" : undefined} href={actionQueryHref({ ...query, filter, page: 1 })}>{label}</Link>)}</nav>
    <form method="get" action="/portal/actions" className="action-filters"><input type="hidden" name="filter" value={query.filter} /><label>Scope<select name="scope" defaultValue={query.scope}><option value="team">Team overview</option><option value="mine">My work</option></select></label><label>Owner<select name="owner" defaultValue={query.ownerId === null ? "unassigned" : query.ownerId ?? ""}><option value="">All owners</option><option value="unassigned">Unassigned</option>{query.ownerId && !directory.directors.some(person => person.id === query.ownerId) && <option value={query.ownerId}>Assigned, name unavailable</option>}{directory.directors.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label>Status<select name="state" defaultValue={query.state ?? ""}><option value="">All statuses</option>{Object.entries(actionStateLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Related work<select value={related ? JSON.stringify(related) : ""} onChange={event => setRelated(event.target.value ? relatedOptions.get(event.target.value)?.link : undefined)}><option value="">All related work</option>{Array.from(relatedOptions.entries()).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>{related && <input type="hidden" name="link" value={related.kind} />}{related && related.kind !== "general" && <input type="hidden" name="linkId" value={related.id} />}<button type="submit">Apply filters</button><Link href="/portal/actions">Clear filters</Link></form>
    <p>{total} {total === 1 ? "action" : "actions"} in this view</p><ul className="action-list">{rows.map(action => <ActionRow key={action.id} now={now} action={action} onEdit={value => setEditor({ action: value, link: value.link })} onComplete={complete} />)}</ul>
    {rows.length === 0 && <p>No actions match these filters. Change the filters or add an action.</p>}
    <nav aria-label="Action pages">{query.page > 1 && <Link href={actionQueryHref({ ...query, page: query.page - 1 })}>Previous page</Link>}<span>Page {query.page} of {Math.max(1, Math.ceil(total / query.pageSize))}</span>{query.page * query.pageSize < total && <Link href={actionQueryHref({ ...query, page: query.page + 1 })}>Next page</Link>}</nav>
    {editor && <ActionEditor action={editor.action} link={editor.link} directory={directory} onClose={closeEditor} onSaved={() => { closeEditor(); router.refresh(); }} />}
  </section>;
}
