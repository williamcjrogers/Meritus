"use client";

import { useActionState } from "react";
import { inviteClientAction, type InviteClientState } from "@/lib/portal/client-actions";

export function InviteClientForm() {
  const [state, action, pending] = useActionState<InviteClientState, FormData>(
    inviteClientAction,
    null
  );

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="portal-label">
          Client email<span className="text-brass"> *</span>
        </span>
        <input
          name="email"
          type="email"
          required
          className="portal-field"
          placeholder="jane@bree.co.uk"
          autoComplete="off"
        />
      </label>
      <label className="block">
        <span className="portal-label">
          VeriCase workspace id<span className="text-brass"> *</span>
        </span>
        <input
          name="vericaseWorkspaceId"
          type="text"
          required
          className="portal-field"
          placeholder="Workspace id from WR2.0"
          autoComplete="off"
        />
      </label>
      <label className="block">
        <span className="portal-label">
          VeriCase workspace name<span className="text-brass"> *</span>
        </span>
        <input
          name="vericaseWorkspaceName"
          type="text"
          required
          className="portal-field"
          placeholder="Byoot"
          autoComplete="off"
        />
      </label>
      <button type="submit" className="btn-brass text-[12px]" disabled={pending}>
        {pending ? "Sending invitation…" : "Invite client"}
      </button>
      {state?.ok ? (
        <p className="text-[12px] text-ink/70">
          Invitation sent. Files stay in that VeriCase WR2.0 workspace — this desk does not upload
          or download them.
        </p>
      ) : null}
      {state && !state.ok ? <p className="text-[12px] text-oxblood">{state.error}</p> : null}
    </form>
  );
}
