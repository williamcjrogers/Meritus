import { extractUrls, normalizeWebsite } from "@/lib/research/urls";

export type AllowlistContext = {
  /** The pursuit website as stored, with or without a scheme. */
  website: string | null;
  /** Source URLs recorded on the latest complete brief. */
  briefSources: string[];
  /** The director's current message, in which a url may appear verbatim. */
  messageText: string;
};

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * The requested url as an http(s) URL. A value with no scheme at all (the way
 * a director often types one) is read as https; any other scheme is refused.
 */
function parseRequested(value: string): URL | null {
  if (HAS_SCHEME.test(value)) return parseHttpUrl(value);
  return parseHttpUrl(normalizeWebsite(value) ?? "");
}

/**
 * A url may be inspected by the search_web tool only when it is on the pursuit
 * website's origin, appears in the latest brief's sources, or appears in the
 * director's current message. Anything that is not an http(s) url is refused.
 */
export function isUrlPermitted(url: string, ctx: AllowlistContext): boolean {
  const requested = url.trim();
  const target = parseRequested(requested);
  if (!target) return false;

  const website = normalizeWebsite(ctx.website);
  const websiteUrl = website ? parseHttpUrl(website) : null;
  if (websiteUrl && websiteUrl.origin === target.origin) return true;

  for (const source of ctx.briefSources) {
    if (normalizeWebsite(source) === target.href) return true;
  }

  if (ctx.messageText.includes(requested)) return true;
  return extractUrls(ctx.messageText).includes(target.href);
}
