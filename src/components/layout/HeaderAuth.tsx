"use client";

import Link from "next/link";
import { Show, UserButton, useUser } from "@clerk/nextjs";
import { isClerkPublishable } from "@/lib/env";
import type { ActorKind } from "@/lib/portal/roles";

function linkClass(darkChrome: boolean): string {
  return darkChrome
    ? "text-[12px] font-medium tracking-wide text-green/70 hover:text-green transition-colors duration-300"
    : "text-[12px] font-medium tracking-wide text-cream/80 hover:text-cream transition-colors duration-300";
}

function SignedOutLinks({ darkChrome }: { darkChrome: boolean }) {
  const className = linkClass(darkChrome);
  return (
    <div className="flex items-center gap-4">
      <Link href="/sign-in" className={className}>
        Partner
      </Link>
      <Link href="/client/sign-in" className={className}>
        Client login
      </Link>
    </div>
  );
}

function SignedInLinks({ darkChrome, actorKind }: { darkChrome: boolean; actorKind: ActorKind | null }) {
  const className = linkClass(darkChrome);
  const { user } = useUser();
  const client = user?.publicMetadata?.role === "client" || actorKind === "client";

  return (
    <div className="flex items-center gap-4">
      {client ? (
        <Link href="/client" className={className}>
          Client desk
        </Link>
      ) : (
        <Link href="/portal" className={className}>
          Portal
        </Link>
      )}
      <UserButton
        appearance={{
          elements: {
            avatarBox: "h-7 w-7",
          },
        }}
      />
    </div>
  );
}

export function HeaderAuth({
  darkChrome,
  actorKind = null,
}: {
  darkChrome: boolean;
  actorKind?: ActorKind | null;
}) {
  if (!isClerkPublishable()) {
    return <SignedOutLinks darkChrome={darkChrome} />;
  }

  return (
    <Show when="signed-in" fallback={<SignedOutLinks darkChrome={darkChrome} />}>
      <SignedInLinks darkChrome={darkChrome} actorKind={actorKind} />
    </Show>
  );
}
