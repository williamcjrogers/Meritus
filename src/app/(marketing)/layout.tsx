import { SiteHeader, Footer } from "@/components/layout";
import { Analytics } from "@/components/seo/Analytics";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main-content">{children}</main>
      <Footer />
      <Analytics />
    </>
  );
}
