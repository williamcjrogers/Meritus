/**
 * A client domain is the membership list for the file drop: anyone with a mailbox at a listed
 * company domain may request a link. Public mailbox providers and the firm's own domain can
 * never be listed.
 */

export const PUBLIC_MAILBOX_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "outlook.co.uk",
  "hotmail.com",
  "hotmail.co.uk",
  "live.com",
  "live.co.uk",
  "msn.com",
  "yahoo.com",
  "yahoo.co.uk",
  "ymail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "mail.com",
  "gmx.com",
  "gmx.co.uk",
  "zoho.com",
  "fastmail.com",
  "hey.com",
  "btinternet.com",
  "sky.com",
  "virginmedia.com",
  "talktalk.net",
] as const;

export const FIRM_DOMAIN = "meritusvia.com";

export const DOMAIN_PARSE_ERRORS = ["empty", "invalid", "public_mailbox", "firm_domain"] as const;
export type DomainParseError = (typeof DOMAIN_PARSE_ERRORS)[number];

export type DomainParseResult = { ok: true; domain: string } | { ok: false; error: DomainParseError };

const HOSTNAME = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

/** Trim, lower-case, strip a leading @: `Example.co.uk` and `@example.co.uk` are the same domain. */
export function normaliseDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^@+/, "");
}

export function isPublicMailboxDomain(domain: string): boolean {
  return (PUBLIC_MAILBOX_DOMAINS as readonly string[]).includes(normaliseDomain(domain));
}

/** meritusvia.com and its subdomains belong to the directors and can never be a client domain. */
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

function domainInput(raw: string): string {
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
      return "Enter a domain such as example-firm.co.uk";
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
