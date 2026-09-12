"use client";

import { useState } from "react";

type State = { status: "idle" | "sending" | "sent" | "error"; error: string | null };

export const ACCESS_SENT_COPY = "If that organisation has been given access, a link is on its way. It works once and expires in 30 minutes.";

export function AccessForm() {
  const [email, setEmail] = useState("");
  const [trap, setTrap] = useState("");
  const [state, setState] = useState<State>({ status: "idle", error: null });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "sending", error: null });
    try {
      const res = await fetch("/api/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), company_website: trap }),
      });
      if (res.ok) {
        setState({ status: "sent", error: null });
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setState({ status: "error", error: body.error ?? "We could not take your request. Please try again." });
    } catch {
      setState({ status: "error", error: "We could not take your request. Please try again." });
    }
  }

  if (state.status === "sent") {
    return (
      <p role="status" className="max-w-sm text-center text-[14px] leading-relaxed text-cream/85">
        {ACCESS_SENT_COPY}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5" noValidate>
      <label className="block">
        <span className="portal-label text-brass">Work email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="portal-field text-cream placeholder:text-cream/40 border-cream/30"
          placeholder="you@yourfirm.co.uk"
        />
      </label>
      <input
        type="text"
        name="company_website"
        value={trap}
        onChange={(e) => setTrap(e.target.value)}
        autoComplete="off"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute left-[-9999px] h-px w-px opacity-0"
      />
      <button type="submit" className="btn-brass text-[12px]" disabled={state.status === "sending"}>
        {state.status === "sending" ? "Sending…" : "Send my link"}
      </button>
      {state.error ? <p className="text-[12px] text-brass">{state.error}</p> : null}
    </form>
  );
}
