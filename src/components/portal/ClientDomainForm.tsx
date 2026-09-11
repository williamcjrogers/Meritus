"use client";

import { useActionState } from "react";
import { addClientDomainAction, type AddClientDomainState } from "@/lib/portal/client-actions";

export function ClientDomainForm() {
  const [state, action, pending] = useActionState<AddClientDomainState, FormData>(
    addClientDomainAction,
    null
  );

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="portal-label">
          Company domain<span className="text-brass"> *</span>
        </span>
        <input
          name="domain"
          type="text"
          required
          className="portal-field"
          placeholder="bree.co.uk"
          autoComplete="off"
        />
      </label>
      <label className="block">
        <span className="portal-label">VeriCase workspace id</span>
        <input name="vericaseWorkspaceId" type="text" className="portal-field" autoComplete="off" />
      </label>
      <label className="block">
        <span className="portal-label">VeriCase workspace name</span>
        <input name="vericaseWorkspaceName" type="text" className="portal-field" autoComplete="off" />
      </label>
      <button type="submit" className="btn-outline text-[12px]" disabled={pending}>
        {pending ? "Adding…" : "Add domain"}
      </button>
      {state?.ok ? (
        <p className="text-[12px] text-ink/70">
          Domain listed.{state.allowlistNote ? ` ${state.allowlistNote}` : ""}
        </p>
      ) : null}
      {state && !state.ok ? <p className="text-[12px] text-oxblood">{state.error}</p> : null}
    </form>
  );
}
