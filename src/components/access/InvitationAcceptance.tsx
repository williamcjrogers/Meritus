"use client";
import { SignUp, useAuth, useClerk, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useRef, useState } from "react";

/** Keep invitation acceptance explicit when another account is already active. */
export function InvitationAcceptance() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  async function switchAccount() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await clerk.signOut(() => {});
    } catch {
      setError("We could not sign out. Please try again.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  if (!isLoaded) return <p role="status" className="app-status">Checking your account…</p>;
  if (isSignedIn) return <div className="access-form">
    <p>You are signed in as <strong>{user?.primaryEmailAddress?.emailAddress ?? "another account"}</strong>.</p>
    <p>Sign out to accept this invitation, or keep using your current account.</p>
    <div className="access-actions">
      <button type="button" className="app-button" disabled={busy} aria-busy={busy} onClick={() => void switchAccount()}>Sign out and accept invitation</button>
      <Link href="/account" className="app-button app-button--secondary">Keep current account</Link>
    </div>
    {error ? <p role="alert" className="app-status app-status--error">{error}</p> : null}
  </div>;
  return <SignUp routing="hash" signInUrl="/sign-in" fallbackRedirectUrl="/account" forceRedirectUrl="/account" appearance={{ elements: { header: { display: "none" } } }} />;
}
