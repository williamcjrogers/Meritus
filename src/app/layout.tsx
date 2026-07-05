import type { Metadata, Viewport } from "next";
import { Cinzel, Cormorant_Garamond, Inter, JetBrains_Mono } from "next/font/google";
import { Header } from "@/components/layout";
import { Footer } from "@/components/layout";
import { Analytics } from "@/components/seo/Analytics";
import { ViaSpine } from "@/components/ui/ViaSpine";
import { SITE_CONFIG } from "@/lib/constants";
import "@/styles/globals.css";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-cinzel",
  display: "swap",
});

const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-cormorant-garamond",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-jetbrains-mono",
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
        alt: `${SITE_CONFIG.name} — Construction Disputes Advisory`,
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
  themeColor: "#0B3B24",
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
      className={`${cinzel.variable} ${cormorantGaramond.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body suppressHydrationWarning className="font-sans text-ink bg-stone antialiased min-h-screen">
        <a href="#main-content" className="skip-to-content">
          Skip to content
        </a>
        <Header />
        <ViaSpine />
        <main id="main-content">{children}</main>
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
