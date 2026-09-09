"use client";

import { useEffect, useRef, useState } from "react";
import type { Brief, BriefAnalysisLine, BriefFacts, BriefStatus, CompanyCandidate } from "@/lib/db/schema";
import { fullDate, shortDate } from "@/lib/portal/dates";
import type { Director } from "@/lib/portal/director-helpers";
import type { ActionResult } from "@/lib/portal/types";
import { CandidateList, CompanyPicker } from "./CompanyPicker";
import { Panel } from "./Panel";

/** Mirrors the GET route's `latestRun`; declared here so client code never imports the route. */
export type BriefRunSummary = {
  id: string;
  status: BriefStatus;
  error: string | null;
  createdAt: string;
};

export type BriefState = { latestRun: BriefRunSummary | null; brief: Brief | null };

export type BriefSubject = { name: string; number: string | null; target: "firm" | "party" };

export const POLL_INTERVAL_MS = 3_000;
export const POLL_LIMIT_MS = 120_000;
const TIMED_OUT = "Timed out, try again";
const RESEARCH_UNAVAILABLE = "Web research unavailable";
const REGISTER_BASE = "https://find-and-update.company-information.service.gov.uk/company/";

const SOURCE_LABELS: Record<BriefAnalysisLine["source"], string> = {
  companies_house: "CH",
  enquiry: "enquiry",
  web: "web",
  reasoning: "reasoning",
};

function registerLink(number: string): string {
  return `${REGISTER_BASE}${encodeURIComponent(number.replace(/\s+/g, "").toUpperCase())}`;
}

/** The GET route serialises the brief's date as a string; put it back. */
function revive(data: { latestRun?: BriefRunSummary | null; brief?: (Omit<Brief, "createdAt"> & { createdAt: string | Date }) | null }): BriefState {
  const brief = data.brief ? { ...data.brief, createdAt: new Date(data.brief.createdAt) } : null;
  return { latestRun: data.latestRun ?? null, brief };
}

function isResearchNotice(line: BriefAnalysisLine): boolean {
  return line.source === "reasoning" && line.text.trim() === RESEARCH_UNAVAILABLE;
}

function generatedBy(directors: Director[], createdBy: string): string {
  return directors.find((director) => director.id === createdBy)?.initials ?? "a director";
}

/**
 * The research brief on the party (or the firm). Six states: none, running,
 * complete, failed, and complete with a regenerate running or failed. While a
 * run is under way the panel polls the route every three seconds for up to two
 * minutes, then reports a timeout.
 */
export function BriefPanel({
  pursuitId,
  subject,
  initial,
  directors,
  onAsk,
  onPick,
  onComplete,
  endpoint,
  candidatesEndpoint,
}: {
  pursuitId: string;
  subject: BriefSubject;
  initial: BriefState;
  directors: Director[];
  onAsk: () => void;
  onPick: (number: string) => Promise<ActionResult> | ActionResult;
  /** Called once when a poll reports the run complete, so the page can refresh the timeline. */
  onComplete?: () => void;
  endpoint?: string;
  candidatesEndpoint?: string;
}) {
  const briefEndpoint = endpoint ?? `/api/portal/pursuits/${pursuitId}/brief`;
  const [state, setState] = useState<BriefState>(initial);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  const run = state.latestRun;
  const brief = state.brief;
  const running = run?.status === "running";
  const failed = run?.status === "failed" && (!brief || run.id !== brief.id);
  const runId = running ? run.id : null;

  useEffect(() => {
    if (!runId) return;
    let stopped = false;
    let ticks = 0;
    async function poll(): Promise<boolean> {
      try {
        const res = await fetch(briefEndpoint);
        if (!res.ok || stopped) return false;
        const next = revive((await res.json()) as Parameters<typeof revive>[0]);
        if (stopped || next.latestRun?.status === "running") return false;
        stop();
        setState(next);
        if (next.latestRun?.status === "complete") onCompleteRef.current?.();
        return true;
      } catch {
        return false; // A failed poll is retried on the next tick.
      }
    }
    const timer = setInterval(async () => {
      if (stopped) return;
      ticks += 1;
      if (ticks * POLL_INTERVAL_MS >= POLL_LIMIT_MS) {
        // One last look before giving up, so a run that finished in the final seconds is not reported as failed.
        const settled = await poll();
        if (settled || stopped) return;
        stop();
        setState((current) => ({
          ...current,
          latestRun: current.latestRun ? { ...current.latestRun, status: "failed", error: TIMED_OUT } : current.latestRun,
        }));
        return;
      }
      await poll();
    }, POLL_INTERVAL_MS);
    function stop() {
      stopped = true;
      clearInterval(timer);
    }
    return stop;
  }, [runId, briefEndpoint]);

  async function build() {
    if (starting || running) return;
    setStarting(true);
    setStartError(null);
    try {
      const res = await fetch(briefEndpoint, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setStartError(data.error ?? "The brief could not be started, try again");
        return;
      }
      const id = data.id;
      setState((current) => ({
        ...current,
        latestRun: { id, status: "running", error: null, createdAt: new Date().toISOString() },
      }));
    } catch {
      setStartError("The brief could not be started, try again");
    } finally {
      setStarting(false);
    }
  }

  async function pick(candidate: CompanyCandidate) {
    setPicking(candidate.number);
    setPickError(null);
    try {
      const result = await onPick(candidate.number);
      if (!result.ok) setPickError(result.error);
    } finally {
      setPicking(null);
    }
  }

  const buildLabel = starting ? "Starting…" : brief || failed ? (failed ? "Retry" : "Regenerate") : "Build the brief";
  const askButton = (
    <button type="button" className="btn-secondary" onClick={onAsk}>
      Ask
      <span aria-hidden="true" className="text-[10px]">
        ▸
      </span>
    </button>
  );

  return (
    <Panel
      eyebrow="Brief"
      title={subject.name}
      actions={brief ? <span className="font-mono text-[11px] tracking-[0.05em] text-ink/70">{shortDate(brief.createdAt)}</span> : undefined}
    >
      {brief && running && (
        <p className="mb-4 border-b border-green/10 pb-3 text-[12px] text-ink/70">
          Rebuilding the brief<span aria-hidden="true">…</span> the last one stays until it is done.
        </p>
      )}
      {brief && failed && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-green/10 pb-3">
          <p className="text-[12px] text-oxblood">{run?.error ?? "The brief failed"}</p>
          <button type="button" className="btn-quiet" onClick={() => void build()} disabled={starting}>
            {starting ? "Starting…" : "Retry"}
          </button>
        </div>
      )}

      {brief ? (
        <CompleteBrief
          brief={brief}
          subject={subject}
          directors={directors}
          picking={picking}
          pickError={pickError}
          onPick={pick}
        />
      ) : running ? (
        <div className="space-y-2">
          <p className="font-serif text-xl text-green">Building the brief…</p>
          <p className="text-[13px] text-ink/70">
            Checking Companies House, researching the web and writing the analysis. This takes up to two minutes.
          </p>
        </div>
      ) : failed ? (
        <div className="space-y-2">
          <p className="font-serif text-xl text-green">The brief failed.</p>
          <p className="text-[12px] text-oxblood">{run?.error ?? "Try again"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="font-serif text-xl text-green">No brief yet.</p>
          <p className="text-[13px] text-ink/70">
            {subject.number
              ? `Register facts for ${subject.number}, web research and a short analysis.`
              : "Without a company number the brief carries no Companies House facts. Find the company first, or build without one."}
          </p>
        </div>
      )}

      {!brief && !running && !subject.number && (
        <div className="mt-5 border-t border-green/10 pt-5">
          <CompanyPicker query={subject.name} onPick={onPick} endpoint={candidatesEndpoint} />
        </div>
      )}

      {startError && <p className="mt-4 text-[12px] text-oxblood">{startError}</p>}

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-green/10 pt-4">
        {brief && (
          <p className="mr-auto font-mono text-[10px] tracking-[0.12em] uppercase text-ink/70">
            Generated {fullDate(brief.createdAt)} by {generatedBy(directors, brief.createdBy)}
          </p>
        )}
        {!(brief && failed) && (
          <button
            type="button"
            className={brief || failed ? "btn-secondary" : "btn-brass text-[12px]"}
            onClick={() => void build()}
            aria-disabled={starting || running || undefined}
          >
            {running ? "Building…" : buildLabel}
          </button>
        )}
        {askButton}
      </div>
    </Panel>
  );
}

function CompleteBrief({
  brief,
  subject,
  directors,
  picking,
  pickError,
  onPick,
}: {
  brief: Brief;
  subject: BriefSubject;
  directors: Director[];
  picking: string | null;
  pickError: string | null;
  onPick: (candidate: CompanyCandidate) => Promise<void>;
}) {
  void directors;
  const analysis = (brief.analysis ?? []).filter((line) => !isResearchNotice(line));
  const researchUnavailable = (brief.analysis ?? []).some(isResearchNotice);

  return (
    <div className="space-y-5">
      <Facts facts={brief.facts} subject={subject} picking={picking} pickError={pickError} onPick={onPick} />

      {analysis.length > 0 && (
        <ul aria-label="Analysis" className="space-y-2 border-t border-green/10 pt-4">
          {analysis.map((line, index) => (
            <li key={index} className="flex items-start gap-3 text-[14px] leading-relaxed text-ink">
              <span
                className={`mt-[3px] w-11 shrink-0 font-mono text-[9px] tracking-[0.15em] ${
                  line.kind === "fact" ? "text-green" : "text-ink/70"
                }`}
              >
                {line.kind === "fact" ? "FACT" : "INFER"}
              </span>
              <span className="min-w-0 flex-1">{line.text}</span>
              <span className="shrink-0 font-mono text-[10px] tracking-[0.08em] text-ink/60">
                {line.url ? (
                  <a
                    href={line.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Source: ${SOURCE_LABELS[line.source]}`}
                    className="hover:text-brass"
                  >
                    {SOURCE_LABELS[line.source]} <span aria-hidden="true">↗</span>
                  </a>
                ) : (
                  SOURCE_LABELS[line.source]
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {researchUnavailable && <p className="text-[12px] text-ink/60">{RESEARCH_UNAVAILABLE}</p>}

      {brief.summary && <p className="border-t border-green/10 pt-4 text-[14px] leading-relaxed text-ink">{brief.summary}</p>}
    </div>
  );
}

function Facts({
  facts,
  subject,
  picking,
  pickError,
  onPick,
}: {
  facts: BriefFacts | null;
  subject: BriefSubject;
  picking: string | null;
  pickError: string | null;
  onPick: (candidate: CompanyCandidate) => Promise<void>;
}) {
  if (facts?.match === "confirmed" && facts.companyNumber) {
    const rows: Array<[string, string | null]> = [
      ["Number", facts.companyNumber],
      ["Status", facts.status ?? null],
      ["Incorporated", facts.incorporatedOn ?? null],
      ["Registered office", facts.registeredAddress ?? null],
      ["SIC codes", facts.sicCodes.length ? facts.sicCodes.join(", ") : null],
      [
        "Officers",
        facts.officers.length
          ? facts.officers.map((officer) => (officer.role ? `${officer.name} (${officer.role})` : officer.name)).join(" · ")
          : null,
      ],
      ["Charges", facts.chargesCount == null ? null : String(facts.chargesCount)],
      ["Accounts overdue", facts.accountsOverdue == null ? null : facts.accountsOverdue ? "Yes" : "No"],
    ];
    return (
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-serif text-lg text-green">{facts.companyName ?? subject.name}</p>
          <a
            href={registerLink(facts.companyNumber)}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[10px] tracking-[0.15em] uppercase text-green hover:text-brass"
          >
            Companies House <span aria-hidden="true">↗</span>
          </a>
        </div>
        <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-[13px] sm:grid-cols-[auto_1fr]">
          {rows
            .filter((row): row is [string, string] => Boolean(row[1]))
            .map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink/70 sm:pt-[3px]">{label}</dt>
                <dd className="text-ink">{value}</dd>
              </div>
            ))}
        </dl>
      </div>
    );
  }

  if (facts?.match === "unconfirmed" && facts.candidates?.length) {
    return (
      <div className="space-y-2">
        <p className="text-[13px] text-ink/70">
          No exact match on Companies House for {facts.subject}. Pick the right company and regenerate.
        </p>
        <CandidateList candidates={facts.candidates} picking={picking} onPick={onPick} />
        {pickError && <p className="text-[12px] text-oxblood">{pickError}</p>}
      </div>
    );
  }

  return (
    <p className="text-[12px] text-ink/60">
      {facts ? `No Companies House record found for ${facts.subject}.` : "No Companies House facts."}
    </p>
  );
}
