"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
  ActionForm,
  DataTable,
  Panel,
  api,
  value,
  numeric,
  dateTime,
  date,
  type Row,
  type Field,
} from "./ResearchControls";
import type { SourceSettings } from "@/lib/db/research-workflow";
import { SourceHealth } from "./SourceHealth";
const base = "/api/portal/research";
const field = (
  name: string,
  label: string,
  type: Field["type"] = "text",
  required = true,
  initial?: string | number,
): Field => ({ name, label, type, required, value: initial });
const select = (
  name: string,
  label: string,
  options: { value: string; label: string }[],
  required = true,
): Field => ({ name, label, type: "select", options, required });
export function SourceSettingsForms({
  sources,
  reload,
}: {
  sources: SourceSettings[];
  reload: () => Promise<void>;
}) {
  const [rights, setRights] = useState<Row[]>([]),
    [documents, setDocuments] = useState<Row[]>([]),
    [error, setError] = useState("");
  const load = async () => {
    try {
      const [r, d] = await Promise.all([
        api<Row[]>(base + "/rights"),
        api<Row[]>(base + "/documents"),
      ]);
      setRights(r);
      setDocuments(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Source records unavailable");
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const save = async (path: string, body: unknown, method = "POST") => {
    const result = await api(base + "/" + path, body, method);
    await reload();
    await load();
    return result;
  };
  return (
    <div className="space-y-8">
      {error && <p role="alert">{error}</p>}
      <Panel title="Source health and limits">
        {sources.map((s) => (
          <details
            key={s.id}
            className="rounded border border-ink/15 bg-white/50 p-5"
          >
            <summary className="cursor-pointer font-medium">
              {s.label} · {s.status}
            </summary>
            <div className="space-y-4 pt-4">
              <SourceHealth source={s} />
              <p className="text-sm">{s.attribution}</p>
              <a
                className="text-sm underline"
                href={s.termsUrl}
                target="_blank"
                rel="noreferrer"
              >
                Recorded source terms ({s.termsVersion})
              </a>
              <p className="text-xs">
                Credential reference{" "}
                {s.credentialConfigured
                  ? "recorded"
                  : "not required or not recorded"}
                . Secret values are configured in the server environment.
              </p>
              <ActionForm
                title="Source controls"
                fields={[
                  select(
                    "status",
                    "Status",
                    ["ready", "paused", "unavailable"].map((v) => ({
                      value: v,
                      label: v,
                    })),
                  ),
                  field(
                    "dailyRequests",
                    "Daily requests",
                    "number",
                    true,
                    s.dailyRequests,
                  ),
                  field(
                    "dailyTokens",
                    "Daily model tokens",
                    "number",
                    true,
                    s.dailyTokens,
                  ),
                  field(
                    "dailyPence",
                    "Daily model budget (pence)",
                    "number",
                    true,
                    s.dailyPence,
                  ),
                  field(
                    "companyNumber",
                    "Companies House number (Companies House only)",
                    "text",
                    false,
                    String(s.selection.companyNumber ?? ""),
                  ),
                  field(
                    "noticeTypes",
                    "Gazette notice type codes, comma separated",
                    "text",
                    false,
                    Array.isArray(s.selection.noticeTypes)
                      ? s.selection.noticeTypes.join(",")
                      : "",
                  ),
                ]}
                submit={(v) =>
                  save(
                    "sources/" + s.id,
                    {
                      status: value(v, "status"),
                      dailyRequests: numeric(v, "dailyRequests"),
                      dailyTokens: numeric(v, "dailyTokens"),
                      dailyPence: numeric(v, "dailyPence"),
                      ...(s.provider === "companies-house"
                        ? {
                            selection: {
                              companyNumber: value(v, "companyNumber")
                                .trim()
                                .toUpperCase()
                                .padStart(8, "0"),
                            },
                          }
                        : s.provider === "gazette"
                          ? {
                              selection: {
                                noticeTypes: value(v, "noticeTypes")
                                  .split(",")
                                  .map((x) => x.trim())
                                  .filter(Boolean),
                              },
                            }
                          : {}),
                    },
                    "PATCH",
                  )
                }
              />
            </div>
          </details>
        ))}
      </Panel>
      <Panel title="Rights register">
        <DataTable
          rows={rights}
          columns={[
            { key: "holder", title: "Holder" },
            { key: "material", title: "Material" },
            { key: "purpose", title: "Authorised purpose" },
            { key: "agreement_ref", title: "Agreement reference" },
            {
              key: "effective_at",
              title: "Effective",
              render: (r) => date(r.effective_at),
            },
            {
              key: "expires_at",
              title: "Expires",
              render: (r) => date(r.expires_at),
            },
          ]}
        />
        <ActionForm
          title="Record a source licence or reuse assessment"
          fields={[
            field(
              "holder",
              "Rights holder",
              "text",
              true,
              "Quantum Commercial Solutions Limited",
            ),
            field("material", "Material covered"),
            field("purpose", "Authorised purpose", "textarea"),
            field("agreementRef", "Agreement or terms reference"),
            field(
              "agreementText",
              "Agreement text used for integrity hash",
              "textarea",
            ),
            field("effectiveAt", "Effective date and time", "datetime-local"),
            field("expiresAt", "Expiry date and time", "datetime-local", false),
            field(
              "transferConditions",
              "Transfer conditions",
              "textarea",
              false,
            ),
            field(
              "retentionInstructions",
              "Retention instructions",
              "textarea",
              false,
            ),
            field(
              "withdrawalInstructions",
              "Withdrawal instructions",
              "textarea",
              false,
            ),
            field("useAssessment", "Assessment of intended use", "textarea"),
          ]}
          submit={(v) =>
            save("rights", {
              ...v,
              effectiveAt: dateTime(v, "effectiveAt"),
              expiresAt: dateTime(v, "expiresAt"),
            })
          }
        />
      </Panel>
      <ActionForm
        title="Register a publication or licensed import source"
        fields={[
          field("label", "Source name"),
          select(
            "provider",
            "Retrieval method",
            [
              "research-import",
              "commercial-import",
              "court-listings",
              "bailii",
              "publications",
              "building-safety",
            ].map((v) => ({ value: v, label: v.replaceAll("-", " ") })),
          ),
          field("host", "Publisher hostname"),
          field(
            "url",
            "Publication HTTPS URL (publication sources only)",
            "text",
            false,
          ),
          select(
            "publicationKind",
            "Publication category",
            ["programme", "accounts", "rns", "news", "recruitment"].map(
              (v) => ({ value: v, label: v }),
            ),
            false,
          ),
          field(
            "subjectId",
            "Public subject reference (publication sources only)",
            "text",
            false,
          ),
          field("termsUrl", "Terms HTTPS URL"),
          field(
            "termsVersion",
            "Terms version",
            "text",
            true,
            "Reviewed " + new Date().toISOString().slice(0, 10),
          ),
          field("attribution", "Attribution", "textarea"),
          field("purpose", "Research purpose", "textarea"),
          select(
            "rightsId",
            "Recorded rights",
            rights.map((r) => ({
              value: String(r.id),
              label: String(r.holder) + " · " + r.material,
            })),
          ),
          field("backfillStart", "Earliest retrieval date", "date"),
          field(
            "cadenceSeconds",
            "Refresh interval (seconds)",
            "number",
            true,
            86400,
          ),
          field("dailyRequests", "Daily request cap", "number", true, 100),
          field("dailyTokens", "Daily model token cap", "number", true, 100000),
          field(
            "dailyPence",
            "Daily model cost cap (pence)",
            "number",
            true,
            1000,
          ),
        ]}
        submit={(v) => {
          const provider = value(v, "provider"),
            selection =
              provider === "publications"
                ? {
                    url: value(v, "url"),
                    kind: value(v, "publicationKind"),
                    subjectId: value(v, "subjectId"),
                  }
                : provider === "building-safety"
                  ? { publicationUrl: value(v, "url") }
                  : {};
          return save("sources", {
            label: value(v, "label"),
            provider,
            hosts: [value(v, "host").trim().toLowerCase()],
            accessMethod:
              provider.includes("import") ||
              ["court-listings", "bailii"].includes(provider)
                ? "licensed_import"
                : "public_https",
            termsUrl: value(v, "termsUrl"),
            termsVersion: value(v, "termsVersion"),
            termsReviewedAt: new Date().toISOString(),
            attribution: value(v, "attribution"),
            operator: "QCS",
            purpose: value(v, "purpose"),
            rightsId: value(v, "rightsId"),
            credentialRef: null,
            status: "paused",
            selection,
            backfillStart: dateTime(v, "backfillStart"),
            cadenceSeconds: numeric(v, "cadenceSeconds"),
            freshnessSeconds: numeric(v, "cadenceSeconds") * 2,
            requestLimit: 10,
            windowSeconds: 60,
            dailyRequests: numeric(v, "dailyRequests"),
            dailyTokens: numeric(v, "dailyTokens"),
            dailyPence: numeric(v, "dailyPence"),
          });
        }}
      />
      <ImportForm sources={sources} reload={reload} />
      <Panel title="Document availability">
        <p className="text-sm">
          Reinstatement authorises a fresh publisher check. Previously withdrawn
          text remains unavailable until a new version is retrieved.
        </p>
        {documents.map((d) => (
          <article
            key={String(d.id)}
            className="rounded border border-ink/15 p-4 space-y-2"
          >
            <p>
              {String(d.source)} · {String(d.provider_id)}
            </p>
            <p className="text-sm">
              {String(d.status)}
              {d.withdrawal_reason ? ": " + String(d.withdrawal_reason) : ""}
            </p>
            {d.status !== "available" && (
              <ActionForm
                title="Review reinstatement"
                button="Authorise fresh retrieval"
                fields={[
                  field(
                    "reason",
                    "Evidence and reason for reinstatement",
                    "textarea",
                  ),
                ]}
                submit={(v) =>
                  save("documents/" + d.id + "/reinstate", {
                    reason: value(v, "reason"),
                  })
                }
              />
            )}
          </article>
        ))}
      </Panel>
    </div>
  );
}
function ImportForm({
  sources,
  reload,
}: {
  sources: SourceSettings[];
  reload: () => Promise<void>;
}) {
  const [requestId] = useState(() => crypto.randomUUID()),
    [preview, setPreview] = useState<Row | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(e.currentTarget),
      button = (e.nativeEvent as SubmitEvent)
        .submitter as HTMLButtonElement | null;
    form.set("action", button?.value ?? "preview");
    form.set("requestId", requestId);
    try {
      const response = await fetch(base + "/imports", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Import failed");
      if (result.investigationId)
        window.location.assign(
          "/portal/research/investigations/" + result.investigationId,
        );
      else setPreview(result);
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel title="Preview and import research material">
      <p className="text-sm">
        Add a licensed CSV or JSON file up to 4 MiB. Larger CSV files must be split into complete-record parts before portal upload. Map the source column names
        below. This creates a separate research investigation. Split parts remain
        partial coverage pending complete manifest verification. Uploading one file
        does not establish coverage of the publisher's full population.
      </p>
      <form
        onSubmit={submit}
        className="rounded border border-ink/15 bg-white/50 p-5 space-y-4"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            Registered source
            <select
              name="sourceId"
              required
              className="block w-full border p-2"
            >
              <option value="">Choose</option>
              {sources
                .filter((s) =>
                  [
                    "research-import",
                    "commercial-import",
                    "court-listings",
                    "bailii",
                  ].includes(s.provider),
                )
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({s.status})
                  </option>
                ))}
            </select>
          </label>
          <label>
            File format
            <select name="format" className="block w-full border p-2">
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </label>
          <label>
            Research file
            <input
              type="file"
              name="file"
              accept=".csv,.json"
              required
              className="block w-full border p-2"
            />
          </label>
          <label>
            Total number of parts
            <input name="partCount" type="number" min="1" max="10000" defaultValue="1" required className="block w-full border p-2" />
          </label>
          <label>
            Part number (starts at 1)
            <input name="partIndex" type="number" min="1" max="10000" defaultValue="1" required className="block w-full border p-2" />
          </label>
          <label className="md:col-span-2">
            Original snapshot hash (required for split parts)
            <input name="snapshotHash" pattern="[a-fA-F0-9]{64}" minLength={64} maxLength={64} className="block w-full border p-2" aria-describedby="research-import-snapshot-help" />
            <span id="research-import-snapshot-help" className="mt-1 block text-xs text-ink/65">Use the 64-character hash of the original file from the splitter's manifest, shared by every part.</span>
          </label>
          {[
            ["question", "Research question"],
            ["subject", "Public subject"],
            ["id", "Record ID column"],
            ["title", "Title column"],
            ["text", "Text column"],
            ["companyNumber", "Company number column"],
            ["eventAt", "Event date column"],
            ["url", "Source URL column"],
          ].map(([name, text]) => (
            <label key={name}>
              {text}
              <input
                name={name}
                required={["question", "subject", "id", "text"].includes(name)}
                className="block w-full border p-2"
              />
            </label>
          ))}
        </div>
        <div className="flex gap-4">
          <button
            disabled={busy}
            name="action"
            value="preview"
            className="rounded border border-green px-4 py-2"
          >
            Preview mapping
          </button>
          <button
            disabled={busy}
            name="action"
            value="import"
            className="rounded bg-green text-cream px-4 py-2"
          >
            Validate and start import
          </button>
        </div>
        <p role="alert">{message}</p>
      </form>
      {preview && (
        <>
          <p>
            {(preview.errors as Row[]).length} mapping errors. Preview shows up
            to 250 rows.
          </p>
          <DataTable
            rows={preview.errors as Row[]}
            columns={[
              { key: "row", title: "Row" },
              { key: "field", title: "Field" },
              { key: "message", title: "Correction required" },
            ]}
            empty="No mapping errors found."
          />
          <DataTable
            rows={preview.rows as Row[]}
            columns={Object.keys((preview.rows as Row[])[0] ?? {}).map(
              (key) => ({ key, title: key }),
            )}
          />
        </>
      )}
    </Panel>
  );
}
