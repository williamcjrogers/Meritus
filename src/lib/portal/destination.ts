/** Pure, shared return-target boundary. Authentication never trusts URL-supplied roles. */
const LOCAL_ORIGIN = "https://meritus.local";
const UNSAFE = /[\\\u0000-\u001f\u007f]/;

export function safeReturnPath(requested?: string | null): string | null {
  if (typeof requested !== "string" || !requested.startsWith("/") || requested.startsWith("//") || UNSAFE.test(requested)) return null;
  try {
    const decoded = decodeURIComponent(requested);
    if (UNSAFE.test(decoded)) return null;
    const url = new URL(requested, LOCAL_ORIGIN);
    const path = decodeURIComponent(url.pathname);
    // Encoded separators and double encoding have ambiguous routing semantics.
    if (url.origin !== LOCAL_ORIGIN || /[%\\]/.test(path) || /%2f/i.test(url.pathname)) return null;
    if (!/^\/(portal|client)(\/|$)/.test(path)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function destinationFor(role: "director" | "client" | null, requested?: string | null): string {
  if (!role) return "/access/denied";
  const home = role === "director" ? "/portal" : "/client";
  const target = safeReturnPath(requested);
  if (!target) return home;
  const pathname = new URL(target, LOCAL_ORIGIN).pathname;
  return pathname === home || pathname.startsWith(`${home}/`) ? target : home;
}

export function accountDestination(requested?: string | null): string {
  const target = safeReturnPath(requested);
  return target ? `/account?returnTo=${encodeURIComponent(target)}` : "/account";
}

export function unavailableDestination(requested?: string | null): string {
  const target = safeReturnPath(requested);
  return target ? `/access/unavailable?returnTo=${encodeURIComponent(target)}` : "/access/unavailable";
}
