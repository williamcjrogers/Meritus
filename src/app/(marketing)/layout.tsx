import type { Viewport } from "next";
import { Cinzel, Cormorant_Garamond, Inter, JetBrains_Mono } from "next/font/google";
import { Header, Footer } from "@/components/layout";
import { Analytics } from "@/components/seo/Analytics";

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

export const viewport: Viewport = {
  themeColor: "#0B3B24",
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`marketing-shell ${cinzel.variable} ${cormorantGaramond.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <Header />
      <main id="main-content">{children}</main>
      <Footer />
      <Analytics />
    </div>
  );
}
