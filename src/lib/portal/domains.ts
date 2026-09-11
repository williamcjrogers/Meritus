/**
 * Company email domains are the client membership list. Directors add
 * `bree.co.uk` or `@bree.co.uk`; anyone who authenticates with that domain
 * is a client. Public mailboxes and meritusvia.com can never be clients.
 */

export const PUBLIC_MAILBOX_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
] as const;

export const FIRM_DOMAIN = "meritusvia.com";

export const DOMAIN_PARSE_ERRORS = ["empty", "invalid", "public_mailbox", "firm_domain"] as const;
export type DomainParseError = (typeof DOMAIN_PARSE_ERRORS)[number];

export type DomainParseResult = { ok: true; domain: string } | { ok: false; error: DomainParseError };

const HOSTNAME = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

/** Strip a leading @, lowercase, trim. `bree.co.uk` and `@bree.co.uk` are the same. */
export function normaliseDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^@+/, "");
}

export function isPublicMailboxDomain(domain: string): boolean {
  return (PUBLIC_MAILBOX_DOMAINS as readonly string[]).includes(normaliseDomain(domain));
}

/** meritusvia.com and its subdomains stay directors (Mateo / Paul). */
export function isReservedDirectorDomain(domain: string): boolean {
  const normalised = normaliseDomain(domain);
  return normalised === FIRM_DOMAIN || normalised.endsWith(`.${FIRM_DOMAIN}`);
}

export function domainFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  const domain = normaliseDomain(trimmed.slice(at + 1));
  return domain || null;
}

/**
 * Accept a domain, `@domain`, or a full email and return the host we would store.
 * Validation (public mailbox, firm domain, shape) is {@link parseClientDomain}.
 */
export function domainInput(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.includes("@") && !trimmed.startsWith("@")) {
    return domainFromEmail(trimmed) ?? normaliseDomain(trimmed);
  }
  return normaliseDomain(trimmed);
}

export function parseClientDomain(raw: string): DomainParseResult {
  const domain = domainInput(raw);
  if (!domain) return { ok: false, error: "empty" };
  if (!HOSTNAME.test(domain)) return { ok: false, error: "invalid" };
  if (isPublicMailboxDomain(domain)) return { ok: false, error: "public_mailbox" };
  if (isReservedDirectorDomain(domain)) return { ok: false, error: "firm_domain" };
  return { ok: true, domain };
}

export function clientDomainErrorMessage(error: DomainParseError): string {
  switch (error) {
    case "empty":
      return "Enter a company domain";
    case "invalid":
      return "Enter a domain such as bree.co.uk";
    case "public_mailbox":
      return "Public mailbox domains cannot be added";
    case "firm_domain":
      return "meritusvia.com is reserved for directors";
    default: {
      const exhaustive: never = error;
      return exhaustive;
    }
  }
}

/** True when the email's host is on the list. meritusvia.com never matches. */
export function emailMatchesClientDomain(
  email: string | null | undefined,
  clientDomains: readonly string[]
): boolean {
  const domain = domainFromEmail(email);
  if (!domain || isReservedDirectorDomain(domain)) return false;
  return clientDomains.includes(domain);
}
