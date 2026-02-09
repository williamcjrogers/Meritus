import { HeroSection } from "./sections/HeroSection";
import { BrandStatement } from "./sections/BrandStatement";
import { CredibilityBar } from "@/components/ui";
import { SplitComparison } from "./sections/SplitComparison";
import { PillarsSection } from "./sections/PillarsSection";
import { PhilosophyBand } from "./sections/PhilosophyBand";
import { InsightsSection } from "./sections/InsightsSection";
import { CTABand } from "@/components/ui";
import { JsonLd } from "@/components/seo/JsonLd";
import { SITE_CONFIG } from "@/lib/constants";

export default function HomePage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: SITE_CONFIG.name,
          url: SITE_CONFIG.url,
          description: SITE_CONFIG.description,
          contactPoint: {
            "@type": "ContactPoint",
            email: SITE_CONFIG.email,
            contactType: "customer service",
          },
        }}
      />
      <HeroSection />
      <CredibilityBar />
      <BrandStatement />
      <SplitComparison />
      <PillarsSection />
      <PhilosophyBand />
      <InsightsSection />
      <CTABand />
    </>
  );
}
