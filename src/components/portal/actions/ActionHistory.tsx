"use client";
import { useEffect, useState } from "react";
import { loadDeskActionHistory } from "@/lib/actions/server";
import { displayDate } from "@/lib/actions/dates";
import type { DirectorDirectory } from "@/lib/portal/directors";
import { actionStateLabels } from "./ActionRow";
import type { ActionEvent } from "@/lib/actions/types";
const labels: Record<ActionEvent["kind"], string> = { imported: "Imported", created: "Created", updated: "Updated", completed: "Completed", reopened: "Reopened", cancelled: "Cancelled", detached: "Retained as standalone", primary_selected: "Selected as next action" };
export function ActionHistory({ id, version, directory }: { id: string; version: number; directory?: DirectorDirectory }) {
  const ownerName = (ownerId: string | null) => ownerId ? directory?.directors.find(person => person.id === ownerId)?.name ?? "Assigned, name unavailable" : "Unassigned";
  const [events, setEvents] = useState<ActionEvent[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { let active = true; setError(false); setEvents(null); loadDeskActionHistory(id).then(rows => { if (active) setEvents(rows); }).catch(() => { if (active) setError(true); }); return () => { active = false; }; }, [id, version, attempt]);
  return <section className="action-history" aria-label="Action history"><h3>History</h3>{error ? <p role="alert">Could not load history. <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry</button></p> : events === null ? <p role="status">Loading history…</p> : events.length === 0 ? <p>No history recorded.</p> : <ol>{events.map(event => <li key={event.id}><strong>{labels[event.kind]}</strong> by {event.actorName}<p><time dateTime={event.createdAt}>{new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(event.createdAt))} London time</time></p>{event.before?.dueDate !== event.after.dueDate && <p>Due date: {event.before?.dueDate ? displayDate(event.before.dueDate) : "No due date"} → {event.after.dueDate ? displayDate(event.after.dueDate) : "No due date"}</p>}{event.before && event.before.ownerId !== event.after.ownerId && <p>Assignee: {ownerName(event.before.ownerId)} → {ownerName(event.after.ownerId)}</p>}{event.before && event.before.state !== event.after.state && <p>Status: {actionStateLabels[event.before.state]} → {actionStateLabels[event.after.state]}</p>}{event.reason && <p>{event.reason}</p>}</li>)}</ol>}</section>;
}
