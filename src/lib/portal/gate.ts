/** The middleware's decision, kept pure so every path and role pairing can be tested without Clerk. */
import type { Role } from "./roles";

export type GateDecision =
  | { kind: "next" }
  | { kind: "redirect"; to: string }
  | { kind: "json"; status: 401 | 403; error: string };

function under(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function isPortalPath(pathname: string): boolean {
  return under(pathname, "/portal") || under(pathname, "/api/portal");
}

export function isClientPath(pathname: string): boolean {
  return under(pathname, "/client") || under(pathname, "/api/client");
}

export function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export function decideGate(input: { pathname: string; signedIn: boolean; role: Role | null }): GateDecision {
  const { pathname, signedIn, role } = input;
  const portal = isPortalPath(pathname);
  const client = isClientPath(pathname);
  if (!portal && !client) return { kind: "next" };
  const api = isApiPath(pathname);

  if (!signedIn) {
    if (api) return { kind: "json", status: 401, error: "Unauthorized" };
    return { kind: "redirect", to: client ? "/access" : "/sign-in" };
  }

  if (portal) {
    if (role === "director") return { kind: "next" };
    if (api) return { kind: "json", status: 403, error: "Directors only" };
    return { kind: "redirect", to: role === "client" ? "/client" : "/access/denied" };
  }

  if (role === "client" || role === "director") return { kind: "next" };
  if (api) return { kind: "json", status: 403, error: "No access" };
  return { kind: "redirect", to: "/access/denied" };
}
