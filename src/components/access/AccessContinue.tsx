"use client";

import { useAuth } from "@clerk/nextjs";
import { useSignIn } from "@clerk/nextjs/legacy";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Exchanges the ticket in the emailed link for a session. The legacy hook is used on purpose:
 * it exposes signIn.create({ strategy: "ticket" }) and setActive, which the ticket flow needs.
 */
export function AccessContinue() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const ticket = params.get("ticket");
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || started.current) return;
    started.current = true;
    if (isSignedIn) {
      router.replace("/client");
      return;
    }
    if (!ticket) {
      setError("This link is missing its ticket. Request a new one.");
      return;
    }
    (async () => {
      try {
        const result = await signIn.create({ strategy: "ticket", ticket });
        if (result.status === "complete" && result.createdSessionId) {
          await setActive({ session: result.createdSessionId });
          router.replace("/client");
          return;
        }
        setError("This link could not be used. Request a new one.");
      } catch {
        setError("This link has expired or was already used. Request a new one.");
      }
    })();
  }, [isLoaded, isSignedIn, ticket, signIn, setActive, router]);

  if (error) {
    return (
      <div className="max-w-sm text-center">
        <p className="text-[14px] text-cream/85">{error}</p>
        <Link href="/access" className="btn-brass mt-6 inline-flex text-[12px]">
          Request a new link
        </Link>
      </div>
    );
  }
  return (
    <p role="status" className="text-[14px] text-cream/70">
      Opening your upload desk…
    </p>
  );
}
