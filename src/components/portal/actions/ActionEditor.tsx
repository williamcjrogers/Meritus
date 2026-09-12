"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SlideOver } from "../SlideOver";
import { ActionHistory } from "./ActionHistory";
import { actionStateLabels } from "./ActionRow";
import { actionIssue, isOpenAction } from "@/lib/actions/model";
import { displayDate } from "@/lib/actions/dates";
import { detachDeskAction, saveDeskAction, selectPrimaryAction } from "@/lib/actions/server";
import type { ActionDraft, ActionSaveResult, ActionState, ActionView, WorkLink } from "@/lib/actions/types";
import type { DirectorDirectory } from "@/lib/portal/directors";
type ConflictIntent = "save" | "reopen" | "primary" | "detach";
function draftFor(action: ActionView | null): ActionDraft { return { title: action?.title ?? "", description: action?.description ?? "", ownerId: action?.ownerId ?? null, dueDate: action?.dueDate ?? null, state: action?.state ?? "todo", stateReason: action?.stateReason ?? "", changeReason: "", saveUnassigned: false }; }
export function ActionEditor({ action, link, directory, onClose, onSaved }: { action: ActionView | null; link: WorkLink; directory: DirectorDirectory; onClose: () => void; onSaved: (action: ActionView) => void }) {
  const router = useRouter();
  const [base, setBase] = useState(action);
  const [draft, setDraft] = useState(() => draftFor(action));
  const [id] = useState(() => action?.id ?? crypto.randomUUID());
  const [initialRequestId] = useState(() => crypto.randomUUID());
  const request = useRef<{ fingerprint: string; id: string } | null>({ fingerprint: "", id: initialRequestId });
  const [openingTrigger] = useState(() => typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const attemptedDraft = useRef<ActionDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ActionView | null>(null);
  const [conflictIntent, setConflictIntent] = useState<ConflictIntent>("save");
  const [reviewed, setReviewed] = useState(false);
  const [confirmDetach, setConfirmDetach] = useState(false);
  useEffect(() => () => { openingTrigger?.focus(); }, [openingTrigger]);
  function update(patch: Partial<ActionDraft>) { setDraft(current => ({ ...current, ...patch })); }
  function requestId(fingerprint: string) { if (request.current?.fingerprint === "") { request.current.fingerprint = fingerprint; return request.current.id; } if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() }; return request.current.id; }
  function failure(result: Exclude<ActionSaveResult, { ok: true }>, intent: ConflictIntent) { setError(result.error); if (result.code === "conflict") { setConflict(result.current); setConflictIntent(intent); setReviewed(false); } }
  async function save(local = draft, current = base, reopening = false) {
    if (busy) return;
    attemptedDraft.current = local;
    const issue = actionIssue(local, current); if (issue) { setError(issue); return; }
    const input = { id, expectedVersion: current?.version ?? 0, link: current?.link ?? link, draft: local };
    setBusy(true); setError(null);
    try { const result = await saveDeskAction({ ...input, requestId: requestId(JSON.stringify(input)) }); if (result.ok) { request.current = null; setConflict(null); router.refresh(); if (reopening) { setBase(result.action); setDraft(draftFor(result.action)); } else onSaved(result.action); } else failure(result, reopening ? "reopen" : "save"); }
    catch { setError("Could not save the action. Your changes have been kept. Please try again."); }
    finally { setBusy(false); }
  }
  async function operation(kind: "primary" | "detach", current = base) {
    if (!current || busy) return; setBusy(true); setError(null);
    try { const result = await (kind === "primary" ? selectPrimaryAction : detachDeskAction)(current.id, current.version, requestId(`${kind}:${current.id}:${current.version}`)); if (result.ok) { router.refresh(); onSaved(result.action); } else failure(result, kind); }
    catch { setError("Could not update the action. Please try again."); } finally { setBusy(false); }
  }
  const closed = base && !isOpenAction(base);
  const missingOwner = draft.ownerId && !directory.directors.some(person => person.id === draft.ownerId);
  return <SlideOver open title={action ? "Action details" : "Add action"} onClose={() => { if (!busy) onClose(); }} width={580}>
    <form className="action-editor" onSubmit={event => { event.preventDefault(); void save(); }}>
      <p>{base?.relatedLabel ?? (link.kind === "general" ? "Standalone action" : `Linked to ${link.kind}`)}</p>
      {base?.retainedContext && <p>Retained context: {base.retainedContext}</p>}
      {closed ? <><h3>{base.title}</h3><p>{actionStateLabels[base.state]}</p><p>{base.description}</p><button type="button" disabled={busy} onClick={() => save({ ...draftFor(base), state: "todo", stateReason: "", saveUnassigned: !base.ownerId }, base, true)}>Reopen action</button></> : <fieldset disabled={busy}>
        <label>Action<input value={draft.title} onChange={event => update({ title: event.target.value })} maxLength={240} /></label>
        <label>Assignee<select value={draft.ownerId ?? ""} disabled={!directory.available} onChange={event => update({ ownerId: event.target.value || null })}><option value="">Unassigned</option>{missingOwner && <option value={draft.ownerId!}>Assigned, name unavailable</option>}{directory.directors.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
        {!directory.available && <p>Director directory unavailable. Existing assignment is retained.</p>}
        {base?.suggestedOwnerId && !base.ownerId && <p>Imported action: confirm the suggested assignee. {directory.directors.find(person => person.id === base.suggestedOwnerId)?.name ?? "Suggested name unavailable"}{directory.available && directory.directors.some(person => person.id === base.suggestedOwnerId) && <button type="button" onClick={() => update({ ownerId: base.suggestedOwnerId })}>Use suggested assignee</button>}</p>}
        <label>Due date<input type="date" value={draft.dueDate ?? ""} onChange={event => update({ dueDate: event.target.value || null })} /></label>
        {base && <p>Original due date: {base.originalDueDate ? displayDate(base.originalDueDate) : "No due date"}</p>}
        <label>Status<select value={draft.state} onChange={event => update({ state: event.target.value as ActionState })}>{Object.entries(actionStateLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {(draft.state === "waiting" || draft.state === "cancelled") && <label>Reason<textarea value={draft.stateReason} onChange={event => update({ stateReason: event.target.value })} maxLength={1000} /></label>}
        {base && (base.dueDate !== draft.dueDate || (reviewed && conflict && conflict.dueDate !== draft.dueDate)) && <label>Reason for changing the due date<textarea value={draft.changeReason} onChange={event => update({ changeReason: event.target.value })} maxLength={1000} /></label>}
        <label>Description<textarea value={draft.description} onChange={event => update({ description: event.target.value })} maxLength={4000} /></label>
        <div className="action-editor-buttons"><button type="submit">{busy ? "Saving action" : "Save action"}</button>{!draft.ownerId && <button type="button" onClick={() => save({ ...draft, saveUnassigned: true })}>Save as unassigned</button>}</div>
      </fieldset>}
      {error && <p role="alert" className="action-error">{error}</p>}
      {conflict && <div className="action-conflict"><p>Your draft has been kept.</p><button type="button" onClick={() => setReviewed(true)}>Review current record</button>{reviewed && <><h3>Current record, version {conflict.version}</h3><p>{conflict.title}</p><p>{conflict.ownerName} · {conflict.dueDate ? displayDate(conflict.dueDate) : "No due date"} · {actionStateLabels[conflict.state]}</p><p>{conflict.description}</p>{conflict.stateReason && <p>{conflict.stateReason}</p>}<button type="button" disabled={busy} onClick={() => { setBase(conflict); setDraft(draftFor(conflict)); setConflict(null); setError(null); request.current = null; }}>Use current record</button>{(conflictIntent === "primary" || conflictIntent === "detach") && <p>{conflictIntent === "primary" ? "Make the current record the next action." : "Retain the current record as standalone work."} Its recorded details will be preserved.</p>}<button type="button" disabled={busy || ((conflictIntent === "save" || conflictIntent === "primary") && !isOpenAction(conflict))} onClick={() => { if (conflictIntent === "primary" || conflictIntent === "detach") void operation(conflictIntent, conflict); else if (conflictIntent === "reopen") void save({ ...draftFor(conflict), state: "todo", stateReason: "", saveUnassigned: !conflict.ownerId }, conflict, true); else void save({ ...draft, saveUnassigned: attemptedDraft.current?.saveUnassigned ?? draft.saveUnassigned }, conflict); }}>Apply my changes</button></>}</div>}
      {base?.link.kind === "pursuit" && isOpenAction(base) && !base.isPrimary && <button type="button" disabled={busy} onClick={() => operation("primary")}>Make next action</button>}
      {base && base.link.kind !== "general" && <><button type="button" disabled={busy} onClick={() => setConfirmDetach(true)}>Retain as standalone</button>{confirmDetach && <div><p>Remove this action from {base.relatedLabel}? Its linked context and history will be retained.</p><button type="button" disabled={busy} onClick={() => operation("detach")}>Confirm retain as standalone</button><button type="button" onClick={() => setConfirmDetach(false)}>Keep linked</button></div>}</>}
      <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
    </form>
    {base && <ActionHistory id={base.id} version={base.version} directory={directory} />}
  </SlideOver>;
}
