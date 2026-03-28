import { HeroSection } from "./sections/HeroSection";
import { CredibilityBar } from "@/components/ui";
import { PhilosophyBand } from "./sections/PhilosophyBand";
import { SplitComparison } from "./sections/SplitComparison";
import { ProcessStrip } from "./sections/ProcessStrip";
import { PillarsSection } from "./sections/PillarsSection";
import { InsightsSection } from "./sections/InsightsSection";
import { FestinaLenteBand } from "./sections/FestinaLenteBand";
import { CTABand } from "@/components/ui";
import { JsonLd } from "@/components/seo/JsonLd";
import { SITE_CONFIG } from "@/lib/constants";

export default function HomePage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": ["ProfessionalService", "LocalBusiness"],
          name: SITE_CONFIG.name,
          legalName: SITE_CONFIG.legalName,
          url: SITE_CONFIG.url,
          logo: `${SITE_CONFIG.url}/opengraph-image`,
          image: `${SITE_CONFIG.url}/opengraph-image`,
          description: SITE_CONFIG.description,
          "@id": SITE_CONFIG.url,
          sameAs: [SITE_CONFIG.linkedin],
          address: {
            "@type": "PostalAddress",
            addressCountry: "GB",
          },
          areaServed: {
            "@type": "Country",
            name: "United Kingdom",
          },
          knowsAbout: [
            "Construction Disputes",
            "Delay Analysis",
            "Quantum Analysis",
            "Adjudication",
            "Expert Witness",
            "Building Safety Act",
            "JCT Contracts",
            "NEC Contracts",
          ],
          serviceType: [
            "Delay Analysis",
            "Quantum Advisory",
            "Technical Expert Services",
            "Construction Disputes Advisory",
          ],
          contactPoint: {
            "@type": "ContactPoint",
            email: SITE_CONFIG.email,
            contactType: "customer service",
            areaServed: "GB",
            availableLanguage: "English",
          },
        }}
      />
      <HeroSection />
      <CredibilityBar />
      <FestinaLenteBand />
      <PhilosophyBand />
      <SplitComparison />
      <ProcessStrip />
      <PillarsSection />
      <InsightsSection />
      <CTABand
        heading="Your next matter starts here."
        subtext="Speak directly with a partner. No intermediaries, no sales teams,just a confidential conversation about your case."
        leftGraphic="monogram"
      />

      {/* Private Vault,Credentials micro-CTA */}
      <section className="bg-green-dark py-10 lg:py-12 border-t border-brass/10">
        <div className="max-w-[1100px] 2xl:max-w-[1300px] 3xl:max-w-[1500px] mx-auto px-6 lg:px-[8%] text-center">
          <p className="text-[13px] text-cream/40 leading-relaxed max-w-2xl mx-auto">
            Due to current commercial sensitivities, full partner biographies and representative case histories are available upon request.
          </p>
          <a
            href="/credentials"
            className="inline-block mt-4 font-mono text-[11px] tracking-[0.2em] uppercase text-brass border-b border-brass/40 pb-0.5 hover:border-brass transition-colors duration-300"
          >
            Request Credentials Portfolio
          </a>
        </div>
      </section>
    </>
  );
}
