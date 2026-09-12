"use client";
import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { useSignIn } from "@clerk/nextjs/legacy";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { accountDestination, destinationFor } from "@/lib/portal/destination";

type Failure = { kind: "invalid" | "expired" | "used" | "account" | "unavailable"; message: string };
function ticketFailure(error: unknown): Failure {
  const record = error && typeof error === "object" ? error as { errors?: { code?: string }[]; status?: number } : {};
  const codes = record.errors?.map(item => item.code ?? "").join(" ") ?? "";
  if (/sign_in_token_expired|ticket_expired/.test(codes)) return { kind: "expired", message: "This link has expired. Request a new link to open your documents." };
  if (/sign_in_token_already_used|ticket_already_used/.test(codes)) return { kind: "used", message: "This link has already been used. Request a new link to open your documents." };
  if (/session_exists|already_signed_in/.test(codes)) return { kind: "account", message: "Another account is signed in. Sign out and use this link to continue." };
  if (/sign_in_token_invalid|ticket_invalid|form_param_format_invalid|resource_not_found/.test(codes)) return { kind: "invalid", message: "This link is not valid. Request a new link to open your documents." };
  return { kind: "unavailable", message: "We could not verify your link. Check your connection and try again." };
}

/** Ticket values live only in this mounted component. signOut's callback prevents a redirect. */
export function AccessContinue() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  const router = useRouter();
  const params = useSearchParams();
  const ticket = useRef<string | null>(null);
  const captured = useRef(false);
  const started = useRef(false);
  const inFlight = useRef(false);
  const switchAuthorised = useRef(false);
  const [captureReady, setCaptureReady] = useState(false);
  const createdSession = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const target = useRef(destinationFor("client", params.get("returnTo")));

  const exchange = useCallback(async (switchAccount = false) => {
    if (!isLoaded || !signIn || !setActive || inFlight.current || !ticket.current) return;
    inFlight.current = true; setBusy(true); setFailure(null);
    try {
      if (switchAccount) { switchAuthorised.current = true; await clerk.signOut(() => {}); }
      if (!createdSession.current) {
        // Legacy is a supported provider API and exposes ticket creation + session activation.
        const result = await signIn.create({ strategy: "ticket", ticket: ticket.current });
        if (result.status !== "complete" || !result.createdSessionId) {
          setFailure({ kind: "invalid", message: "This link could not complete sign-in. Request a new link." });
          return;
        }
        createdSession.current = result.createdSessionId;
      }
      await setActive({ session: createdSession.current });
      ticket.current = null;
      router.replace(accountDestination(target.current));
    } catch (error) { setFailure(ticketFailure(error)); }
    finally { inFlight.current = false; setBusy(false); }
  }, [isLoaded, signIn, setActive, clerk, router]);

  useEffect(() => {
    if (!captured.current) {
      ticket.current = params.get("ticket");
      captured.current = true;
      setCaptureReady(true);
      // Strip the credential before any navigation or account switching; preserve Next state.
      window.history.replaceState(window.history.state, "", "/access/continue");
    }
    if (!isLoaded || !authLoaded || started.current) return;
    started.current = true;
    if (!ticket.current) { setFailure({ kind: "invalid", message: "This link is incomplete. Request a new link to open your documents." }); return; }
    if (!isSignedIn) void exchange();
  }, [params, isLoaded, authLoaded, isSignedIn, exchange]);

  const conflict = Boolean(captureReady && isSignedIn && ticket.current && !createdSession.current && !busy && (!failure || failure.kind === "account"));
  if (conflict) return <div className="access-form">
    <p className="access-intro">You are signed in as <strong>{user?.primaryEmailAddress?.emailAddress ?? "another account"}</strong>.</p>
    <p>This email link may open a different account. Choose how to continue.</p>
    <div className="access-actions">
      <button type="button" className="app-button" onClick={() => void exchange(true)}>Sign out and use this link</button>
      <Link href="/account" className="app-button app-button--secondary" onClick={() => { ticket.current = null; }}>Keep current account</Link>
    </div>
  </div>;
  if (failure) return <div className="access-form">
    <p className="app-status app-status--error" role="alert">{failure.message}</p>
    <div className="access-actions">
      {failure.kind === "unavailable" ? <button type="button" className="app-button" disabled={busy} onClick={() => void exchange(Boolean(switchAuthorised.current && isSignedIn && !createdSession.current))}>Retry</button> : <Link href="/access" className="app-button">Request a new link</Link>}
      {isSignedIn ? <Link href="/account" className="app-button app-button--secondary">Return to your account</Link> : null}
    </div>
  </div>;
  return <p role="status" className="app-status">{busy ? "Opening your documents…" : "Checking your link…"}</p>;
}
