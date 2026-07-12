import Script from "next/script";

/**
 * Marketing / campaign analytics — loads nothing unless an ID is configured, so
 * the site ships privacy-clean and the marketing team can switch tracking on by
 * setting an environment variable (no redeploy of code required):
 *
 *   NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX          → Google Analytics 4
 *   NEXT_PUBLIC_PLAUSIBLE_DOMAIN=meritusvia.com → Plausible (cookieless)
 *
 * Both can run together (e.g. GA for ad platforms, Plausible for clean metrics).
 */
export function Analytics() {
  // GA4 measurement IDs are public (they ship in page source); the env var
  // still wins so a different property can be swapped in without a code change.
  const gaId = process.env.NEXT_PUBLIC_GA_ID || "G-QHWGQM7Q66";
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

  return (
    <>
      {gaId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaId}', { anonymize_ip: true });
            `}
          </Script>
        </>
      )}

      {plausibleDomain && (
        <Script
          defer
          data-domain={plausibleDomain}
          src="https://plausible.io/js/script.js"
          strategy="afterInteractive"
        />
      )}
    </>
  );
}
