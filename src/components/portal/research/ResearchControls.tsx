"use client";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
export type Row = Record<string, unknown>;
export type Values = Record<string, string | string[]>;
export const value = (v: Values, key: string) => String(v[key] ?? "");
export const values = (v: Values, key: string) =>
  Array.isArray(v[key]) ? (v[key] as string[]) : v[key] ? [String(v[key])] : [];
export const numeric = (v: Values, key: string) => Number(value(v, key));
export const nullable = (v: Values, key: string) =>
  value(v, key).trim() || null;
export const dateTime = (v: Values, key: string) =>
  value(v, key) ? new Date(value(v, key)).toISOString() : null;
export const label = (v: unknown) =>
  v === null || v === undefined ? "Not recorded" : String(v);
export const date = (v: unknown) =>
  v
    ? new Date(String(v)).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: "Europe/London",
      })
    : "Not recorded";
export async function api<T = unknown>(
  path: string,
  body?: unknown,
  method = "POST",
): Promise<T> {
  const response = await fetch(
    path,
    body === undefined
      ? { cache: "no-store" }
      : {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      String(data.error ?? "Request failed").replaceAll("_", " "),
    );
  return data as T;
}
export type Field = {
  name: string;
  label: string;
  type?:
    | "text"
    | "textarea"
    | "number"
    | "date"
    | "datetime-local"
    | "select"
    | "checkbox"
    | "checks"
    | "password";
  required?: boolean;
  value?: string | number;
  min?: number;
  max?: number;
  step?: string;
  options?: { value: string; label: string }[];
  hint?: string;
};
export function ActionForm({
  title,
  fields,
  submit,
  button = "Save",
  children,
}: {
  title: string;
  fields: Field[];
  submit: (v: Values) => Promise<unknown>;
  button?: string;
  children?: ReactNode;
}) {
  const notify = useToast();
  const formId = useId();
  const [invalidField, setInvalidField] = useState<string | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false);
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const invalid = Array.from(form.elements).find((element) => (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) && !element.validity.valid) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | undefined;
    if (invalid) {
      const field = fields.find(item => item.name === invalid.name);
      setInvalidField(invalid.name);
      setError(true);
      setMessage(invalid.validity.valueMissing ? `Complete ${field?.label ?? "this field"}.` : `Check ${field?.label ?? "this value"} and try again.`);
      invalid.focus();
      return;
    }
    setInvalidField(null);
    setBusy(true);
    setMessage("");
    const fd = new FormData(event.currentTarget),
      v: Values = {};
    for (const f of fields)
      v[f.name] =
        f.type === "checks"
          ? fd.getAll(f.name).map(String)
          : String(fd.get(f.name) ?? "");
    try {
      await submit(v);
      setError(false);
      setMessage("Saved. The latest state is shown below.");
      notify("Changes saved");
    } catch (e) {
      setError(true);
      setMessage(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form noValidate
      onSubmit={send}
      className="rounded border border-text/15 bg-white/60 p-5 space-y-4"
    >
      <h3 className="font-sans text-xl">{title}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map((f) => f.type==='checks'?(
          <fieldset key={f.name} className="md:col-span-2"><legend className="mb-2 text-[15px] font-medium">{f.label}</legend><div className="flex flex-wrap gap-x-5 gap-y-2">{f.options?.map(o=><label key={o.value} className="flex items-center gap-2"><input type="checkbox" name={f.name} value={o.value}/>{o.label}</label>)}</div>{f.hint&&<p className="mt-1 text-[13px] text-muted">{f.hint}</p>}</fieldset>
        ):(
          <label
            key={f.name}
            className={
              f.type === "textarea"
                ? "block md:col-span-2"
                : "block"
            }
          >
            <span className="mb-1 block text-[15px] font-medium">{f.label}</span>
            {f.type === "textarea" ? (
              <textarea
                name={f.name}
                aria-invalid={invalidField === f.name || undefined}
                aria-describedby={invalidField === f.name ? `${formId}-feedback` : undefined}
                required={f.required}
                defaultValue={f.value}
                rows={3}
                className="app-field resize-none"
              />
            ) : f.type === "select" ? (
              <select
                name={f.name}
                aria-invalid={invalidField === f.name || undefined}
                aria-describedby={invalidField === f.name ? `${formId}-feedback` : undefined}
                required={f.required}
                defaultValue={f.value ?? ""}
                className="app-field"
              >
                <option value="">Choose</option>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name={f.name}
                aria-invalid={invalidField === f.name || undefined}
                aria-describedby={invalidField === f.name ? `${formId}-feedback` : undefined}
                type={f.type ?? "text"}
                required={f.required}
                defaultValue={f.value}
                min={f.min}
                max={f.max}
                step={f.step}
                className={
                  f.type === "checkbox"
                    ? "size-4"
                    : "app-field"
                }
              />
            )}{" "}
            {f.hint && (
              <span className="mt-1 block text-[13px] text-muted">{f.hint}</span>
            )}
          </label>
        ))}
      </div>
      {children}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" busy={busy}>{button}</Button>
        <p
          id={`${formId}-feedback`}
          role={error ? "alert" : "status"}
          className={error ? "text-[15px] text-danger" : "text-[15px]"}
        >
          {message}
        </p>
      </div>
    </form>
  );
}
export function DataTable({
  rows,
  columns,
  empty = "No records yet.",
}: {
  rows: Row[];
  columns: { key: string; title: string; render?: (row: Row) => ReactNode }[];
  empty?: string;
}) {
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)));
  const visibleRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  if (!rows.length)
    return (
      <p className="rounded border border-dashed border-text/25 p-6 text-muted">
        {empty}
      </p>
    );
  return (
    <div><div className="overflow-x-auto rounded border border-line">
      <table className="w-full text-left text-[15px]">
        <thead className="bg-primary/5">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="p-3 font-medium">
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((r, n) => (
            <tr key={String(r.id ?? n)} className="border-t border-text/10">
              {columns.map((c) => (
                <td key={c.key} className="p-3 align-top">
                  {c.render ? c.render(r) : label(r[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>{rows.length > pageSize && <nav aria-label="Table pages" className="flex items-center gap-3 py-4"><Button variant="secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</Button><span>{(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, rows.length)} of {rows.length} loaded records</span><Button variant="secondary" disabled={currentPage * pageSize >= rows.length} onClick={() => setPage(currentPage + 1)}>Next</Button></nav>}</div>
  );
}
export function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="font-sans text-2xl">{title}</h2>
      {children}
    </section>
  );
}
