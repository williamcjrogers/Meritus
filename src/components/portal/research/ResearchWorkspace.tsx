"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  SourceSettings,
  InvestigationSummary,
} from "@/lib/db/research-workflow";
import type {
  EvidencePassage,
  EvidenceRef,
} from "@/lib/research/workflow-types";
import {
  QCS_CASE_LAW_ACKNOWLEDGEMENT,
  CASE_LAW_COVERAGE_NOTICE,
} from "@/lib/research/source-catalogue";
import {
  ActionForm,
  DataTable,
  Panel,
  api,
  date,
  label,
  value,
  values,
  numeric,
  nullable,
  dateTime,
  type Field,
  type Row,
  type Values,
} from "./ResearchControls";
import { EntitiesReview } from './EntitiesReview';
import { ResearchDecisions } from './ResearchDecisions';
import { SourceSettingsForms } from "./SourceSettingsForms";
const base = "/api/portal/research";
const kinds = ["organisation", "project", "legal_issue", "sector", "referral"];
const options = (items: string[]) =>
  items.map((v) => ({ value: v, label: v.replaceAll("_", " ") }));
const select = (
  name: string,
  text: string,
  items: { value: string; label: string }[],
  required = true,
): Field => ({ name, label: text, type: "select", options: items, required });
const field = (
  name: string,
  text: string,
  type: Field["type"] = "text",
  required = true,
  initial?: string | number,
): Field => ({ name, label: text, type, required, value: initial });
const refs = (evidence: EvidencePassage[], v: Values) =>
  evidence
    .filter((e) => values(v, "evidence").includes(e.passageId))
    .map(({ documentId, versionId, passageId }) => ({
      documentId,
      versionId,
      passageId,
    }));
const refField = (evidence: EvidencePassage[]): Field => ({
  name: "evidence",
  label: "Supporting passages",
  type: "checks",
  options: evidence.map((e) => ({
    value: e.passageId,
    label: e.title + " · " + e.text.slice(0, 100),
  })),
});
const navigation = [
  ["", "Investigations"],
  ["signals", "Signals"],
  ["watchlists", "Watchlists"],
  ["case-law", "Case law"],
  ["calendar", "Calendar"],
  ["referrals", "Referrals"],
  ["reports", "Reports"],
  ["sources", "Sources"],
  ["runs", "Runs"],
  ["outcomes", "Outcomes"],
  ["digests", "Digests"],
  ["indexes", "Indexes"],
];
type Mode =
  | "investigations"
  | "investigation"
  | "signals"
  | "watchlists"
  | "case-law"
  | "calendar"
  | "referrals"
  | "reports"
  | "sources"
  | "runs"
  | "outcomes"
  | "report"
  | "evidence"
  | "authority";
export function ResearchWorkspace({ mode, id }: { mode: Mode; id?: string }) {
  const router = useRouter(),
    [data, setData] = useState<unknown>(null),
    [sources, setSources] = useState<SourceSettings[]>([]),
    [entities, setEntities] = useState<Row[]>([]),
    [directors, setDirectors] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [requestId, setRequestId] = useState(""),
    [busy, setBusy] = useState(false);
  const endpoint =
    mode === "investigation"
      ? `investigations/${id}`
      : mode === "report"
        ? `reports/${id}`
        : mode === "evidence"
          ? `evidence/${id}`
          : mode === "authority"
            ? `case-law/${id}`
          : mode;
  const reload = useCallback(async () => {
    setBusy(true);
    try {
      const [body, s, e, d] = await Promise.all([
        api(`${base}/${endpoint}`),
        api<SourceSettings[]>(`${base}/sources`),
        api<Row[]>(`${base}/entities`),
        api<Row[]>(`${base}/directory`),
      ]);
      setData(body);
      setSources(s);
      setEntities(e);
      setDirectors(d);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Research could not be loaded");
    } finally {
      setBusy(false);
    }
  }, [endpoint]);
  useEffect(() => {
    setRequestId(crypto.randomUUID());
    void reload();
  }, [reload]);
  useEffect(() => {
    if (!["runs", "investigation"].includes(mode)) return;
    const timer = setInterval(() => void reload(), 30000);
    return () => clearInterval(timer);
  }, [mode, reload]);
  const mutate = async (path: string, body: unknown, method = "POST") => {
    const result = await api(`${base}/${path}`, body, method);
    await reload();
    return result;
  };
  const entityOptions = entities.map((e) => ({
      value: String(e.id),
      label: label(e.displayName) + (e.confirmed ? "" : " (unconfirmed)"),
    })),
    sourceOptions = sources.map((s) => ({
      value: s.id,
      label: s.label + " (" + s.status + ")",
    }));
  const rows = Array.isArray(data) ? (data as Row[]) : [],
    detail = (data ?? {}) as Row;
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-green">
          QCS · Director research
        </p>
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-serif text-3xl md:text-4xl">
            {mode === "investigation"
              ? "Investigation workspace"
              : mode === "report"
                ? "Research report"
                : mode === "evidence"
                  ? "Source evidence"
                  : mode === "case-law"
                    ? "Case law"
                    : mode.charAt(0).toUpperCase() + mode.slice(1)}
          </h1>
          <button
            className="rounded border border-ink/20 px-3 py-2 text-sm"
            onClick={() => void reload()}
            disabled={busy}
          >
            {busy ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <p className="max-w-3xl text-ink/65">
          Trace public and licensed evidence, review proposed findings and
          record commercial decisions. Coverage and director review remain
          visible throughout.
        </p>
        <nav
          aria-label="Research"
          className="flex flex-wrap gap-x-5 gap-y-3 border-b border-ink/15 py-3"
        >
          {navigation.map(([path, text]) => (
            <Link
              key={path}
              href={"/portal/research" + (path ? "/" + path : "")}
              className="text-sm underline-offset-4 hover:underline"
            >
              {text}
            </Link>
          ))}
        </nav>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded border border-amber-700/30 bg-amber-50 p-4"
        >
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Loading research…</p>}
      {mode === "investigations" && (
        <>
          <ActionForm
            title="Commission an investigation"
            button="Start investigation"
            fields={[
              field("question", "Research question", "textarea"),
              field("subject", "Public subject"),
              select("kind", "Scope", options(kinds)),
              select(
                "entityId",
                "Confirmed identity (optional)",
                entityOptions,
                false,
              ),
              field(
                "jurisdiction",
                "Jurisdiction",
                "text",
                true,
                "England and Wales",
              ),
              field("from", "Records from", "date", false),
              field("to", "Records to", "date", false),
              {
                name: "sources",
                label: "Sources to use",
                type: "checks",
                options: sourceOptions,
              },
              field("maxRequests", "Maximum requests", "number", true, 250),
              field(
                "maxTokens",
                "Maximum model tokens",
                "number",
                true,
                100000,
              ),
              field(
                "maxCostPence",
                "Maximum model cost (pence)",
                "number",
                true,
                1000,
              ),
            ]}
            submit={async (v) => {
              const result = await api<{ investigationId: string }>(
                `${base}/investigations`,
                {
                  requestId,
                  question: value(v, "question"),
                  scope: {
                    kind: value(v, "kind"),
                    subject: value(v, "subject"),
                    entityId: nullable(v, "entityId"),
                    jurisdiction: value(v, "jurisdiction"),
                    from: nullable(v, "from"),
                    to: nullable(v, "to"),
                    sources: values(v, "sources"),
                  },
                  budget: {
                    maxRequests: numeric(v, "maxRequests"),
                    maxTokens: numeric(v, "maxTokens"),
                    maxCostPence: numeric(v, "maxCostPence"),
                  },
                },
              );
              setRequestId(crypto.randomUUID());
              router.push(
                "/portal/research/investigations/" + result.investigationId,
              );
            }}
          />
          <DataTable
            rows={rows}
            columns={[
              {
                key: "question",
                title: "Question",
                render: (r) => (
                  <Link
                    className="underline"
                    href={"/portal/research/investigations/" + r.id}
                  >
                    {label(r.question)}
                  </Link>
                ),
              },
              { key: "status", title: "Status" },
              {
                key: "createdAt",
                title: "Created",
                render: (r) => date(r.createdAt),
              },
            ]}
          />
          <ActionForm
            title="Add a research identity"
            fields={[
              field("displayName", "Name"),
              select(
                "kind",
                "Identity type",
                options([
                  "company",
                  "person",
                  "project",
                  "case",
                  "adviser",
                  "group",
                  "contract",
                ]),
              ),
              field(
                "jurisdiction",
                "Jurisdiction",
                "text",
                true,
                "England and Wales",
              ),
            ]}
            submit={(v) => mutate("entities", v)}
          />
        </>
      )}
      {mode === "investigation" && data !== null && (
        <Investigation
          detail={detail}
          sources={sources}
          entities={entityOptions}
          directors={directors}
          mutate={mutate}
        />
      )}
      {mode === "signals" && (
        <SignalList rows={rows} directors={directors} mutate={mutate} />
      )}
      {mode === "runs" && <RunList rows={rows} mutate={mutate} />}
      {mode === "watchlists" && (
        <>
          <ActionForm
            title="Create a watchlist"
            fields={[
              field("label", "Name"),
              field(
                "cadenceSeconds",
                "Refresh interval (seconds)",
                "number",
                true,
                86400,
              ),
              {
                name: "sources",
                label: "Sources",
                type: "checks",
                options: sourceOptions,
              },
              {
                name: "entityIds",
                label: "Confirmed identities",
                type: "checks",
                options: entities
                  .filter((e) => e.confirmed)
                  .map((e) => ({
                    value: String(e.id),
                    label: label(e.displayName),
                  })),
              },
              {
                name: "signalPreferences",
                label: "Signals of interest",
                type: "checks",
                options: options([
                  "direct",
                  "project_change",
                  "payment",
                  "context",
                ]),
              },
            ]}
            submit={(v) =>
              mutate("watchlists", {
                label: value(v, "label"),
                cadenceSeconds: numeric(v, "cadenceSeconds"),
                sources: values(v, "sources"),
                entityIds: values(v, "entityIds"),
                signalPreferences: values(v, "signalPreferences"),
                enabled: true,
              })
            }
          />
          {rows.map((w) => (
            <article
              key={String(w.id)}
              className="rounded border border-ink/15 p-5 space-y-3"
            >
              <h2 className="font-serif text-2xl">{label(w.label)}</h2>
              <p>
                {w.enabled ? "Active" : "Paused"} · Every{" "}
                {Number(w.cadence_seconds) / 3600} hours · Europe/London
              </p>
              <p>{(w.members as Row[]).map((m) => label(m.name)).join(", ")}</p>
              {(w.members as Row[]).flatMap(m=>(m.refreshes as Row[]??[]).map((f,n)=><p key={String(m.id)+n} className="text-sm">{label(m.name)} · {label(f.source)} · {label(f.status)}{f.reason?': '+label(f.reason):''} · Checked {date(f.checkedAt)}{Boolean(f.runId)&&<Link className="ml-2 underline" href="/portal/research/runs">View run</Link>}</p>))}
              <ActionForm title="Delete watchlist" fields={[]} button="Delete monitoring" submit={()=>mutate('watchlists/'+w.id,{},'DELETE')}/>
              <ActionForm
                title="Update watchlist"
                fields={[
                  field("label", "Name", "text", true, String(w.label)),
                  field(
                    "cadenceSeconds",
                    "Refresh interval (seconds)",
                    "number",
                    true,
                    Number(w.cadence_seconds),
                  ),
                  select(
                    "enabled",
                    "Monitoring",
                    options(["enabled", "paused"]),
                    true,
                  ),
                ]}
                submit={(v) =>
                  mutate(
                    "watchlists/" + w.id,
                    {
                      revision: Number(w.revision),
                      value: {
                        label: value(v, "label"),
                        cadenceSeconds: numeric(v, "cadenceSeconds"),
                        sources: w.sources,
                        signalPreferences: w.signal_preferences,
                        entityIds: (w.members as Row[]).map((m) => m.entityId),
                        enabled: value(v, "enabled") === "enabled",
                      },
                    },
                    "PATCH",
                  )
                }
              />
            </article>
          ))}
        </>
      )}
      {mode === "sources" && (
        <SourceSettingsForms sources={sources} reload={reload} />
      )}
      {mode === "case-law" && <CaseLawSearch initial={rows} />}
      {mode === "authority" && data!==null && <CaseLawSearch initial={[]} initialAuthority={detail}/>}
      {mode === "reports" && <ReportList rows={rows} />}
      {mode === "report" && data !== null && (
        <ReportView data={detail} mutate={mutate} />
      )}
      {mode === "evidence" && data !== null && (
        <EvidenceCard passage={detail as unknown as EvidencePassage} />
      )}
      {mode === "calendar" && (
        <DataTable
          rows={rows}
          columns={[
            { key: "kind", title: "Event" },
            {
              key: "proposed_date",
              title: "Proposed date",
              render: (r) => date(r.proposed_date),
            },
            { key: "state", title: "Review state" },
            { key: "jurisdiction", title: "Jurisdiction" },
            { key: "rule", title: "Rule" },
            { key: "accrual_basis", title: "Accrual basis" },
            { key: "assumptions", title: "Assumptions" },
          ]}
          empty="No calendar entries. Add an evidence-backed date within an investigation."
        />
      )}
      {mode === "referrals" && (
        <DataTable
          rows={rows}
          columns={[
            { key: "subject", title: "Contact / organisation" },
            { key: "predicate", title: "Relationship" },
            { key: "organisation", title: "Connected identity" },
            { key: "channel", title: "Channel" },
            { key: "service_offer", title: "Service offer" },
            { key: "stage", title: "Stage" },
            {
              key: "last_contact_at",
              title: "Last contact",
              render: (r) => date(r.last_contact_at),
            },
          ]}
          empty="No referral relationships. Add a dated, source-backed relationship within an investigation."
        />
      )}
      {mode === "outcomes" && (
        <>
          <Panel title="Reviewed-signal cohort (last 90 days)">
            <div className="grid gap-4 sm:grid-cols-4">
              {[
                "reviewedSignals",
                "conversations",
                "proposals",
                "instructions",
              ].map((key) => (
                <div
                  key={key}
                  className="rounded border border-ink/15 bg-white/50 p-5"
                >
                  <p className="text-3xl font-serif">{label(detail[key])}</p>
                  <p className="text-sm">
                    {key.replace("reviewedSignals", "Reviewed signals")}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-sm text-ink/65">
              Conversation rate:{" "}
              {Number(detail.reviewedSignals) > 0
                ? Math.round(
                    (Number(detail.conversations) /
                      Number(detail.reviewedSignals)) *
                      100,
                  ) + "%"
                : "No reviewed signals in this cohort"}
              . Each signal is counted once per outcome.
            </p>
          </Panel>
          <ActionForm
            title="Record a real outcome"
            fields={[
              field("signalId", "Converted signal ID"),
              select(
                "kind",
                "Outcome",
                options(["conversation", "proposal", "instruction"]),
              ),
              field("occurredAt", "Date and time", "datetime-local"),
            ]}
            submit={(v) =>
              mutate("outcomes", {
                signalId: value(v, "signalId"),
                kind: value(v, "kind"),
                occurredAt: dateTime(v, "occurredAt"),
              })
            }
          />
        </>
      )}
    </div>
  );
}
function EvidenceCard({ passage: p }: { passage: EvidencePassage }) {
  return (
    <article
      id={p.passageId}
      className="rounded border border-ink/15 bg-white/60 p-5 space-y-3"
    >
      <h3 className="font-serif text-xl">{p.title}</h3>
      <p className="whitespace-pre-wrap text-sm leading-7">{p.text}</p>
      <dl className="grid gap-2 text-xs text-ink/65">
        <div>
          Locator:{" "}
          {typeof p.locator === "object"
            ? Object.values(p.locator as object).join(" ")
            : String(p.locator)}
        </div>
        <div>
          Retrieved: {date(p.retrievedAt)} · Published: {date(p.publishedAt)} ·
          Event: {date(p.eventAt)}
        </div>
        <div className="break-all">Version: {p.versionId}</div>
      </dl>
      <p className="text-xs">{p.attribution}</p>
      {/^https:\/\//.test(p.url) && (
        <a
          href={p.url}
          target="_blank"
          rel="noreferrer"
          className="text-sm underline"
        >
          Open original source
        </a>
      )}
    </article>
  );
}
function RunList({
  rows,
  mutate,
}: {
  rows: Row[];
  mutate: (p: string, b: unknown, m?: string) => Promise<unknown>;
}) {
  return (
    <DataTable
      rows={rows}
      columns={[
        {
          key: "id",
          title: "Run",
          render: (r) => (
            <span className="font-mono text-xs">
              {String(r.id).slice(0, 8)}
            </span>
          ),
        },
        { key: "status", title: "Status" },
        { key: "actual_tokens", title: "Model tokens" },
        {
          key: "actual_pence",
          title: "Charged ceiling",
          render: (r) => "£" + (Number(r.actual_pence) / 100).toFixed(2),
        },
        {
          key: "coverage",
          title: "Coverage",
          render: (r) => (
            <div className="space-y-2">
              {Object.entries((r.coverage ?? {}) as Record<string, Row>).map(
                ([key, c]) => (
                  <p key={key}>
                    {c.complete ? "Complete" : "Partial"}:{" "}
                    {Array.isArray(c.notes)
                      ? c.notes.join("; ")
                      : label(c.note)}
                  </p>
                ),
              )}
              {(r.jobs as Row[] | undefined)?.map((j) => (
                <p key={String(j.id)}>
                  {label(j.status)}
                  {j.error ? ": " + label(j.error) : ""}
                </p>
              ))}
            </div>
          ),
        },
        {
          key: "cancel",
          title: "Action",
          render: (r) =>
            ["queued", "running", "retry"].includes(String(r.status)) ? (
              <ActionForm
                title="Cancel run"
                fields={[]}
                button="Cancel"
                submit={() => mutate("runs/" + r.id, {}, "DELETE")}
              />
            ) : (
              date(r.finished_at)
            ),
        },
      ]}
    />
  );
}
function SignalList({
  rows,
  directors,
  mutate,
}: {
  rows: Row[];
  directors: Row[];
  mutate: (p: string, b: unknown, m?: string) => Promise<unknown>;
}) {
  return (
    <div className="space-y-5">
      {!rows.length && <p>No proposed signals yet.</p>}
      {rows.map((s) => (
        <article
          key={String(s.id)}
          className="rounded border border-ink/15 p-5 space-y-4"
        >
          <div className="flex flex-wrap justify-between gap-3">
            <h3 className="font-serif text-2xl">
              {label(s.organisation)}: {label(s.event_type)}
            </h3>
            <span className="rounded bg-green/10 px-3 py-1">
              Priority {label((s.priority as Row)?.score)} / 100
            </span>
          </div>
          <p className="text-sm">
            {label(s.status)} · {label(s.kind)} · Event {date(s.occurred_at)} ·
            Confidence {Math.round(Number(s.confidence) * 100)}% · Half-life{" "}
            {label(s.half_life_days)} days
          </p>
          <p className="text-xs text-ink/65">
            {s.suppressed ? "Suppressed. " : ""}
            {s.independence_confirmed
              ? "Independent event confirmed. "
              : "Independence requires review. "}
            Scoring model: {label(s.scoring_version)}. Repeated records of the
            same event do not create corroboration.
          </p>
          <Link
            className="text-sm underline"
            href={"/portal/research/investigations/" + s.investigation_id}
          >
            Inspect supporting claims
          </Link>
          <ActionForm
            title="Director review"
            fields={[
              select(
                "action",
                "Decision",
                options(["approve", "dismiss", "reopen"]),
              ),
              field("reason", "Review reason", "textarea"),
              field(
                "independenceConfirmed",
                "I have checked that this is an independent event",
                "checkbox",
                false,
              ),
            ]}
            submit={(v) =>
              mutate("signals/" + s.id + "/review", {
                revision: s.revision,
                action: value(v, "action"),
                reason: value(v, "reason"),
                independenceConfirmed:
                  value(v, "independenceConfirmed") === "on",
              })
            }
          />
          {s.status === "reviewed" && (
            <ActionForm
              title="Convert to a live lead"
              button="Create live lead"
              fields={[
                select(
                  "ownerId",
                  "Director owner",
                  directors.map((d) => ({
                    value: String(d.id),
                    label: label(d.name),
                  })),
                ),
                field(
                  "singleEventReason",
                  "Single-event exception reason (if fewer than two independent events)",
                  "textarea",
                  false,
                ),
              ]}
              submit={async (v) => {
                const result = (await mutate("signals/" + s.id + "/convert", {
                  ownerId: value(v, "ownerId"),
                  reviewId: s.review_id,
                  singleEventReason: nullable(v, "singleEventReason"),
                })) as { pursuitId: string };
                window.location.assign("/portal/pursuits/" + result.pursuitId);
              }}
            />
          )}
          <ResearchDecisions signalId={String(s.id)} revision={Number(s.revision)} directors={directors} onSaved={()=>mutate('signals',undefined)}/>
          <ActionForm
            title="Suppress this signal"
            fields={[
              field("reason", "Reason", "textarea"),
              field(
                "expiresAt",
                "Suppression expires",
                "datetime-local",
                false,
              ),
            ]}
            submit={(v) =>
              mutate("suppressions", {
                target: s.id,
                scope: "signal",
                reason: value(v, "reason"),
                expiresAt: dateTime(v, "expiresAt"),
              })
            }
          />
        </article>
      ))}
    </div>
  );
}
function Investigation({
  detail,
  sources,
  entities,
  directors,
  mutate,
}: {
  detail: Row;
  sources: SourceSettings[];
  entities: { value: string; label: string }[];
  directors: Row[];
  mutate: (p: string, b: unknown, m?: string) => Promise<unknown>;
}) {
  const i = detail.investigation as InvestigationSummary,
    evidence = (detail.evidence ?? []) as EvidencePassage[],
    claims = (detail.claims ?? []) as Row[],
    runs = (detail.runs ?? []) as Row[],
    answers = (detail.answers ?? []) as Row[];
  if (!i) return null;
  const prefix = "investigations/" + i.id;
  return (
    <div className="space-y-8">
      <Panel title={i.question}>
        <p>
          {i.scope.subject} · {i.scope.jurisdiction} · {i.status}
        </p>
        <p className="text-sm">
          Budget: {i.budget.maxRequests} requests,{" "}
          {i.budget.maxTokens.toLocaleString()} model tokens, £
          {(i.budget.maxCostPence / 100).toFixed(2)} maximum.
        </p>
        <RunList rows={runs} mutate={mutate} />
      </Panel>
      <Panel title="Evidence">
        <p className="text-sm text-ink/65">
          Only current passages retrieved by this investigation are shown.
          Register feeds may cover a wider population. Confirm that each
          selected passage concerns the intended subject.
        </p>
        {evidence.length ? (
          evidence.map((p) => (
            <details key={p.passageId} className="rounded border border-ink/15">
              <summary className="cursor-pointer p-4">
                {p.title} · {p.text.slice(0, 100)}
              </summary>
              <EvidenceCard passage={p} />
            </details>
          ))
        ) : (
          <p>
            No available passages yet. Check run status and source coverage.
          </p>
        )}
      </Panel>
      <EntitiesReview evidence={evidence} onReviewed={async()=>{await mutate('entities',undefined);}}/>
      <ActionForm
        title="Propose an evidence-backed claim"
        fields={[
          field("text", "Proposed finding", "textarea"),
          select(
            "kind",
            "Finding type",
            options(["observation", "allegation", "inference"]),
          ),
          field("quotation", "Exact quotation (optional)", "textarea", false),
          refField(evidence),
        ]}
        submit={(v) =>
          mutate(prefix + "/claims", {
            text: value(v, "text"),
            kind: value(v, "kind"),
            evidence: refs(evidence, v),
            ...(value(v, "quotation")
              ? { quotation: value(v, "quotation") }
              : {}),
          })
        }
      />
      <Panel title="Claims">
        <DataTable
          rows={claims}
          columns={[
            { key: "text", title: "Finding" },
            { key: "kind", title: "Type" },
            { key: "status", title: "Director verification" },
            {
              key: "evidence",
              title: "Evidence",
              render: (r) => (
                <div>
                  {(r.evidence as EvidenceRef[]).map((e) => (
                    <Link
                      key={e.passageId}
                      className="mr-3 underline"
                      href={"/portal/research/evidence/" + e.passageId}
                    >
                      Passage {e.passageId.slice(0, 8)}
                    </Link>
                  ))}
                </div>
              ),
            },
          ]}
        />
      </Panel>
      <ActionForm
        title="Confirm the research identity"
        fields={[
          select("entityId", "Identity", entities),
          field("reason", "Identity confirmation reason", "textarea"),
          refField(evidence),
        ]}
        submit={(v) =>
          mutate("entities/" + value(v, "entityId") + "/confirm", {
            reason: value(v, "reason"),
            evidence: refs(evidence, v),
          })
        }
      />
      <ActionForm
        title="Propose a commercial signal"
        fields={[
          select("entityId", "Identity", entities),
          field("eventType", "Event description"),
          field("eventKey", "Underlying event reference", "text", true, ""),
          select(
            "kind",
            "Signal category",
            options(["direct", "project_change", "payment", "context"]),
          ),
          field("occurredAt", "Event date and time", "datetime-local", false),
          {
            ...field("confidence", "Confidence (0 to 1)", "number", true, 0.75),
            min: 0,
            max: 1,
            step: "0.05",
          },
          field(
            "halfLifeDays",
            "Priority half-life (days)",
            "number",
            true,
            90,
          ),
          {
            name: "claimIds",
            label: "Supporting claims",
            type: "checks",
            options: claims.map((c) => ({
              value: String(c.id),
              label: label(c.text),
            })),
          },
        ]}
        submit={(v) =>
          mutate(prefix + "/signals", {
            entityId: value(v, "entityId"),
            eventKey: value(v, "eventKey"),
            eventType: value(v, "eventType"),
            kind: value(v, "kind"),
            occurredAt: dateTime(v, "occurredAt"),
            confidence: numeric(v, "confidence"),
            halfLifeDays: numeric(v, "halfLifeDays"),
            claimIds: values(v, "claimIds"),
          })
        }
      />
      <SignalList
        rows={(detail.signals ?? []) as Row[]}
        directors={directors}
        mutate={mutate}
      />
      <Panel title="Research assistant">
        <p className="text-sm text-ink/65">
          Answers are proposed analysis. The assistant searches this
          investigation’s available evidence and verifies citation identities
          and quotations. A call reserves 80,000 tokens conservatively; the cost
          ceiling is charged where exact provider billing is unavailable.
        </p>
        <ActionForm
          title="Ask about the evidence"
          button="Ask"
          fields={[
            field("question", "Question", "textarea"),
            select(
              "sourceId",
              "Source budget",
              sources
                .filter((s) => i.scope.sources.includes(s.id))
                .map((s) => ({ value: s.id, label: s.label })),
            ),
            field(
              "maxCostPence",
              "Per-call cost ceiling (pence)",
              "number",
              true,
              100,
            ),
          ]}
          submit={(v) =>
            mutate(prefix + "/questions", {
              question: value(v, "question"),
              sourceId: value(v, "sourceId"),
              maxCostPence: numeric(v, "maxCostPence"),
            })
          }
        />
        {answers.map((a) => (
          <article
            key={String(a.id)}
            className="rounded border border-ink/15 p-5 space-y-3"
          >
            <h3 className="font-medium">{label(a.question)}</h3>
            <p className="text-xs">
              {label(a.status)} · {date(a.created_at)}
            </p>
            {(((a.answer as Row)?.findings as Row[]) ?? []).map((f, n) => (
              <div key={n}>
                <p>
                  {label(f.text)}{" "}
                  <span className="text-xs text-ink/65">({label(f.kind)})</span>
                </p>
                <p>
                  {(f.evidence as EvidenceRef[]).map((e) => (
                    <Link
                      key={e.passageId}
                      className="mr-3 text-xs underline"
                      href={"/portal/research/evidence/" + e.passageId}
                    >
                      Supporting passage
                    </Link>
                  ))}
                </p>
              </div>
            ))}
            <p className="text-sm text-amber-900">
              {(((a.answer as Row)?.limitations as string[]) ?? []).join(" ")}
            </p>
          </article>
        ))}
      </Panel>
      <ActionForm
        title="Build a report from selected claims"
        fields={[
          select(
            "runId",
            "Research run",
            runs.map((r) => ({
              value: String(r.id),
              label: String(r.id).slice(0, 8) + " · " + r.status,
            })),
          ),
          select("audience", "Audience", options(["internal", "external"])),
          field(
            "methodology",
            "Methodology and limitations",
            "textarea",
            true,
            "The director selected the cited research passages. Coverage is limited to the sources and dates recorded for this investigation.",
          ),
          {
            name: "claimIds",
            label: "Claims to include",
            type: "checks",
            options: claims.map((c) => ({
              value: String(c.id),
              label: label(c.text),
            })),
          },
        ]}
        submit={(v) =>
          mutate(prefix + "/reports", {
            runId: value(v, "runId"),
            audience: value(v, "audience"),
            methodology: value(v, "methodology"),
            findings: claims
              .filter((c) => values(v, "claimIds").includes(String(c.id)))
              .map((c) => ({
                text: c.text,
                kind: c.kind,
                evidence: c.evidence,
                ...(c.quotation ? { quotation: c.quotation } : {}),
              })),
          })
        }
      />
      <ReportList rows={(detail.reports ?? []) as Row[]} />
      <ActionForm
        title="Record a proposed calendar date"
        fields={[
          select(
            "kind",
            "Date type",
            options([
              "practical_completion",
              "retention",
              "limitation",
              "hearing",
            ]),
          ),
          field("date", "Proposed date", "date"),
          field(
            "jurisdiction",
            "Jurisdiction",
            "text",
            false,
            i.scope.jurisdiction,
          ),
          field("rule", "Rule or contract provision", "textarea", false),
          field("accrualBasis", "Accrual basis", "textarea", false),
          field("assumptions", "Assumptions and uncertainty", "textarea"),
          field(
            "reviewed",
            "I have reviewed this date and its basis",
            "checkbox",
            false,
          ),
          refField(evidence),
        ]}
        submit={(v) =>
          mutate("calendar", {
            investigationId: i.id,
            entityId: i.scope.entityId,
            kind: value(v, "kind"),
            date: value(v, "date"),
            jurisdiction: nullable(v, "jurisdiction"),
            rule: nullable(v, "rule"),
            accrualBasis: nullable(v, "accrualBasis"),
            assumptions: value(v, "assumptions"),
            reviewed: value(v, "reviewed") === "on",
            evidence: refs(evidence, v),
          })
        }
      />
      <ActionForm
        title="Record a referral relationship"
        fields={[
          select("subjectId", "Subject", entities),
          select("objectId", "Connected identity", entities),
          field("predicate", "Relationship"),
          select(
            "channel",
            "Referral channel",
            options([
              "funder",
              "insurer",
              "administrator",
              "solicitor",
              "chambers",
              "surveyor",
              "contractor",
              "expert",
              "framework",
              "other",
            ]),
          ),
          field("serviceOffer", "Relevant service"),
          select(
            "stage",
            "Stage",
            options([
              "researched",
              "introduced",
              "contacted",
              "active",
              "parked",
            ]),
          ),
          field("observedAt", "Observed date", "datetime-local"),
          {
            ...field("confidence", "Confidence (0 to 1)", "number", true, 0.75),
            step: "0.05",
          },
          refField(evidence),
        ]}
        submit={(v) =>
          mutate("referrals", {
            subjectId: value(v, "subjectId"),
            objectId: value(v, "objectId"),
            predicate: value(v, "predicate"),
            channel: value(v, "channel"),
            serviceOffer: value(v, "serviceOffer"),
            stage: value(v, "stage"),
            observedAt: dateTime(v, "observedAt"),
            confidence: numeric(v, "confidence"),
            evidence: refs(evidence, v),
          })
        }
      />
      <ActionForm
        title="Suppress this investigation"
        fields={[
          field("reason", "Reason", "textarea"),
          field("expiresAt", "Expires", "datetime-local", false),
        ]}
        submit={(v) =>
          mutate("suppressions", {
            target: i.id,
            scope: "investigation",
            reason: value(v, "reason"),
            expiresAt: dateTime(v, "expiresAt"),
          })
        }
      />
    </div>
  );
}
function ReportList({ rows }: { rows: Row[] }) {
  return (
    <DataTable
      rows={rows}
      columns={[
        {
          key: "id",
          title: "Report",
          render: (r) => (
            <Link
              href={"/portal/research/reports/" + r.id}
              className="underline"
            >
              Open report {String(r.id).slice(0, 8)}
            </Link>
          ),
        },
        { key: "audience", title: "Audience" },
        { key: "status", title: "Review state" },
        {
          key: "created_at",
          title: "Created",
          render: (r) => date(r.created_at),
        },
      ]}
    />
  );
}
function ReportView({
  data,
  mutate,
}: {
  data: Row;
  mutate: (p: string, b: unknown) => Promise<unknown>;
}) {
  const report = data.report as Row,
    evidence = data.evidence as EvidencePassage[];
  if (!report) return null;
  return (
    <div className="space-y-5">
      <p>
        {label(report.audience)} · {label(report.status)}
      </p>
      <p>{label(report.methodology)}</p>
      {(report.findings as Row[]).map((f, n) => (
        <article key={n} className="border-b border-ink/15 py-4">
          <p>
            {label(f.text)} ({label(f.kind)})
          </p>
          <div>
            {(f.evidence as EvidenceRef[]).map((ref) => (
              <Link
                key={ref.passageId}
                href={"/portal/research/evidence/" + ref.passageId}
                className="mr-3 text-sm underline"
              >
                {evidence.find((e) => e.passageId === ref.passageId)?.title ??
                  "Evidence"}
              </Link>
            ))}
          </div>
        </article>
      ))}
      <Panel title="Coverage">
        {(report.coverage as Row[]).map((c) => (
          <p key={String(c.sourceId)}>
            {label(c.state)}: {label(c.note)}
          </p>
        ))}
      </Panel>
      <ActionForm
        title="Review the report"
        fields={[
          field("reason", "Review reason", "textarea"),
          {
            name: "acceptedSourceIds",
            label: "I reviewed the rights and proposed use for these sources",
            type: "checks",
            options: [
              ...new Map(
                evidence.map((e) => [
                  e.sourceId,
                  { value: e.sourceId, label: e.attribution },
                ]),
              ).values(),
            ],
          },
        ]}
        submit={(v) =>
          mutate("reports/" + report.id + "/review", {
            reason: value(v, "reason"),
            acceptedSourceIds: values(v, "acceptedSourceIds"),
          })
        }
      />
      {(report.audience === "internal" || report.status === "reviewed") && (
        <div className="flex gap-4">
          {["markdown", "csv", "html"].map((f) => (
            <a
              key={f}
              className="rounded bg-green px-4 py-2 text-sm text-cream"
              href={`${base}/reports/${report.id}/export?format=${f}`}
            >
              Export {f === "html" ? "print view" : f.toUpperCase()}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
function CaseLawSearch({ initial,initialAuthority }: { initial: Row[];initialAuthority?:Row }) {
  const [rows, setRows] = useState(initial),
    [selected, setSelected] = useState<string[]>([]),
    [reader, setReader] = useState<Row | null>(initialAuthority??null),
    [comparison, setComparison] = useState<unknown>(null),
    [error, setError] = useState("");
  useEffect(() => setRows(initial), [initial]);
  return (
    <div className="space-y-6">
      <p className="text-sm">{QCS_CASE_LAW_ACKNOWLEDGEMENT}</p>
      <p className="rounded border border-brass/40 bg-brass/10 p-4 text-sm">
        {CASE_LAW_COVERAGE_NOTICE}
      </p>
      <ActionForm
        title="Search stored authorities"
        button="Search"
        fields={[
          field("query", "Issue or keywords", "text", false),
          field("party", "Party", "text", false),
          field("judge", "Judge", "text", false),
          field("citation", "Neutral citation", "text", false),
          field("court", "Court code", "text", false),
          field("from", "From", "date", false),
          field("to", "To", "date", false),
        ]}
        submit={async (v) => {
          const p = new URLSearchParams();
          Object.entries(v).forEach(([k, val]) => {
            if (val) p.set(k, String(val));
          });
          setRows(await api<Row[]>(base + "/case-law?" + p));
        }}
      />
      {error && <p role="alert">{error}</p>}
      <DataTable
        rows={rows}
        columns={[
          {
            key: "selected",
            title: "Compare",
            render: (r) => (
              <input
                aria-label={"Select " + r.title}
                type="checkbox"
                checked={selected.includes(String(r.documentId))}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, String(r.documentId)]
                      : selected.filter((id) => id !== r.documentId),
                  )
                }
              />
            ),
          },
          {
            key: "title",
            title: "Authority",
            render: (r) => (
              <button
                className="text-left underline"
                onClick={() => {
                  void api<Row>(base + "/case-law/" + r.documentId)
                    .then(setReader)
                    .catch((e) => setError(e.message));
                }}
              >
                {label(r.title)}
              </button>
            ),
          },
          {
            key: "identifiers",
            title: "Citations",
            render: (r) =>
              (r.identifiers as Row[]).map((i) => label(i.value)).join(", "),
          },
          {
            key: "coverage",
            title: "Coverage",
            render: (r) => (r.coverage as string[]).join("; "),
          },
        ]}
        empty="No stored judgments match. Commission a Find Case Law investigation to retrieve authorities."
      />
      {reader && (
        <Panel title={label(reader.title)}>
          {(reader.passages as Row[]).map((p) => (
            <article key={String(p.id)} className="border-b border-ink/15 py-4">
              <p className="text-xs text-ink/65">
                {Object.values(p.locator as object).join(" ")}
              </p>
              <p className="whitespace-pre-wrap leading-7">{label(p.text)}</p>
            </article>
          ))}
          <EntitiesReview documentId={String(reader.documentId)} evidence={(reader.passages as Row[]).map(p=>({documentId:String(reader.documentId),versionId:String(reader.versionId),passageId:String(p.id),title:String(reader.title),text:String(p.text),locator:p.locator}))}/>
        </Panel>
      )}
      <ActionForm
        title="Compare selected authorities"
        button="Compare"
        fields={[field("issue", "Issue to compare", "textarea")]}
        submit={async (v) =>
          setComparison(
            await api(base + "/case-law/compare", {
              documentIds: selected,
              issue: value(v, "issue"),
            }),
          )
        }
      />
      {comparison !== null && <Comparison value={comparison} />}
    </div>
  );
}
function Comparison({ value: v }: { value: unknown }) {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return <p className="whitespace-pre-wrap">{v}</p>;
  if (Array.isArray(v))
    return (
      <div className="space-y-4">
        {v.map((x, n) => (
          <Comparison key={n} value={x} />
        ))}
      </div>
    );
  if (typeof v === "object")
    return (
      <dl className="rounded border border-ink/15 p-4 space-y-2">
        {Object.entries(v)
          .filter(
            ([k]) =>
              !["documentId", "versionId", "passageId", "id"].includes(k),
          )
          .map(([k, x]) => (
            <div key={k}>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink/60">
                {k}
              </dt>
              <dd>
                <Comparison value={x} />
              </dd>
            </div>
          ))}
      </dl>
    );
  return <span>{String(v)}</span>;
}
