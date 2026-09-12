"use client";

import { useId, useState, type ComponentProps, type FormEvent } from "react";
import { date, type Row } from "./ResearchControls";

const sourceTypes = [
  { value: "publications", label: "A publication on a website" },
  { value: "building-safety", label: "Building Safety Regulator publication" },
  { value: "research-import", label: "A research file (CSV or JSON)" },
  { value: "commercial-import", label: "A file from a commercial data provider" },
  { value: "court-listings", label: "Court listings supplied under an agreement" },
  { value: "bailii", label: "BAILII material approved for reuse" },
];

const inputClass = "w-full rounded border border-ink/25 bg-white p-2";

function Input({ label, hint, ...props }: ComponentProps<"input"> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      <input id={id} {...props} aria-describedby={hint ? `${id}-hint` : undefined} className={inputClass} />
      {hint && <p id={`${id}-hint`} className="mt-1 text-xs text-ink/65">{hint}</p>}
    </div>
  );
}

export function SourceRegistrationForm({ rights, save, onRecordLicence, onComplete }: {
  rights: Row[];
  save: (path: string, body: unknown, method?: string) => Promise<unknown>;
  onRecordLicence: () => void;
  onComplete?: () => void;
}) {
  const [provider, setProvider] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const isPublication = provider === "publications";
  const hasPublicationUrl = isPublication || provider === "building-safety";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || saved) return;
    setError("");
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    if (!rights.some((right) => String(right.id) === text("rightsId"))) {
      setError("Choose a recorded licence or permission before adding this source.");
      return;
    }
    const cadenceSeconds = Number(text("cadenceHours")) * 3600;
    const dailyPence = Math.round(Number(text("dailyPounds")) * 100);
    const dailyRequests = Number(text("dailyRequests"));
    const dailyTokens = Number(text("dailyTokens"));
    if (!Number.isSafeInteger(cadenceSeconds) || cadenceSeconds <= 0) {
      setError("Enter a refresh interval greater than zero, equivalent to a whole number of seconds.");
      return;
    }
    if (![dailyPence, dailyRequests, dailyTokens].every((number) => Number.isSafeInteger(number) && number >= 0)) {
      setError("Enter valid daily limits of zero or more. Request and AI text limits must be whole numbers.");
      return;
    }
    setBusy(true);
    try {
      await save("sources", {
        label: text("label"),
        provider,
        hosts: [text("host").toLowerCase()],
        accessMethod: hasPublicationUrl ? "public_https" : "licensed_import",
        termsUrl: text("termsUrl"),
        termsVersion: text("termsVersion"),
        termsReviewedAt: new Date().toISOString(),
        attribution: text("attribution"),
        operator: "QCS",
        purpose: text("purpose"),
        rightsId: text("rightsId"),
        credentialRef: null,
        status: "paused",
        selection: isPublication
          ? { url: text("url"), kind: text("publicationKind"), subjectId: text("subjectId") }
          : provider === "building-safety"
            ? { publicationUrl: text("url") }
            : {},
        backfillStart: new Date(text("backfillStart")).toISOString(),
        cadenceSeconds,
        freshnessSeconds: cadenceSeconds * 2,
        requestLimit: 10,
        windowSeconds: 60,
        dailyRequests,
        dailyTokens,
        dailyPence,
      });
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The source could not be added. Your entries have been kept.");
    } finally {
      setBusy(false);
    }
  }

  if (saved) return (
    <section className="space-y-4 rounded border border-green/25 bg-green/5 p-6">
      <h2 className="font-serif text-2xl">Source added</h2>
      <p role="status">Your source is paused. Open its settings in the source overview and enable it when you are ready to use it.</p>
      {onComplete && <button type="button" onClick={onComplete} className="rounded bg-green px-4 py-2 text-sm text-cream">View source overview</button>}
    </section>
  );

  return (
    <form onSubmit={submit} className="space-y-6 rounded border border-ink/15 bg-white/60 p-5 md:p-6" aria-label="Add a research source">
      <div className="space-y-2">
        <h2 className="font-serif text-2xl">Add a research source</h2>
        <p className="text-sm text-ink/65">Register a publication or a provider whose files you can use for research. New sources stay paused until you enable them.</p>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">What are you adding?</span>
        <select name="provider" value={provider} onChange={(event) => setProvider(event.target.value)} required className={inputClass}>
          <option value="">Choose a source type</option>
          {sourceTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
        </select>
      </label>
      {provider && <>
        {!hasPublicationUrl && <p className="rounded bg-green/5 p-3 text-sm">This registers the file provider. Once the source is enabled, use Upload a file to preview the data and start an investigation.</p>}
        <fieldset className="grid gap-4 md:grid-cols-2">
          <legend className="mb-4 text-base font-medium">Source details</legend>
          <Input label="Source name" name="label" required maxLength={200} placeholder="For example, Example plc annual accounts" />
          <Input label="Publisher website domain" name="host" required placeholder="www.example.com" pattern="(?!.*\.\.)([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}" hint="For example, www.example.com. Enter the domain only, without https:// or a page path." />
          {hasPublicationUrl && <div className="md:col-span-2"><Input label="Publication web address" name="url" type="url" required pattern="https://.*" placeholder="https://www.example.com/publication" hint={provider === "building-safety" ? "Use the HTTPS address of the Building Safety Regulator publication or collection." : "Paste the HTTPS address of the page or document to retrieve."} /></div>}
          {isPublication && <>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Publication category</span>
              <select name="publicationKind" required defaultValue="" className={inputClass}>
                <option value="">Choose a category</option>
                <option value="programme">Programme</option>
                <option value="accounts">Company accounts</option>
                <option value="rns">Regulatory news announcement (RNS)</option>
                <option value="news">News article</option>
                <option value="recruitment">Recruitment notice</option>
              </select>
            </label>
            <Input label="Who or what is the publication about?" name="subjectId" required hint="Use a recognisable public name or reference, for example Example plc or Riverside redevelopment." />
          </>}
          <div className="md:col-span-2"><Input label="Research purpose" name="purpose" required hint="For example, review the company's published financial performance." /></div>
          <Input label="Earliest records to retrieve" name="backfillStart" type="date" required hint="This bounds the first retrieval. Choose the earliest date relevant to your research." />
        </fieldset>
        <fieldset className="space-y-4 border-t border-ink/10 pt-5">
          <legend className="text-base font-medium">Permission to use this source</legend>
          {rights.length === 0 ? <div className="space-y-2 rounded border border-amber-700/25 bg-amber-50 p-4">
            <p className="text-sm">No licences or permissions have been recorded yet. Record one before adding the source.</p>
            <button type="button" onClick={onRecordLicence} className="text-sm font-medium text-green underline underline-offset-4">Record a licence or permission</button>
          </div> : <>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Recorded licence or permission</span>
              <select name="rightsId" required defaultValue="" className={inputClass}>
                <option value="">Choose the permission covering this source</option>
                {rights.map((right) => <option key={String(right.id)} value={String(right.id)}>{String(right.holder)} · {String(right.material)}</option>)}
              </select>
            </label>
            <button type="button" onClick={onRecordLicence} className="text-sm text-green underline underline-offset-4">Record another licence or permission</button>
          </>}
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Source terms web address" name="termsUrl" type="url" required pattern="https://.*" placeholder="https://www.example.com/terms" />
            <Input label="Terms version or review date" name="termsVersion" required defaultValue={`Reviewed ${date(new Date().toISOString())}`} />
            <div className="md:col-span-2"><Input label="Required credit to the publisher" name="attribution" required hint="Enter the acknowledgement required by the source's terms." /></div>
          </div>
        </fieldset>
        <details className="rounded border border-ink/15 p-4">
          <summary className="cursor-pointer text-sm font-medium">Advanced: refresh frequency and daily limits</summary>
          <p className="my-4 text-sm text-ink/65">Defaults are once a day, up to 100 requests and £10 of AI processing. These are ceilings, not automatic charges.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Refresh every (hours)" name="cadenceHours" type="number" min={1 / 3600} step="any" required defaultValue={24} />
            <Input label="Maximum requests per day" name="dailyRequests" type="number" min={0} step="1" required defaultValue={100} />
            <Input label="Maximum AI text units per day (tokens)" name="dailyTokens" type="number" min={0} step="1" required defaultValue={100000} hint="Tokens measure the text processed by an AI model. Keep the default unless you need a different technical limit." />
            <Input label="Maximum AI cost per day (£)" name="dailyPounds" type="number" min={0} step="0.01" required defaultValue={10} />
          </div>
        </details>
        {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
        <button type="submit" disabled={busy || rights.length === 0} className="rounded bg-green px-4 py-2 text-sm text-cream disabled:opacity-50">{busy ? "Adding source…" : "Add source"}</button>
      </>}
    </form>
  );
}
