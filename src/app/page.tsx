import { HeroSection } from "./sections/HeroSection";
import { CredibilityBar } from "@/components/ui";
import { SplitComparison } from "./sections/SplitComparison";
import { ProcessStrip } from "./sections/ProcessStrip";
import { PillarsSection } from "./sections/PillarsSection";
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
      <SplitComparison />
      <ProcessStrip />
      <PillarsSection />
      <InsightsSection />
      <CTABand />
    </>
  );
}
