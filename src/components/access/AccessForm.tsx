"use client";
import { useEffect, useRef, useState } from "react";
import { parseAccessRequest } from "@/lib/access/request";

export const ACCESS_SENT_COPY = "If that organisation has been given access, a link is on its way. It works once and expires in 30 minutes.";
export function AccessForm({ returnTo }: { returnTo?: string } = {}) {
  const [email, setEmail] = useState("");
  const [trap, setTrap] = useState("");
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const busyRef = useRef(false);
  const cooldownUntil = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const focusEmail = useRef(false);
  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(Math.max(0, Math.ceil((cooldownUntil.current - Date.now()) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { if (!sentEmail && focusEmail.current) { input.current?.focus(); focusEmail.current = false; } }, [sentEmail]);
  function cooldown() { cooldownUntil.current = Date.now() + 60_000; setRemaining(60); }
  async function send() {
    if (busyRef.current || (sentEmail && cooldownUntil.current > Date.now())) return;
    const parsed = parseAccessRequest({ email });
    if (!parsed.ok) { setError(parsed.error); setInvalid(true); input.current?.focus(); return; }
    busyRef.current = true; setBusy(true); setError(null); setInvalid(false);
    try {
      const response = await fetch("/api/access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: parsed.email, company_website: trap, ...(returnTo ? { returnTo } : {}) }), signal: AbortSignal.timeout(12_000) });
      if (response.ok) { setSentEmail(parsed.email); cooldown(); }
      else {
        if (response.status === 429) cooldown();
        setError(response.status === 429 ? "Too many requests. Try again in an hour." : response.status === 400 ? "Check your work email address and try again." : "We could not request your link. Please try again shortly.");
      }
    } catch { setError("We could not request your link. Check your connection and try again."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  if (sentEmail) return <div className="access-form">
    <p className="access-intro">Check your email at <strong>{sentEmail}</strong>.</p>
    <p role="status" className="app-status">{ACCESS_SENT_COPY}</p>
    <div className="access-actions">
      <button type="button" className="app-button app-button--secondary" disabled={busy || remaining > 0} aria-busy={busy} onClick={() => void send()}>{remaining > 0 ? `Resend in ${remaining}s` : "Resend link"}</button>
      <button type="button" className="app-button app-button--ghost" disabled={busy} onClick={() => { focusEmail.current = true; setSentEmail(null); setError(null); }}>Change email</button>
    </div>
    <p role={error ? "alert" : "status"} className={error ? "app-status app-status--error" : "app-status"}>{error ?? (busy ? "Requesting your link…" : "Check your junk folder if the email has not arrived.")}</p>
  </div>;
  return <form className="access-form" noValidate onSubmit={event => { event.preventDefault(); void send(); }}>
    <label htmlFor="access-email" className="app-label">Work email</label>
    <input ref={input} id="access-email" type="email" name="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required value={email} aria-invalid={invalid} aria-describedby="access-feedback" onChange={event => { setEmail(event.target.value); if (invalid) { setInvalid(false); setError(null); } }} className="app-field" placeholder="you@yourfirm.co.uk" />
    <input type="text" name="company_website" value={trap} onChange={event => setTrap(event.target.value)} autoComplete="off" tabIndex={-1} aria-hidden="true" className="sr-only" />
    <button type="submit" className="app-button" disabled={busy} aria-busy={busy}>Send me a link</button>
    <p id="access-feedback" className={error ? "app-status app-status--error" : "app-status"} role={error ? "alert" : "status"}>{error ?? (busy ? "Requesting your link…" : "Your link will work once and expire after 30 minutes.")}</p>
  </form>;
}
