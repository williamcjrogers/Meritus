import { Header, Footer } from "@/components/layout";
import { Analytics } from "@/components/seo/Analytics";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main id="main-content">{children}</main>
      <Footer />
      <Analytics />
    </>
  );
}
