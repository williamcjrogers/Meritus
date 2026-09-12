"use client";

import { useEffect, useState } from "react";
import type { SourceSettings } from "@/lib/db/research-workflow";
import { ActionForm, api, date, dateTime, value, type Field, type Row } from "./ResearchControls";
import { SourceOverview } from "./SourceOverview";
import { SourceImportForm } from "./SourceImportForm";
import { SourceRegistrationForm } from "./SourceRegistrationForm";

const base = "/api/portal/research";
type View = "overview" | "import" | "add" | "licences" | "documents";
const field = (name: string, label: string, type: Field["type"] = "text", required = true, initial?: string): Field => ({ name, label, type, required, value: initial });

export function SourceSettingsForms({ sources, reload }: {
  sources: SourceSettings[];
  reload: () => Promise<void>;
}) {
  const [view, setView] = useState<View>("overview");
  const [opened, setOpened] = useState<Partial<Record<View, boolean>>>({ overview: true });
  const [rightsReady, setRightsReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [registrationSaved, setRegistrationSaved] = useState(false);
  const [rights, setRights] = useState<Row[]>([]);
  const [documents, setDocuments] = useState<Row[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState("");
  const [revision, setRevision] = useState(0);
  const [showAllDocuments, setShowAllDocuments] = useState(false);
  const needsRecords = view === "add" || view === "licences" || view === "documents";

  useEffect(() => {
    if (!needsRecords) return;
    let active = true;
    setRecordsLoading(true);
    setRecordsError("");
    api<Row[]>(`${base}/${view === "documents" ? "documents" : "rights"}`)
      .then(rows => {
        if (!active) return;
        if (view === "documents") setDocuments(rows);
        else { setRights(rows); setRightsReady(true); }
      })
      .catch(error => { if (active) setRecordsError(error instanceof Error ? error.message : "These records could not be loaded."); })
      .finally(() => { if (active) setRecordsLoading(false); });
    return () => { active = false; };
  }, [view, needsRecords, revision]);

  const save = async (path: string, body: unknown, method = "POST") => {
    setPending(true);
    setRefreshError("");
    try {
      const result = await api(`${base}/${path}`, body, method);
      if (path === "sources") setRegistrationSaved(true);
      try {
        await reload();
        if (view === "licences" || view === "add") setRights(await api<Row[]>(`${base}/rights`));
        if (view === "documents") setDocuments(await api<Row[]>(`${base}/documents`));
      } catch {
        setRefreshError("Your change was saved, but the latest records could not be refreshed. Reopen this section to load them again.");
      }
      return result;
    } finally { setPending(false); }
  };
  const choose = (next: View) => {
    if (next === view || pending) return;
    setRecordsLoading(true);
    setRecordsError("");
    setView(next);
    setOpened(previous => ({ ...previous, ...(view === "add" && registrationSaved ? { add: false } : {}), [next]: true }));
    if (view === "add" && registrationSaved) setRegistrationSaved(false);
  };
  const taskButton = (target: View, text: string) => (
    <button type="button" disabled={pending} aria-pressed={view === target} onClick={() => choose(target)} className={`min-h-11 rounded px-4 py-2.5 text-sm font-medium disabled:opacity-50 ${view === target ? "bg-green text-cream" : "border border-ink/20 bg-white/50 hover:bg-white"}`}>{text}</button>
  );

  return (
    <div className="space-y-7">
      <div aria-label="Source tasks" className="flex flex-wrap items-start gap-2">
        {taskButton("overview", "Source overview")}
        {taskButton("import", "Import a file")}
        {taskButton("add", "Add a source")}
        <details className="group relative sm:ml-auto">
          <summary className={`min-h-11 cursor-pointer rounded px-4 py-2.5 text-sm ${view === "licences" || view === "documents" ? "bg-green/10 font-medium" : "text-ink/75"}`}>Administration</summary>
          <div className="absolute right-0 z-10 mt-2 w-64 space-y-1 rounded border border-ink/20 bg-cream p-2 shadow-lg">
            <button type="button" onClick={event => { choose("licences"); event.currentTarget.closest("details")?.removeAttribute("open"); }} className="block w-full rounded p-3 text-left text-sm hover:bg-green/5">Licences and permissions</button>
            <button type="button" onClick={event => { choose("documents"); event.currentTarget.closest("details")?.removeAttribute("open"); }} className="block w-full rounded p-3 text-left text-sm hover:bg-green/5">Document checks</button>
          </div>
        </details>
      </div>

      {refreshError && <p role="status" className="rounded border border-amber-200 bg-amber-50 p-4 text-sm">{refreshError}</p>}
      <div hidden={view !== "overview"}><SourceOverview sources={sources} save={save} busy={pending} /></div>
      <div hidden={view !== "import"}>{opened.import && <SourceImportForm sources={sources} reload={reload} onAddSource={() => choose("add")} onBusyChange={setPending} />}</div>
      <div hidden={view !== "add"}>{opened.add && rightsReady && <SourceRegistrationForm rights={rights} save={save} onRecordLicence={() => choose("licences")} onComplete={() => choose("overview")} />}</div>
      {needsRecords && recordsLoading && <p role="status">Loading {view === "documents" ? "document records" : "licences and permissions"}…</p>}
      {needsRecords && recordsError && <div role="alert" className="rounded border border-amber-200 bg-amber-50 p-4"><p>{recordsError}</p><button type="button" className="mt-2 underline" onClick={() => setRevision(revision + 1)}>Try again</button></div>}
      <div hidden={view !== "licences"}>
        {opened.licences && rightsReady && <section className="space-y-5" aria-labelledby="source-licences-title">
          <div><h2 id="source-licences-title" className="font-serif text-2xl">Licences and permissions</h2><p className="mt-2 max-w-3xl text-sm text-ink/75">The permissions already recorded for your sources. Add a record only when using material covered by a new licence or set of terms.</p></div>
          {!rights.length && <p className="rounded border border-dashed border-ink/25 p-5">No permissions have been recorded yet. Add the relevant licence or reuse terms below before registering a source.</p>}
          {rights.map(right => <details key={String(right.id)} className="rounded border border-ink/15 bg-white/60 p-5">
            <summary className="cursor-pointer"><span className="font-medium text-green">{String(right.holder)}</span><span className="mt-1 block text-sm text-ink/75">{String(right.material)}</span></summary>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <div className="sm:col-span-2"><dt className="font-medium">Permitted use</dt><dd className="mt-1 text-ink/75">{String(right.purpose)}</dd></div>
              <div className="sm:col-span-2"><dt className="font-medium">Agreement or terms</dt><dd className="mt-1 break-words text-ink/75">{String(right.agreement_ref)}</dd></div>
              <div><dt className="font-medium">Effective from</dt><dd>{date(right.effective_at)}</dd></div><div><dt className="font-medium">Expires</dt><dd>{date(right.expires_at)}</dd></div>
            </dl>
          </details>)}
          <details className="rounded border border-ink/20 p-5">
            <summary className="cursor-pointer font-medium">Add a licence or permission</summary>
            <div className="mt-5"><ActionForm title="Record permission to use a source" button="Save permission" fields={[
              field("holder", "Licence holder", "text", true, "Quantum Commercial Solutions Limited"),
              field("material", "What material does it cover?"),
              field("purpose", "What use is permitted?", "textarea"),
              field("agreementRef", "Agreement name or terms reference"),
              { ...field("agreementText", "Agreement or terms text", "textarea"), hint: "Paste the relevant text so this record can be checked against the agreement later." },
              field("effectiveAt", "Effective from", "datetime-local"),
              field("expiresAt", "Expiry, if applicable", "datetime-local", false),
              field("transferConditions", "Conditions on sharing or transfer", "textarea", false),
              field("retentionInstructions", "How long may the material be kept?", "textarea", false),
              field("withdrawalInstructions", "What must happen if material is withdrawn?", "textarea", false),
              field("useAssessment", "How the intended research fits this permission", "textarea"),
            ]} submit={values => save("rights", { ...values, effectiveAt: dateTime(values, "effectiveAt"), expiresAt: dateTime(values, "expiresAt") })} /></div>
          </details>
        </section>}
      </div>
        {view === "documents" && !recordsLoading && !recordsError && <section aria-labelledby="source-documents-title" className="space-y-5">
          <div><h2 id="source-documents-title" className="font-serif text-2xl">Document checks</h2><p className="mt-2 max-w-3xl text-sm text-ink/75">Review documents that are unavailable. Authorising a new check does not restore withdrawn text; the publisher must provide a fresh version first.</p></div>
          <p className="text-sm text-ink/70">Showing up to 200 recently updated document records. This is not a count of the full research collection.</p>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showAllDocuments} onChange={event => setShowAllDocuments(event.target.checked)} />Include available documents</label>
          {!documents.some(document => showAllDocuments || document.status !== "available") && <p className="rounded border border-green/20 bg-white/60 p-5">No unavailable documents in the records shown.</p>}
          {documents.filter(document => showAllDocuments || document.status !== "available").map(document => <article key={String(document.id)} className="space-y-3 rounded border border-ink/15 bg-white/60 p-5">
            <p className="font-medium">{String(document.source)}</p>
            <p className="break-all text-sm text-ink/75">{String(document.canonical_url || document.provider_id)}</p>
            <p className="text-sm">{String(document.status).replaceAll("_", " ")}{document.withdrawal_reason ? `: ${String(document.withdrawal_reason)}` : ""}</p>
            {document.status !== "available" && <details><summary className="cursor-pointer text-sm font-medium underline">Request a fresh publisher check</summary><div className="mt-4"><ActionForm title="Reason for a new check" button="Authorise fresh retrieval" fields={[{ ...field("reason", "Evidence and reason for checking again", "textarea"), hint: "Explain what has changed and give supporting evidence (at least 20 characters)." }]} submit={values => save(`documents/${document.id}/reinstate`, { reason: value(values, "reason") })} /></div></details>}
          </article>)}
        </section>}
    </div>
  );
}
