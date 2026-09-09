const URL_RE = /https?:\/\/[^\s<>"'`]+/gi;

export function extractUrls(...texts: Array<string | null | undefined>): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const raw of text.match(URL_RE) ?? []) {
      const cleaned = raw.replace(/[),.]+$/g, "");
      const normalized = normalizeWebsite(cleaned);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      found.push(normalized);
    }
  }
  return found;
}

export function normalizeWebsite(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

/** A url with its fragment removed and no trailing slash, for comparing sources. */
export function canonicalUrl(value: string | null | undefined): string | null {
  const normalised = normalizeWebsite(value);
  if (!normalised) return null;
  try {
    const url = new URL(normalised);
    url.hash = "";
    return url.href.replace(/\/$/, "");
  } catch {
    return null;
  }
}
