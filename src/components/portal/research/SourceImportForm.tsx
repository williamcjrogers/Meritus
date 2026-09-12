"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import type { SourceSettings } from "@/lib/db/research-workflow";
import { PORTAL_IMPORT_FILE_BYTES } from "@/lib/research/import-limits";
import { DataTable, Panel, type Row } from "./ResearchControls";

type ImportPreview = {
  rows: Row[];
  errors: Row[];
  revision: number;
};

const inputClass = "mt-1 block app-field";
const stepClass = "space-y-4 border-t border-text/15 pt-5";
const importProviders = [
  "research-import",
  "commercial-import",
  "court-listings",
  "bailii",
];

export function SourceImportForm({
  sources,
  reload,
  onAddSource,
  onBusyChange,
}: {
  sources: SourceSettings[];
  reload: () => Promise<void>;
  onAddSource?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const helpId = useId();
  const [requestId] = useState(() => crypto.randomUUID());
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"preview" | "import" | null>(null);
  const [splitFile, setSplitFile] = useState(false);
  const revision = useRef(0);
  const requestInFlight = useRef(false);
  const eligibleSources = sources.filter((source) =>
    importProviders.includes(source.provider),
  );
  const canImport =
    preview !== null &&
    preview.errors.length === 0 &&
    preview.revision === revision.current;

  function invalidatePreview() {
    revision.current += 1;
    setPreview(null);
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestInFlight.current) return;
    const button = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const action = button?.value === "import" ? "import" : "preview";
    if (action === "import" && !canImport) {
      setMessage("Preview this file and correct any errors before starting the import.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || !file.name) {
      setMessage("Choose a CSV or JSON file to preview.");
      return;
    }
    if (file.size > PORTAL_IMPORT_FILE_BYTES) {
      setMessage("This file exceeds 4 MiB. Split larger CSV files into parts that each contain complete records before uploading.");
      return;
    }
    form.set("action", action);
    form.set("requestId", requestId);
    const submittedRevision = revision.current;
    if (action === "preview") setPreview(null);
    requestInFlight.current = true;
    setBusy(action);
    setMessage("");
    try {
      onBusyChange?.(true);
      const response = await fetch("/api/portal/research/imports", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(String(result.error ?? "Import failed").replaceAll("_", " "));
      if (action === "preview") {
        if (submittedRevision !== revision.current) return;
        if (!Array.isArray(result.rows) || !Array.isArray(result.errors))
          throw new Error("The file preview could not be read. Preview the file again.");
        setPreview({
          rows: result.rows,
          errors: result.errors,
          revision: submittedRevision,
        });
      } else if (result.investigationId) {
        window.location.assign(
          "/portal/research/investigations/" + result.investigationId,
        );
        await reload();
      } else {
        throw new Error("The import response did not include an investigation. Try starting the import again.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed. Try again.");
    } finally {
      requestInFlight.current = false;
      setBusy(null);
      onBusyChange?.(false);
    }
  }

  if (!eligibleSources.length) {
    return (
      <Panel title="Import a file">
        <div className="space-y-4 rounded border border-dashed border-text/25 bg-white/50 p-6">
          <p className="font-medium">Add a source before importing a file.</p>
          <p className="max-w-2xl text-[15px] text-muted">
            A source records where the file came from and your permission to use
            it. Choose a file import method when you add the source, then return
            here to upload its CSV or JSON file.
          </p>
          {onAddSource ? (
            <button type="button" onClick={onAddSource} className="rounded bg-primary px-4 py-2 text-[15px] text-surface">
              Add a source
            </button>
          ) : (
            <a href="/portal/research/sources" className="inline-block rounded bg-primary px-4 py-2 text-[15px] text-surface">
              Go to sources
            </a>
          )}
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Import a file">
      <p className="max-w-3xl text-[15px] text-muted">
        Upload a CSV or JSON file you are authorised to use. Check how its columns
        will be read, then start a separate research investigation.
      </p>
      <form noValidate onSubmit={submit} onChange={invalidatePreview} aria-busy={busy !== null} className="rounded border border-text/15 bg-white/60 p-5 sm:p-6">
        <fieldset disabled={busy !== null} className="min-w-0 space-y-6 disabled:opacity-70">
          <fieldset className="space-y-4">
            <legend className="mb-3 font-medium">1. Choose the source and file</legend>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-[15px] font-medium">
                Registered source
                <select name="sourceId" required className={inputClass} defaultValue="">
                  <option value="">Choose a source</option>
                  {eligibleSources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.label} ({source.status})
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[15px] font-medium">
                File format
                <select name="format" className={inputClass} defaultValue="csv">
                  <option value="csv">CSV spreadsheet</option>
                  <option value="json">JSON data</option>
                </select>
              </label>
              <label className="text-[15px] font-medium md:col-span-2">
                Research file
                <input type="file" name="file" accept=".csv,.json" required className={inputClass} aria-describedby={`${helpId}-file`} />
              </label>
            </div>
            <p id={`${helpId}-file`} className="text-[15px] text-muted">
              Maximum 4 MiB per file. Split larger CSV files into parts that each
              contain complete records before uploading.
            </p>
            <label className="flex items-start gap-2 text-[15px]">
              <input type="checkbox" checked={splitFile} onChange={(event) => setSplitFile(event.target.checked)} className="mt-1 size-4" />
              This file is one part of a larger, split file
            </label>
            {splitFile ? (
              <div className="grid gap-4 rounded border border-text/15 bg-primary/5 p-4 md:grid-cols-2">
                <label className="text-[15px] font-medium">
                  Total number of parts
                  <input name="partCount" type="number" min="2" max="10000" defaultValue="2" required className={inputClass} />
                </label>
                <label className="text-[15px] font-medium">
                  Part number (starts at 1)
                  <input name="partIndex" type="number" min="1" max="10000" defaultValue="1" required className={inputClass} />
                </label>
                <label className="text-[15px] font-medium md:col-span-2">
                  Original file hash
                  <input name="snapshotHash" pattern="[a-fA-F0-9]{64}" minLength={64} maxLength={64} required className={inputClass} aria-describedby={`${helpId}-snapshot`} />
                </label>
                <p id={`${helpId}-snapshot`} className="text-[15px] text-muted md:col-span-2">
                  Copy the 64-character snapshot hash from the file splitter&apos;s
                  manifest. Use the same hash for every part. Coverage remains
                  partial until all parts have been verified against that manifest.
                </p>
              </div>
            ) : (
              <>
                <input type="hidden" name="partCount" value="1" />
                <input type="hidden" name="partIndex" value="1" />
                <input type="hidden" name="snapshotHash" value="" />
              </>
            )}
          </fieldset>

          <fieldset className={stepClass}>
            <legend className="pr-3 font-medium">2. Describe the research</legend>
            <label className="block text-[15px] font-medium">
              Research question
              <textarea name="question" required rows={2} placeholder="What do you want to find out from this file?" className={`${inputClass} resize-none`} />
            </label>
            <label className="block text-[15px] font-medium">
              Public subject
              <input name="subject" required placeholder="The organisation being researched" className={inputClass} />
            </label>
          </fieldset>

          <fieldset className={stepClass}>
            <legend className="pr-3 font-medium">3. Match the file columns</legend>
            <p className="text-[15px] text-muted">
              Enter the exact column headings from your CSV, or field names from
              your JSON. The record ID identifies each item; the text is the
              material to research.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-[15px] font-medium">
                Record ID column
                <input name="id" required placeholder="e.g. record_id" className={inputClass} />
              </label>
              <label className="text-[15px] font-medium">
                Text column
                <input name="text" required placeholder="e.g. description" className={inputClass} />
              </label>
            </div>
            <details className="rounded border border-text/15 p-4">
              <summary className="cursor-pointer text-[15px] font-medium">Optional columns: title, company number, date and link</summary>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {[
                  ["title", "Title column"],
                  ["companyNumber", "Company number column"],
                  ["eventAt", "Event date column"],
                  ["url", "Source URL column"],
                ].map(([name, label]) => (
                  <label key={name} className="text-[15px] font-medium">
                    {label}
                    <input name={name} className={inputClass} />
                  </label>
                ))}
              </div>
            </details>
          </fieldset>

          <div className={stepClass}>
            <h3 className="font-medium">4. Preview, then start the import</h3>
            <p className="text-[15px] text-muted">
              The preview shows up to 250 records. Uploading a file does not prove
              that all of the publisher&apos;s records are covered.
            </p>
            <button type="submit" name="action" value="preview" disabled={busy !== null} className="rounded border border-primary px-4 py-2 text-[15px] disabled:cursor-wait disabled:opacity-50">
              {busy === "preview" ? "Checking file…" : "Preview file"}
            </button>
            {preview && (
              <div className="min-w-0 space-y-4">
                <p role="status" className={preview.errors.length ? "text-[15px] text-danger" : "text-[15px] font-medium text-primary"}>
                  {preview.errors.length
                    ? `${preview.errors.length} ${preview.errors.length === 1 ? "error needs" : "errors need"} correcting. Update the details, then preview again.`
                    : "No mapping errors found. Check the records below before starting the import."}
                </p>
                {preview.errors.length > 0 && (
                  <DataTable rows={preview.errors} columns={[
                    { key: "row", title: "Row" },
                    { key: "field", title: "Field" },
                    { key: "message", title: "Correction required" },
                  ]} />
                )}
                <DataTable rows={preview.rows} columns={Object.keys(preview.rows[0] ?? {}).map((key) => ({ key, title: key }))} empty="No records were returned in this preview." />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 border-t border-text/10 pt-4">
              <button type="submit" name="action" value="import" disabled={busy !== null || !canImport} className="rounded bg-primary px-4 py-2 text-[15px] text-surface disabled:cursor-not-allowed disabled:opacity-50">
                {busy === "import" ? "Starting import…" : "Start import"}
              </button>
              {!canImport && <p className="text-[15px] text-muted">A preview with no errors is required. Changing any detail requires a new preview.</p>}
            </div>
          </div>
        </fieldset>
        {message && <p role="alert" className="mt-4 text-[15px] text-danger">{message}</p>}
      </form>
    </Panel>
  );
}
