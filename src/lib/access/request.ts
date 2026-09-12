import { domainFromEmail } from "@/lib/portal/domains";

/** The one field on /access. Anything that is not a plausible address is refused before any lookup. */
export function parseAccessRequest(body: unknown): { ok: true; email: string } | { ok: false; error: string } {
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>).email : null;
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!email || email.length > 254 || /\s/.test(email) || !domainFromEmail(email)) {
    return { ok: false, error: "Enter your work email address" };
  }
  return { ok: true, email };
}
