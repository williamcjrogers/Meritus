"use client";

import { UNASSIGNED_NAME, type Director } from "@/lib/portal/director-helpers";

export function OwnerSelect({
  value,
  directors,
  onChange,
  disabled = false,
}: {
  value: string | null;
  directors: Director[];
  onChange: (ownerId: string | null) => void;
  disabled?: boolean;
}) {
  const known = value && directors.some((d) => d.id === value);
  return (
    <label className="block">
      <span className="portal-label">Owner</span>
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        disabled={disabled}
        aria-label="Owner"
        className="portal-field min-w-[180px]"
      >
        <option value="">{UNASSIGNED_NAME}</option>
        {directors.map((director) => (
          <option key={director.id} value={director.id}>
            {director.name}
          </option>
        ))}
        {value && !known && <option value={value}>Another director</option>}
      </select>
    </label>
  );
}
