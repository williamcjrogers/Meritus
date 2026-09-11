"use client";

import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import { isClerkPublishable } from "@/lib/env";
import type { ActorKind } from "@/lib/portal/roles";

const className = "text-xl text-cream/70 tracking-wide hover:text-brass transition-colors duration-200";

function SignedOutLinks({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6">
      <Link href="/sign-in" onClick={onNavigate} className={className}>
        Partner
      </Link>
      <Link href="/client/sign-in" onClick={onNavigate} className={className}>
        Client login
      </Link>
    </div>
  );
}

function SignedInLinks({
  onNavigate,
  actorKind,
}: {
  onNavigate: () => void;
  actorKind: ActorKind | null;
}) {
  const client = actorKind === "client";

  return (
    <div className="flex flex-col items-center gap-6">
      {client ? (
        <Link href="/client" onClick={onNavigate} className={className}>
          Client desk
        </Link>
      ) : (
        <Link href="/portal" onClick={onNavigate} className={className}>
          Portal
        </Link>
      )}
      <UserButton />
    </div>
  );
}

export function MobileAuth({
  onNavigate,
  actorKind = null,
}: {
  onNavigate: () => void;
  actorKind?: ActorKind | null;
}) {
  if (!isClerkPublishable()) {
    return <SignedOutLinks onNavigate={onNavigate} />;
  }

  return (
    <Show when="signed-in" fallback={<SignedOutLinks onNavigate={onNavigate} />}>
      <SignedInLinks onNavigate={onNavigate} actorKind={actorKind} />
    </Show>
  );
}
