import type { ActorKind } from "./roles";

/** Paths that require a signed-in session. Client sign-in / sign-up stay public. */
export function isAuthGatedPath(pathname: string): boolean {
  if (pathname === "/portal" || pathname.startsWith("/portal/")) return true;
  if (pathname.startsWith("/api/portal")) return true;
  if (pathname.startsWith("/api/client")) return true;
  if (pathname === "/client" || pathname.startsWith("/client/")) {
    return !pathname.startsWith("/client/sign-in") && !pathname.startsWith("/client/sign-up");
  }
  return false;
}

/**
 * Clients must never see the pursuit desk. When kind is null (Clerk down),
 * do not lock directors out of /portal.
 */
export function shouldSendClientToDesk(kind: ActorKind | null, pathname: string): boolean {
  if (kind !== "client") return false;
  return pathname === "/portal" || pathname.startsWith("/portal/") || pathname.startsWith("/api/portal");
}
