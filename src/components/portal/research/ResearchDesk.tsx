"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { api, date } from "./ResearchControls";
import { QUICK_RESEARCH_COST_PENCE, type QuickQuestion, type ResearchDeskData } from "@/lib/research/quick-types";

const base = "/api/portal/research";
const exampleQuestions = [
  "Which construction records suggest payment or dispute issues worth investigating?",
  "What does the collected case law say about concurrent delay?",
  "Which recent construction awards could be worth following up?",
];
const price = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(QUICK_RESEARCH_COST_PENCE / 100);
function actionMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  const messages: Record<string, string> = {
    "research queue full": "Research is busy. Please try again after some of the current questions have finished.",
    "research monitor limit": "The team has reached its limit of 20 daily questions. Pause an existing daily update before adding another.",
    "idempotency conflict": "This request has changed. Edit your question and try again.",
    "question not found": "This question is no longer available. Refresh the page to see your current research.",
    "evidence unavailable": "This source record has changed or is no longer available. Please refresh the page.",
    "director required": "Director access is required to use the research desk.",
    "forbidden": "Your current access does not allow this change.",
  };
  return messages[error.message] ?? error.message;
}

export function ResearchDesk() {
  const [data, setData] = useState<ResearchDeskData | null>(null);
  const [view, setView] = useState<"new" | "saved">("new");
  const [question, setQuestion] = useState("");
  const [monitoring, setMonitoring] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [posting, setPosting] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [readError, setReadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [receipt, setReceipt] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const sequence = useRef(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const invalidateRequests = useCallback(() => { sequence.current++; }, []);

  const reload = useCallback(async () => {
    const current = ++sequence.current;
    setRefreshing(true);
    try {
      const result = await api<ResearchDeskData>(`${base}/quick?view=${view}`);
      if (current === sequence.current) { setData(result); setReadError(""); }
    } catch {
      if (current === sequence.current) setReadError("Research could not be refreshed. Please try again in a moment.");
    } finally {
      if (current === sequence.current) setRefreshing(false);
    }
  }, [view]);
  useEffect(() => {
    void reload();
    return invalidateRequests;
  }, [reload, invalidateRequests]);
  const researching = data?.questions.some(item => item.status === "queued" || item.status === "running") ?? false;
  useEffect(() => {
    const timer = setInterval(() => void reload(), researching ? 15000 : 60000);
    return () => clearInterval(timer);
  }, [reload, researching]);
  useEffect(() => { setRequestId(crypto.randomUUID()); }, []);
  function changeQuestion(next: string) {
    setQuestion(next); setRequestId(crypto.randomUUID()); setReceipt(""); setActionError("");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (posting || !requestId) return;
    setPosting(true); setActionError(""); setReceipt("");
    try {
      await api(`${base}/quick`, { requestId, question: question.trim(), monitoring });
      setReceipt(monitoring ? "Research started. This question will also be checked daily. Your answer will appear below." : "Research started. Your answer will appear below. You can leave this page while it works.");
      setQuestion(""); setRequestId(crypto.randomUUID()); setMonitoring(false);
      await reload();
    } catch (error) {
      setActionError(actionMessage(error, "The question could not be started. Your text has been kept."));
    } finally { setPosting(false); }
  }
  async function act(key: string, path: string, body: unknown) {
    if (pending) return;
    setPending(key); setActionError(""); setReceipt("");
    try { await api(`${base}/${path}`, body, "PATCH"); await reload(); }
    catch (error) { setActionError(actionMessage(error, "That change could not be saved.")); }
    finally { setPending(null); }
  }
  const chooseExample = (text: string) => { changeQuestion(text); input.current?.focus(); };
  async function retryQuestion(item: QuickQuestion) {
    if (pending || posting) return;
    setPending(item.id); setActionError("");
    try {
      if (item.monitoring) {
        await api(`${base}/quick/${item.id}`, { monitoring: false }, "PATCH");
        await reload();
      }
      chooseExample(item.question); setMonitoring(item.monitoring);
      setReceipt(item.monitoring ? "The previous daily updates are paused. Select Research this to start again with one daily update." : "Your question is ready above. Select Research this to try again.");
    } catch (error) {
      setActionError(actionMessage(error, "The previous daily updates could not be paused. Please try again."));
    } finally { setPending(null); }
  }
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="font-mono text-xs uppercase tracking-[0.2em] text-green">QCS · Research</p><h1 className="mt-2 font-serif text-4xl text-green">Your research desk</h1></div>
        <nav aria-label="Research tools" className="flex items-center gap-5 text-sm">
          <Link href="/portal/research/case-law" className="underline-offset-4 hover:underline">Case law</Link>
          <Link href="/portal/research/reports" className="underline-offset-4 hover:underline">Reports</Link>
          <details className="relative"><summary className="min-h-11 cursor-pointer py-3">More tools</summary><div className="absolute right-0 z-10 mt-1 w-56 rounded border border-ink/20 bg-cream p-2 shadow-lg">
            <Link href="/portal/research/sources" className="block rounded p-3 hover:bg-green/5">Source settings</Link>
            <Link href="/portal/research/advanced" className="block rounded p-3 hover:bg-green/5">Advanced investigations</Link>
            <Link href="/portal/research/signals" className="block rounded p-3 hover:bg-green/5">Reviewed signals</Link>
            <Link href="/portal/research/watchlists" className="block rounded p-3 hover:bg-green/5">Existing watchlists</Link>
          </div></details>
        </nav>
      </header>

      <section aria-labelledby="research-question-title" className="rounded-xl border border-green/15 bg-white/75 p-5 md:p-6">
        <h2 id="research-question-title" className="font-serif text-2xl text-green">What would you like to find out?</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink/70">Ask in your own words. We find relevant material in your collected sources and prepare a short answer with evidence.</p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <label htmlFor="quick-research-question" className="sr-only">Your research question</label>
          <textarea ref={input} id="quick-research-question" value={question} disabled={posting} onChange={event => changeQuestion(event.target.value)} required minLength={5} maxLength={2000} rows={2} placeholder="For example: What payment or dispute issues should we investigate in the construction sector?" className="block w-full resize-y rounded-lg border border-ink/25 bg-white p-4 text-base leading-relaxed focus-visible:outline-green" />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={monitoring} disabled={posting} onChange={event => { setMonitoring(event.target.checked); setRequestId(crypto.randomUUID()); }} className="size-4 accent-green" />Keep this question updated daily</label>
            <button disabled={posting || !requestId || question.trim().length < 5} className="min-h-11 rounded-lg bg-green px-6 py-3 text-sm font-medium text-cream disabled:opacity-50">{posting ? "Starting research…" : "Research this →"}</button>
          </div>
          <p className="text-xs leading-relaxed text-ink/65">Up to {price} per new answer. Daily checks only use AI when the relevant evidence changes. You can pause updates at any time.</p>
        </form>
        <details className="mt-3"><summary className="cursor-pointer text-xs text-green">Try an example</summary><div className="mt-3 grid gap-2">{exampleQuestions.map(text => <button key={text} type="button" disabled={posting} onClick={() => chooseExample(text)} className="rounded border border-ink/15 bg-white p-3 text-left text-sm text-ink/75 hover:bg-green/5">{text}</button>)}</div></details>
        {receipt && <p role="status" className="mt-4 rounded bg-green/5 p-3 text-sm text-green">{receipt}</p>}
        {actionError && <p role="alert" className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm">{actionError}</p>}
      </section>

      {readError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded border border-amber-200 bg-amber-50 p-4 text-sm"><p>{readError}</p><button type="button" onClick={() => void reload()} disabled={refreshing} className="font-medium underline">Try again</button></div>}
      {!data && !readError && <p role="status" className="text-sm text-ink/65">Loading your research…</p>}
      {data && <>
        {data.questions.length > 0 && <section aria-labelledby="your-questions-title" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4"><h2 id="your-questions-title" className="font-serif text-2xl text-green">Your research</h2><p className="text-xs text-ink/65">Updates appear here automatically</p></div>
          {data.questions.map(item => <QuestionCard key={item.id} item={item} pending={pending !== null || posting} onMonitoring={() => void act(item.id, `quick/${item.id}`, { monitoring: !item.monitoring })} onRetry={() => void retryQuestion(item)} />)}
        </section>}

        <section aria-labelledby="research-opportunities-title" className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 id="research-opportunities-title" className="font-serif text-2xl text-green">Potential opportunities</h2><p className="mt-2 max-w-2xl text-sm text-ink/70">Construction records with payment, dispute or project context, picked out automatically for you to review.</p></div><div aria-label="Opportunity view" className="flex rounded-lg border border-ink/20 bg-white/50 p-1">{(["new", "saved"] as const).map(option => <button key={option} type="button" aria-pressed={view === option} onClick={() => { if (view !== option) { setView(option); setData(previous => previous ? { ...previous, opportunities: [] } : previous); } }} className={`min-h-10 rounded px-4 py-2 text-sm ${view === option ? "bg-green text-cream" : "text-ink/75"}`}>{option === "new" ? "New to review" : "Saved"}</button>)}</div></div>
          {refreshing && !data.opportunities.length ? <p role="status" className="text-sm text-ink/65">Checking the latest records…</p> : !data.opportunities.length && <div className="rounded-lg border border-dashed border-ink/25 bg-white/30 p-6"><p className="font-medium text-green">{view === "saved" ? "Nothing saved yet." : "No matching records to show yet."}</p><p className="mt-2 text-sm text-ink/70">{view === "saved" ? "Save a useful record from New to review and it will appear here." : "New matches will appear as your sources collect more material. You can ask a specific question above."}</p></div>}
          <div className="grid gap-4 md:grid-cols-2">
            {data.opportunities.map(item => <article key={item.documentId} className="flex min-w-0 flex-col rounded-xl border border-ink/15 bg-white/65 p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink/65"><span>{item.source}</span><span>{item.publishedAt ? date(item.publishedAt) : `Collected ${date(item.retrievedAt)}`}</span></div>
              <h3 className="break-words font-serif text-xl leading-snug text-green">{item.title}</h3>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink/75">{item.excerpt}</p>
              <p className="mt-4 text-xs leading-relaxed text-ink/65">Why shown: {item.reason}</p>
              <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-ink/10 pt-4 text-sm">
                {item.evidence && item.evidence.length > 1 ? <details className="mr-auto max-w-full"><summary className="cursor-pointer font-medium text-green underline underline-offset-4">Read the evidence</summary><div className="mt-3 space-y-3">{item.evidence.map(ref => <Link key={ref.passageId} href={`/portal/research/evidence/${ref.passageId}`} className="block break-words text-green underline underline-offset-4">{ref.label}</Link>)}</div></details> : <Link href={`/portal/research/evidence/${item.passageId}`} className="mr-auto font-medium text-green underline underline-offset-4">Read the evidence →</Link>}
                <button type="button" disabled={pending !== null} onClick={() => void act(item.documentId, `opportunities/${item.documentId}`, { action: item.saved ? "reopen" : "save" })} className="min-h-10 text-green underline-offset-4 hover:underline disabled:opacity-50">{item.saved ? "Unsave" : "Save"}</button>
                <button type="button" disabled={pending !== null} onClick={() => void act(item.documentId, `opportunities/${item.documentId}`, { action: "dismiss" })} className="min-h-10 text-ink/65 hover:underline disabled:opacity-50">Dismiss</button>
              </div>
            </article>)}
          </div>
          <p className="text-xs text-ink/65">These are published records for review, not confirmed leads. A matching record does not establish distress, liability or a need for our services.</p>
        </section>
        <details className="rounded-lg border border-ink/15 bg-white/30 px-5 py-4"><summary className="cursor-pointer text-sm text-green">Sources and coverage</summary><div className="mt-3 space-y-2 text-sm text-ink/70"><p>{data.collection.enabledSources} sources enabled. {data.collection.lastCollectedAt ? `Latest collection: ${date(data.collection.lastCollectedAt)}.` : "No successful collection recorded yet."}</p><p>This desk searches material already collected from your connected sources. It does not search the entire internet. Source updates run in the background; collection can be incomplete.</p>{data.collection.needsAttention > 0 && <p>{data.collection.needsAttention} sources need setup or attention.</p>}<Link href="/portal/research/sources" className="inline-block pt-1 font-medium text-green underline">Manage source settings</Link></div></details>
      </>}
    </div>
  );
}

function QuestionCard({ item, pending, onMonitoring, onRetry }: { item: QuickQuestion; pending: boolean; onMonitoring: () => void; onRetry: () => void }) {
  const state = item.status === "queued" ? "In the queue" : item.status === "running" ? "Reading the evidence" : item.status === "failed" || item.error ? "Needs attention" : "Answer ready";
  return <article className="rounded-xl border border-ink/15 bg-white/60 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="max-w-3xl font-medium text-green">{item.question}</h3><span className={`rounded-full px-3 py-1 text-xs ${item.status === "failed" ? "bg-amber-50 text-amber-950" : "bg-green/10 text-green"}`}>{state}</span></div>
    {item.status === "queued" || item.status === "running" ? <p className="mt-3 text-sm text-ink/70">Your question is saved. We will prepare the answer in the background; you do not need to keep this page open.</p> : null}
    {item.error && <p className="mt-3 text-sm text-amber-950">{item.error}</p>}
    {item.answer && <div className="mt-4 space-y-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink/60">Draft answer · for review</p>
      {item.answer.findings.map((finding, index) => <div key={index} className="space-y-2 border-l-2 border-green/20 pl-4">
        <p className="text-sm leading-relaxed">{finding.text}</p>
        {finding.kind !== "observation" && <p className="text-xs text-ink/60">{finding.kind === "inference" ? "Interpretation of the evidence" : "Allegation reported in the source"}</p>}
        <details><summary className="cursor-pointer text-xs font-medium text-green">View supporting evidence</summary><div className="mt-2 space-y-2 text-sm">{finding.quotation && <blockquote className="border-l border-ink/20 pl-3 text-ink/70">“{finding.quotation}”</blockquote>}{finding.evidence.map(ref => { const passage = item.evidence.find(value => value.passageId === ref.passageId); return <Link key={ref.passageId} href={`/portal/research/evidence/${ref.passageId}`} className="block text-green underline underline-offset-4">{passage?.title ?? "Open source passage"}</Link>; })}</div></details>
      </div>)}
      {item.answer.limitations.length > 0 && <div className="space-y-2 text-sm text-ink/70">{item.answer.limitations.map((limitation, index) => <p key={index}>{limitation}</p>)}</div>}
    </div>}
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-ink/10 pt-3 text-xs text-ink/65">
      <span>{item.lastCheckedAt ? `Checked ${date(item.lastCheckedAt)}` : `Asked ${date(item.createdAt)}`}</span>
      {item.monitoring && <span>Daily updates{item.nextCheckAt ? ` · next check ${date(item.nextCheckAt)}` : ""}</span>}
      <button type="button" disabled={pending} onClick={onMonitoring} className="min-h-10 font-medium text-green underline underline-offset-4">{item.monitoring ? "Pause daily updates" : "Keep updated daily"}</button>
      {(item.status === "failed" || item.error) && <button type="button" disabled={pending} onClick={onRetry} className="min-h-10 font-medium text-green underline">Try this question again</button>}
    </div>
  </article>;
}
