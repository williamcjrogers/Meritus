"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { addClientDomainAction, type AddClientDomainState } from "@/lib/portal/client-actions";
import { clientDomainErrorMessage, parseClientDomain } from "@/lib/portal/domains";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import type { PursuitOption } from "./ClientDomainList";

export function ClientDomainForm({ pursuits }: { pursuits: PursuitOption[] }) {
  const [domain, setDomain] = useState("");
  const [firm, setFirm] = useState("");
  const [pursuitId, setPursuitId] = useState("");
  const [errors, setErrors] = useState<{ domain?: string; firm?: string }>({});
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<AddClientDomainState, FormData>(async (previous, data) => {
    try { return await addClientDomainAction(previous, data); }
    catch { return { ok: false, error: "Organisation access could not be saved. Your details are still here; try again." }; }
  }, null);
  return <form ref={formRef} noValidate className="space-y-4" onSubmit={event => {
    event.preventDefault();
    if (pending) return;
    const parsed = parseClientDomain(domain);
    const next = { ...(parsed.ok ? {} : { domain: clientDomainErrorMessage(parsed.error) }), ...(!firm.trim() ? { firm: "Enter the firm's name" } : {}) };
    setErrors(next);
    if (Object.keys(next).length) { (formRef.current?.elements.namedItem(next.domain ? "domain" : "firm") as HTMLInputElement | null)?.focus(); return; }
    // Dispatch explicitly so React does not reset the select after a refused action.
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  }}>
    <Field name="domain" label="Company email domain" required value={domain} onChange={event => setDomain(event.target.value)} error={errors.domain} placeholder="example-firm.co.uk" autoComplete="off" />
    <Field name="firm" label="Firm" required value={firm} onChange={event => setFirm(event.target.value)} error={errors.firm} placeholder="Example Firm LLP" autoComplete="organization" />
    <label className="block"><span className="app-label">Pursuit</span><select name="pursuitId" className="app-field" value={pursuitId} onChange={event => setPursuitId(event.target.value)}><option value="">Not linked yet</option>{pursuits.map(pursuit => <option key={pursuit.id} value={pursuit.id}>{pursuit.firm} · {pursuit.stage}</option>)}</select></label>
    <Button type="submit" busy={pending}>Add domain</Button>
    {state?.ok ? <p role="status" className="app-status app-status--success">{state.domain} can now request links at meritusvia.com/access.</p> : null}
    {state && !state.ok ? <p role="alert" className="app-status app-status--error">{state.error}</p> : null}
  </form>;
}
