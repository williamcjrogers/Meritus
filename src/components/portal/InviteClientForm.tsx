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
      <button type="submit" className="btn-brass text-[12px]" disabled={pending}>
        {pending ? "Sending invitation…" : "Invite client"}
      </button>
      {state?.ok ? (
        <p className="text-[12px] text-ink/70">
          Invitation sent. They sign in at /client/sign-in and dump files into the VeriCase WR2.0
          archive once their company domain is listed.
        </p>
      ) : null}
      {state && !state.ok ? <p className="text-[12px] text-oxblood">{state.error}</p> : null}
    </form>
  );
}
