import type { Metadata } from "next";
import { SITE_CONFIG } from "./constants";

interface PageMetaInput {
  /** Page title (the site name is appended by the root template / Open Graph). */
  title: string;
  description: string;
  /** Route path beginning with "/" (e.g. "/services"). Drives canonical + OG url. */
  path: string;
  keywords?: string[];
}

/**
 * Builds per-page metadata with a correct self-referencing canonical URL and
 * Open Graph/Twitter tags. Without a per-page canonical, every route inherits
 * the root canonical (the homepage), which tells search engines the pages are
 * duplicates of the homepage — this fixes that.
 *
 * The Open Graph image is supplied globally by app/opengraph-image.tsx, so it
 * is intentionally not set here.
 */
export function pageMetadata({
  title,
  description,
  path,
  keywords,
}: PageMetaInput): Metadata {
  const fullTitle = `${title} | ${SITE_CONFIG.name}`;
  const url = path === "/" ? SITE_CONFIG.url : `${SITE_CONFIG.url}${path}`;

  return {
    title,
    description,
    ...(keywords && keywords.length ? { keywords } : {}),
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url,
      siteName: SITE_CONFIG.name,
      locale: "en_GB",
      title: fullTitle,
      description,
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: fullTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: ["/opengraph-image"],
    },
  };
}
