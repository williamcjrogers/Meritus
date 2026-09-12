/** Pure middleware decisions; URL return targets never carry authority. */
import type { Role } from "./roles";
import { safeReturnPath, unavailableDestination } from "./destination";
export type GateDecision =
  | { kind: "next" }
  | { kind: "redirect"; to: string }
  | { kind: "json"; status: 401 | 403 | 503; error: string };
function under(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}
export function isPortalPath(pathname: string): boolean { return under(pathname, "/portal") || under(pathname, "/api/portal"); }
export function isClientPath(pathname: string): boolean { return under(pathname, "/client") || under(pathname, "/api/client"); }
export function isApiPath(pathname: string): boolean { return pathname.startsWith("/api/"); }
export function decideGate(input: { pathname: string; search?: string; signedIn: boolean; role: Role | null; unavailable?: boolean }): GateDecision {
  const { pathname, signedIn, role } = input;
  const portal = isPortalPath(pathname);
  const client = isClientPath(pathname);
  if (!portal && !client) return { kind: "next" };
  const api = isApiPath(pathname);
  const requested = safeReturnPath(`${pathname}${input.search ?? ""}`);
  if (input.unavailable) return api
    ? { kind: "json", status: 503, error: "We could not verify your access. Please try again." }
    : { kind: "redirect", to: unavailableDestination(requested) };
  if (!signedIn) {
    if (api) return { kind: "json", status: 401, error: "Unauthorized" };
    const entry = client ? "/access" : "/sign-in";
    return { kind: "redirect", to: requested ? `${entry}?returnTo=${encodeURIComponent(requested)}` : entry };
  }
  if (portal) {
    if (role === "director") return { kind: "next" };
    if (api) return { kind: "json", status: 403, error: "Workspace access required" };
    return { kind: "redirect", to: role === "client" ? "/client" : "/access/denied" };
  }
  if (role === "director") return api ? { kind: "next" } : { kind: "redirect", to: "/portal/clients" };
  if (role === "client") return { kind: "next" };
  if (api) return { kind: "json", status: 403, error: "No access" };
  return { kind: "redirect", to: "/access/denied" };
}
