import { HeroSection } from "./sections/HeroSection";
import { PillarsSection } from "./sections/PillarsSection";
import { ProcessStrip } from "./sections/ProcessStrip";
import { InsightsSection } from "./sections/InsightsSection";
import { CTABand } from "@/components/ui/CTABand";
import { JsonLd } from "@/components/seo/JsonLd";
import { SITE_CONFIG } from "@/lib/constants";

export default function HomePage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ProfessionalService",
          name: SITE_CONFIG.name,
          legalName: SITE_CONFIG.legalName,
          url: SITE_CONFIG.url,
          description: SITE_CONFIG.description,
          sameAs: [SITE_CONFIG.linkedin],
          address: { "@type": "PostalAddress", addressCountry: "GB" },
          contactPoint: {
            "@type": "ContactPoint",
            email: SITE_CONFIG.email,
            contactType: "customer service",
          },
        }}
      />
      <HeroSection />
      <PillarsSection />
      <ProcessStrip />
      <InsightsSection />
      <CTABand />
    </>
  );
}
