import Link from "next/link";
import { SITE_CONFIG, FOOTER_NAV } from "@/lib/constants";
import { LinkedInIcon } from "@/components/icons";
import { HallmarkLogo } from "@/components/icons/HallmarkLogo";
import { DisciplineDrift } from "./DisciplineDrift";

export function Footer() {
  return (
    <footer className="bg-[#052314] text-cream/50 border-t border-brass/10" role="contentinfo">
      {/* Discipline drift — endlessly left-scrolling keyword ticker */}
      <DisciplineDrift />

      <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%] pt-12 pb-8">
        <div className="flex flex-col lg:flex-row lg:items-start gap-10 lg:gap-8 mb-12">
          {/* Brand (left; flex-1 mirrors the right spacer so the links sit page-centre) */}
          <div className="lg:flex-1 flex flex-col">
            <div>
              <HallmarkLogo size="header" variant="light" className="mb-4" />
              <p className="text-[12px] text-cream/50 max-w-[280px] leading-relaxed">
                Forensic intelligence for high-value construction disputes. {SITE_CONFIG.legalTagline}
              </p>
              <div className="mt-8">
                <a
                  href={SITE_CONFIG.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cream/30 hover:text-brass transition-colors duration-200 inline-block p-2 -ml-2"
                  aria-label="Meritus Via on LinkedIn"
                >
                  <LinkedInIcon className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>

          {/* Links (page-centred between the two flex-1 blocks) */}
          <div className="flex flex-wrap gap-x-16 gap-y-10 shrink-0">
            <div>
              <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-brass/60 mb-4">Practice</div>
              <ul className="space-y-2.5">
                {FOOTER_NAV.main.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-[12px] text-cream/60 hover:text-brass transition-colors duration-200">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-brass/60 mb-4">Firm</div>
              <ul className="space-y-2.5">
                <li>
                  <Link href="/contact" className="text-[12px] text-cream/60 hover:text-brass transition-colors duration-200">
                    Contact
                  </Link>
                </li>
                <li>
                  <a href={`mailto:${SITE_CONFIG.email}`} className="text-[12px] text-cream/60 hover:text-brass transition-colors duration-200">
                    Enquiries
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-brass/60 mb-4">Legal</div>
              <ul className="space-y-2.5">
                {FOOTER_NAV.legal.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-[12px] text-cream/60 hover:text-brass transition-colors duration-200">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right spacer — balances the brand block so the link columns align with the centred content below */}
          <div className="hidden lg:block lg:flex-1" aria-hidden="true" />
        </div>

        {/* Professional Standards */}
        <div className="mb-6 flex flex-col items-center justify-center gap-3">
          <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-brass/60 text-center">
            Professional Standards
          </div>
          <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2 font-mono text-[10px] tracking-[0.15em] text-cream/40">
            <span>RICS</span><span className="text-brass/20">·</span>
            <span>ICE</span><span className="text-brass/20">·</span>
            <span>CIArb</span><span className="text-brass/20">·</span>
            <span>CIOB</span><span className="text-brass/20">·</span>
            <span>EWI</span><span className="text-brass/20">·</span>
            <span>ACADEMY OF EXPERTS</span>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-brass/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <p className="text-[10px] text-cream/30">{SITE_CONFIG.copyright}</p>
          <p className="text-[10px] text-cream/30 md:text-right max-w-lg">
            {SITE_CONFIG.legalFooter} Partners hold chartered and fellowship-level memberships across leading professional institutions.
          </p>
        </div>
      </div>
    </footer>
  );
}
