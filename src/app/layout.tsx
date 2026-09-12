import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Literata } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { SITE_CONFIG } from "@/lib/constants";
import { isClerkConfigured } from "@/lib/env";
import "@/styles/globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});
const literata = Literata({
  subsets: ["latin"],
  variable: "--font-literata",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${SITE_CONFIG.name} | Construction Disputes Advisory`,
    template: `%s | ${SITE_CONFIG.name}`,
  },
  description: SITE_CONFIG.description,
  metadataBase: new URL(SITE_CONFIG.url),
  keywords: [
    "construction disputes advisory",
    "delay analysis",
    "quantum surveyor",
    "forensic delay analysis",
    "adjudication support",
    "construction law UK",
    "expert witness construction",
    "extension of time",
    "final account dispute",
    "Building Safety Act",
    "NEC JCT contract disputes",
    "construction arbitration",
    "construction litigation support",
    "construction disputes technology",
    "evidence intelligence platform",
    "AI document review construction",
    "legal technology construction",
    "Meritus Via",
  ],
  authors: [{ name: SITE_CONFIG.legalName, url: SITE_CONFIG.url }],
  creator: SITE_CONFIG.legalName,
  publisher: SITE_CONFIG.legalName,
  alternates: {
    canonical: SITE_CONFIG.url,
  },
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: SITE_CONFIG.url,
    siteName: SITE_CONFIG.name,
    title: `${SITE_CONFIG.name} | Construction Disputes Advisory`,
    description: SITE_CONFIG.description,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${SITE_CONFIG.name}, Construction Disputes Advisory`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_CONFIG.name} | Construction Disputes Advisory`,
    description: SITE_CONFIG.description,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export const viewport: Viewport = {
  themeColor: "#FAFCFC",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en-GB"
      suppressHydrationWarning
      className={`${ibmPlexSans.variable} ${literata.variable}`}
    >
      <body suppressHydrationWarning className="font-sans antialiased min-h-screen">
        <a href="#main-content" className="skip-to-content">
          Skip to content
        </a>
        {isClerkConfigured() ? (
          <ClerkProvider
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
            signInFallbackRedirectUrl="/account"
            signInForceRedirectUrl="/account"
            signUpFallbackRedirectUrl="/account"
            signUpForceRedirectUrl="/account"
            afterSignOutUrl="/"
            appearance={{
              variables: {
                colorPrimary: "var(--primary)",
                colorBackground: "var(--surface)",
                colorForeground: "var(--text)",
                colorMutedForeground: "var(--muted)",
                colorInput: "var(--surface)",
                colorInputForeground: "var(--text)",
                colorDanger: "var(--danger)",
                colorBorder: "var(--border)",
                colorRing: "var(--focus)",
                borderRadius: "var(--radius-control)",
                fontFamily: "var(--font-ibm-plex-sans)",
                fontSize: "1rem",
              },
              elements: {
                rootBox: { width: "100%" },
                cardBox: { width: "100%", boxShadow: "none" },
                card: { boxShadow: "none", border: "1px solid var(--border)" },
                formFieldInput: "app-field",
                formFieldLabel: "app-label",
                formButtonPrimary: "app-button",
              },
            }}
          >
            {children}
          </ClerkProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
