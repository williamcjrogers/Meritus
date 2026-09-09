"use client";

import { useState } from "react";
import { CONTACT_FORM_OPTIONS } from "@/lib/constants";
import type { ActionResult, CreateResult, PursuitFormInput } from "@/lib/portal/types";

const SOURCES: Array<{ value: PursuitFormInput["source"]; label: string }> = [
  { value: "referral", label: "Referral" },
  { value: "introduction", label: "Introduction" },
  { value: "existing_client", label: "Existing client" },
  { value: "other", label: "Other" },
];

function text(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export function PursuitForm({
  mode,
  initial = {},
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit";
  initial?: Partial<PursuitFormInput>;
  onSubmit: (input: PursuitFormInput) => Promise<CreateResult | ActionResult>;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const firm = text(form, "firm");
    const disputeNature = text(form, "disputeNature");
    if (!firm) {
      setError("Give the firm a name");
      return;
    }
    if (!disputeNature) {
      setError("Choose the nature of the dispute");
      return;
    }
    const input: PursuitFormInput = {
      firm,
      contactName: text(form, "contactName"),
      contactEmail: text(form, "contactEmail"),
      contactPhone: text(form, "contactPhone"),
      website: text(form, "website"),
      companyNumber: text(form, "companyNumber"),
      party: text(form, "party"),
      partyCompanyNumber: text(form, "partyCompanyNumber"),
      counterparty: text(form, "counterparty"),
      disputeNature,
      approximateValue: text(form, "approximateValue"),
      forum: text(form, "forum"),
      source: (text(form, "source") as PursuitFormInput["source"]) ?? "other",
      sourceDetail: text(form, "sourceDetail"),
      summary: text(form, "summary"),
    };
    setPending(true);
    setError(null);
    const result = await onSubmit(input);
    setPending(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <fieldset className="space-y-4">
        <legend className="portal-eyebrow mb-2">Enquirer</legend>
        <Field label="Firm" name="firm" defaultValue={initial.firm} required />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Contact" name="contactName" defaultValue={initial.contactName} />
          <Field label="Email" name="contactEmail" type="email" defaultValue={initial.contactEmail} />
          <Field label="Phone" name="contactPhone" type="tel" defaultValue={initial.contactPhone} />
          <Field label="Website" name="website" placeholder="https://" defaultValue={initial.website} />
          <Field label="Company number" name="companyNumber" defaultValue={initial.companyNumber} />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="portal-eyebrow mb-2">Matter</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Party we would advise" name="party" placeholder="If not the firm" defaultValue={initial.party} />
          <Field label="Party company number" name="partyCompanyNumber" defaultValue={initial.partyCompanyNumber} />
        </div>
        <Field label="Counterparty" name="counterparty" defaultValue={initial.counterparty} />
        <Select label="Nature of dispute" name="disputeNature" options={CONTACT_FORM_OPTIONS.disputeNature} defaultValue={initial.disputeNature} required />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Approximate value" name="approximateValue" options={CONTACT_FORM_OPTIONS.approximateValue} defaultValue={initial.approximateValue} />
          <Select label="Forum" name="forum" options={CONTACT_FORM_OPTIONS.forum} defaultValue={initial.forum} />
        </div>
        <label className="block">
          <span className="portal-label">Summary</span>
          <textarea name="summary" rows={4} defaultValue={initial.summary} className="portal-field resize-y" placeholder="What the matter is about" />
        </label>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="portal-eyebrow mb-2">Source</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="portal-label">Source</span>
            <select name="source" defaultValue={initial.source ?? "referral"} className="portal-field">
              {initial.source === "site_form" && <option value="site_form">Site form</option>}
              {SOURCES.map((source) => (
                <option key={source.value} value={source.value}>
                  {source.label}
                </option>
              ))}
            </select>
          </label>
          <Field label="Detail" name="sourceDetail" placeholder="Who referred, how you met" defaultValue={initial.sourceDetail} />
        </div>
      </fieldset>

      {error && <p className="text-[12px] text-oxblood">{error}</p>}
      <div className="flex items-center justify-end gap-3 border-t border-green/10 pt-5">
        <button type="button" className="btn-quiet" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
        <button type="submit" className="btn-brass text-[12px]" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Create pursuit" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="portal-label">
        {label}
        {required && <span className="text-brass"> *</span>}
      </span>
      <input name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} required={required} className="portal-field" />
    </label>
  );
}

function Select({
  label,
  name,
  options,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  options: readonly string[];
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="portal-label">
        {label}
        {required && <span className="text-brass"> *</span>}
      </span>
      <select name={name} defaultValue={defaultValue ?? ""} required={required} className="portal-field">
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
