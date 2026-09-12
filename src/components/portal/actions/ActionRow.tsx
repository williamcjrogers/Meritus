"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { dateWindow, displayDate } from "@/lib/actions/dates";
import { isOpenAction } from "@/lib/actions/model";
import type { ActionSaveResult, ActionState, ActionView } from "@/lib/actions/types";

export const actionStateLabels: Record<ActionState, string> = { todo: "To do", in_progress: "In progress", waiting: "Waiting", completed: "Completed", cancelled: "Cancelled" };
export function ActionRow({ action, onEdit, onComplete, now, today: suppliedToday }: { today?: string; now?: string; action: ActionView; onEdit: (action: ActionView) => void; onComplete: (action: ActionView, requestId?: string) => Promise<ActionSaveResult | void> | void }) {
  const today = suppliedToday ?? dateWindow(new Date(now ?? Date.now())).today;
  const timing = isOpenAction(action) && action.dueDate ? action.dueDate < today ? "Overdue" : action.dueDate === today ? "Due today" : null : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<{ version: number; id: string } | null>(null);
  async function complete() {
    if (busy) return;
    if (request.current?.version !== action.version) request.current = { version: action.version, id: crypto.randomUUID() };
    setBusy(true); setError(null);
    try {
      const result = await onComplete(action, request.current!.id);
      if (result && !result.ok) setError(result.error);
      else request.current = null;
    } catch { setError("Could not complete the action. Please try again."); }
    finally { setBusy(false); }
  }
  return <li className="action-row">
    <div className="action-row-work"><button type="button" className="action-title" onClick={() => onEdit(action)}>{action.title}</button>{action.relatedHref ? <Link className="action-related" href={action.relatedHref}>{action.relatedLabel}</Link> : <span className="action-related">{action.relatedLabel}</span>}</div>
    <span className="action-owner">{action.ownerName}</span>
    <span className="action-date">{action.dueDate ? <time dateTime={action.dueDate}>{displayDate(action.dueDate)}</time> : "No due date"}{timing && <span className={`action-timing action-timing-${timing.toLowerCase().replace(" ", "-")}`}>{timing}</span>}</span>
    <span className={`action-state action-state-${action.state}`}>{actionStateLabels[action.state]}</span>
    {isOpenAction(action) && <button type="button" className="action-complete" aria-label={`Complete action: ${action.title}`} disabled={busy} onClick={complete}>{busy ? "Saving…" : "Complete"}</button>}
    {error && <p className="action-error" role="alert">{error}</p>}
  </li>;
}
