"use client";

import { useId, useState, type FormEvent } from "react";
import type { SourceSettings } from "@/lib/db/research-workflow";

type SourceConfigurationProps = {
  source: SourceSettings;
  save: (path: string, body: unknown, method?: string) => Promise<unknown>;
};

const inputClass =
  "w-full rounded border border-text/25 bg-white px-3 py-2 text-[15px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const hintClass = "mt-2 text-[15px] leading-relaxed text-muted";

// Publisher labels checked on 12 September 2026: https://www.thegazette.co.uk/noticecodes
const gazetteNoticeTypes = [
  { code: "2410", label: "Appointment of administrators" },
  { code: "2441", label: "Resolution for winding up (creditors' voluntary)" },
  { code: "2443", label: "Appointment of liquidators (creditors' voluntary)" },
  { code: "2450", label: "Petitions to wind up (companies)" },
  { code: "2452", label: "Winding-up orders (companies)" },
  { code: "2454", label: "Appointment of liquidators (court winding up)" },
];
const isListedNoticeType = (code: string) => gazetteNoticeTypes.some((notice) => notice.code === code);
const parseNoticeCodes = (value: string) => value.split(",").map((code) => code.trim()).filter(Boolean);

function budgetInPence(value: string) {
  const amount = value.trim();
  if (!/^\d+(?:\.\d{0,2})?$/.test(amount)) {
    throw new Error("Enter a daily budget in pounds, using no more than two decimal places.");
  }
  const [pounds, pence = ""] = amount.split(".");
  const total = Number(pounds) * 100 + Number(pence.padEnd(2, "0"));
  if (!Number.isSafeInteger(total) || total > 1_000_000) {
    throw new Error("The daily budget must be between £0 and £10,000.");
  }
  return total;
}

function wholeNumber(value: string, maximum: number, label: string) {
  const total = Number(value);
  if (!/^\d+$/.test(value.trim()) || !Number.isSafeInteger(total) || total > maximum) {
    throw new Error(`${label} must be a whole number between 0 and ${maximum.toLocaleString("en-GB")}.`);
  }
  return total;
}

export function SourceConfiguration(props: SourceConfigurationProps) {
  return <ConfigurationForm key={props.source.id} {...props} />;
}

function ConfigurationForm({ source, save }: SourceConfigurationProps) {
  const id = useId();
  const [status, setStatus] = useState(source.status);
  const [budget, setBudget] = useState((source.dailyPence / 100).toFixed(2));
  const [requests, setRequests] = useState(String(source.dailyRequests));
  const [tokens, setTokens] = useState(String(source.dailyTokens));
  const [companyNumber, setCompanyNumber] = useState(String(source.selection.companyNumber ?? ""));
  const [noticeTypes, setNoticeTypes] = useState<string[]>(
    Array.isArray(source.selection.noticeTypes) ? source.selection.noticeTypes.map(String) : [],
  );
  const [additionalNoticeTypes, setAdditionalNoticeTypes] = useState(
    noticeTypes.filter((code) => !isListedNoticeType(code)).join(", "),
  );
  const [additionalNoticesOpen, setAdditionalNoticesOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setSaved(false);

    try {
      let dailyPence: number;
      let dailyRequests: number;
      let dailyTokens: number;
      try {
        dailyPence = budgetInPence(budget);
        dailyRequests = wholeNumber(requests, 1_000_000, "Daily requests");
        dailyTokens = wholeNumber(tokens, 100_000_000, "Daily model tokens");
      } catch (error) {
        setAdvancedOpen(true);
        throw error;
      }

      let selection: Record<string, unknown> | undefined;
      if (source.provider === "companies-house") {
        let number = companyNumber.replace(/\s+/g, "").toUpperCase();
        if (/^\d{1,8}$/.test(number)) number = number.padStart(8, "0");
        if (status === "ready" && !/^[A-Z0-9]{8}$/.test(number)) {
          throw new Error("Enter an 8-character company number before enabling Companies House.");
        }
        selection = { companyNumber: number };
      } else if (source.provider === "gazette") {
        const additionalCodes = parseNoticeCodes(additionalNoticeTypes);
        // Retain the saved order and any additional codes that are not represented by checkboxes.
        const retainedCodes = noticeTypes.filter((code) => isListedNoticeType(code) || additionalCodes.includes(code));
        const codes = [...retainedCodes, ...additionalCodes.filter((code) => !retainedCodes.includes(code))];
        if (status === "ready") {
          if (!codes.length) throw new Error("Choose at least one notice type before enabling The Gazette.");
          if (codes.length > 100) throw new Error("Select no more than 100 notice types.");
          if (codes.some((code) => !/^\d{4}$/.test(code))) {
            setAdditionalNoticesOpen(true);
            throw new Error("Additional notice codes must each contain four digits.");
          }
        }
        selection = { noticeTypes: codes };
      }

      setBusy(true);
      await save(
        `sources/${source.id}`,
        { status, dailyRequests, dailyTokens, dailyPence, ...(selection === undefined ? {} : { selection }) },
        "PATCH",
      );
      setBudget((dailyPence / 100).toFixed(2));
      if (selection && source.provider === "companies-house") setCompanyNumber(String(selection.companyNumber));
      if (selection && source.provider === "gazette") {
        const codes = selection.noticeTypes as string[];
        setNoticeTypes(codes);
        setAdditionalNoticeTypes(codes.filter((code) => !isListedNoticeType(code)).join(", "));
      }
      setSaved(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Changes could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      aria-label={`Configure ${source.label}`}
      noValidate
      onSubmit={submit}
      onChange={() => { setSaved(false); setError(""); }}
      className="space-y-6"
    >
      <fieldset disabled={busy} className="space-y-6 disabled:opacity-60">
        <div>
            <label htmlFor={`${id}-status`} className="mb-2 block text-[15px] font-medium">Use this source</label>
            <select id={`${id}-status`} name="status" value={status} onChange={(event) => setStatus(event.target.value)} aria-describedby={`${id}-status-hint`} className={inputClass}>
              <option value="ready">Enabled for research</option>
              <option value="paused">Paused</option>
              <option value="unavailable">Unavailable</option>
            </select>
            <p id={`${id}-status-hint`} className={hintClass}>Enable to include this source in research. Pause to stop using it.</p>
        </div>

        {source.provider === "companies-house" && (
          <div>
            <label htmlFor={`${id}-company`} className="mb-2 block text-[15px] font-medium">Company number</label>
            <input id={`${id}-company`} name="companyNumber" value={companyNumber} onChange={(event) => setCompanyNumber(event.target.value)} aria-describedby={`${id}-company-hint`} className={inputClass} />
            <p id={`${id}-company-hint`} className={hintClass}>Enter the Companies House number, including any letters. Short numeric numbers will receive leading zeroes. Your administrator must also set up the Companies House connection before this source can retrieve records.</p>
          </div>
        )}

        {source.provider === "gazette" && (
          <fieldset aria-describedby={`${id}-notices-hint`}>
            <legend className="text-[15px] font-medium">Gazette notices to include</legend>
            <p id={`${id}-notices-hint`} className={hintClass}>Choose the notices you want to include in research. Select at least one before enabling.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {gazetteNoticeTypes.map((notice) => (
                <label key={notice.code} className="flex cursor-pointer items-start gap-3 rounded border border-text/15 bg-white p-3 text-[15px] leading-relaxed">
                  <input
                    type="checkbox"
                    name="noticeTypes"
                    value={notice.code}
                    checked={noticeTypes.includes(notice.code)}
                    onChange={(event) => setNoticeTypes((current) => event.target.checked ? [...current, notice.code] : current.filter((code) => code !== notice.code))}
                    className="mt-1 size-4 shrink-0 accent-primary"
                  />
                  <span>{notice.label}</span>
                </label>
              ))}
            </div>
            <details open={additionalNoticesOpen} onToggle={(event) => setAdditionalNoticesOpen(event.currentTarget.open)} className="mt-4 rounded border border-text/15 p-4">
              <summary className="cursor-pointer text-[15px] font-medium">Additional notice types</summary>
              <div className="mt-3">
                <label htmlFor={`${id}-notices`} className="mb-2 block text-[15px] font-medium">Additional notice codes</label>
                <input id={`${id}-notices`} name="additionalNoticeTypes" value={additionalNoticeTypes} onChange={(event) => setAdditionalNoticeTypes(event.target.value)} aria-describedby={`${id}-additional-notices-hint`} className={inputClass} />
                <p id={`${id}-additional-notices-hint`} className={hintClass}>Existing types outside the choices above are kept here. To add another type, enter its four-digit code from <a href="https://www.thegazette.co.uk/noticecodes" target="_blank" rel="noreferrer" className="underline underline-offset-4">The Gazette's full notice list</a>. Separate codes with commas.</p>
              </div>
            </details>
          </fieldset>
        )}

        <details open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)} className="rounded border border-text/15 p-4">
          <summary className="cursor-pointer text-[15px] font-medium">Advanced limits</summary>
          <p className="mt-3 text-[15px] text-muted">Technical daily limits for data retrieval and AI processing. Leave these at their saved values unless you need to change capacity.</p>
          <div className="mt-4">
            <label htmlFor={`${id}-budget`} className="mb-2 block text-[15px] font-medium">Daily AI spending limit (£)</label>
            <input id={`${id}-budget`} name="dailyBudgetGbp" inputMode="decimal" value={budget} onChange={(event) => setBudget(event.target.value)} aria-describedby={`${id}-budget-hint`} className={inputClass} />
            <p id={`${id}-budget-hint`} className={hintClass}>Maximum daily model spend for this source, in pounds. Enter an amount from £0 to £10,000.</p>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor={`${id}-requests`} className="mb-2 block text-[15px] font-medium">Daily requests</label>
              <input id={`${id}-requests`} name="dailyRequests" inputMode="numeric" value={requests} onChange={(event) => setRequests(event.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor={`${id}-tokens`} className="mb-2 block text-[15px] font-medium">Daily model tokens</label>
              <input id={`${id}-tokens`} name="dailyTokens" inputMode="numeric" value={tokens} onChange={(event) => setTokens(event.target.value)} className={inputClass} />
            </div>
          </div>
        </details>
      </fieldset>

      <details className="rounded border border-text/15 p-4">
        <summary className="cursor-pointer text-[15px] font-medium">Licence and technical details</summary>
        <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted">
          <p>{source.attribution}</p>
          <p><a href={source.termsUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">Read the recorded source terms</a>{source.termsVersion && <span> ({source.termsVersion})</span>}</p>
          <p>{source.credentialConfigured ? "A credential reference is recorded. This does not confirm that its key is present or that a connection has succeeded." : "No credential reference is recorded. Some public sources do not need one."} Server credentials are managed by the technical administrator.</p>
          <p>Enabling checks the saved setup and current licence. It does not test a live connection.</p>
          <p>Provider identifier: <code>{source.provider}</code></p>
          {source.configurationError && <p>Recorded setup note: {source.configurationError}</p>}
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={busy} className="rounded bg-primary px-5 py-2.5 text-[15px] font-medium text-surface disabled:opacity-50">{busy ? "Saving…" : "Save changes"}</button>
        {error && <p role="alert" className="text-[15px] text-danger">{error}</p>}
        {saved && <p role="status" className="text-[15px] text-primary">Changes saved.</p>}
      </div>
    </form>
  );
}
