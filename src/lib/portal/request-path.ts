import { safeReturnPath } from "./destination";

/** Set only from the actual Next request URL; any caller-supplied value is overwritten. */
export const PAGE_PATH_HEADER = "x-meritus-page-path";

export function pageRequestHeaders(request: {
  headers: Headers;
  nextUrl: { pathname: string; search: string };
}): Headers {
  const headers = new Headers(request.headers);
  headers.delete(PAGE_PATH_HEADER);
  const target = safeReturnPath(`${request.nextUrl.pathname}${request.nextUrl.search}`);
  if (target) headers.set(PAGE_PATH_HEADER, target);
  return headers;
}

/** The header describes navigation only. It never grants a role or changes an entitlement. */
export function requestedPagePath(fallback: string, header: string | null): string {
  const safeFallback = safeReturnPath(fallback) ?? "/portal";
  const target = safeReturnPath(header);
  if (!target) return safeFallback;
  const experience = safeFallback.startsWith("/client") ? "/client" : "/portal";
  const pathname = new URL(target, "https://meritus.local").pathname;
  return pathname === experience || pathname.startsWith(`${experience}/`) ? target : safeFallback;
}
