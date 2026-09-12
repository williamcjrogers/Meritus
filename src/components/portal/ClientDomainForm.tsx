"use client";

import { useActionState } from "react";
import { addClientDomainAction, type AddClientDomainState } from "@/lib/portal/client-actions";
import type { PursuitOption } from "./ClientDomainList";

export function ClientDomainForm({ pursuits }: { pursuits: PursuitOption[] }) {
  const [state, action, pending] = useActionState<AddClientDomainState, FormData>(addClientDomainAction, null);

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="portal-label">Company email domain<span className="text-brass"> *</span></span>
        <input name="domain" type="text" required className="portal-field" placeholder="example-firm.co.uk" autoComplete="off" />
      </label>
      <label className="block">
        <span className="portal-label">Firm<span className="text-brass"> *</span></span>
        <input name="firm" type="text" required className="portal-field" placeholder="Example Firm LLP" autoComplete="organization" />
      </label>
      <label className="block">
        <span className="portal-label">Pursuit (files land on its dossier)</span>
        <select name="pursuitId" className="portal-field" defaultValue="">
          <option value="">Not linked yet</option>
          {pursuits.map((pursuit) => (
            <option key={pursuit.id} value={pursuit.id}>
              {pursuit.firm} · {pursuit.stage}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="btn-brass text-[12px]" disabled={pending}>
        {pending ? "Adding…" : "Add domain"}
      </button>
      {state?.ok ? <p className="text-[12px] text-ink/70">{state.domain} can now request links at meritusvia.com/access.</p> : null}
      {state && !state.ok ? <p className="text-[12px] text-oxblood">{state.error}</p> : null}
    </form>
  );
}
