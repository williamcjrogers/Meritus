import Link from "next/link";
import { SITE_CONFIG, FOOTER_NAV } from "@/lib/constants";
import { LinkedInIcon } from "@/components/icons";
import { HallmarkLogo } from "@/components/icons/HallmarkLogo";

export function Footer() {
  return (
    <footer className="bg-[#052314] text-cream/50 border-t border-brass/10" role="contentinfo">
      {/* Discipline drift — ticker tape at the top of the footer */}
      <div className="border-b border-brass/10 overflow-hidden py-3 bg-[#041a0f]" aria-hidden="true">
        <div className="footer-drift whitespace-nowrap font-mono text-[9px] tracking-[0.3em] uppercase text-brass/30">
          <span>delay analysis &middot; quantum &middot; fire safety &middot; drawing review &middot; prolongation &middot; causation &middot; advisory &middot; measured works &middot; cladding &middot; specification compliance &middot; mediation &middot; disruption &middot; building safety act &middot; final account &middot; expert testimony &middot; design liability &middot;&nbsp;</span>
          <span>delay analysis &middot; quantum &middot; fire safety &middot; drawing review &middot; prolongation &middot; causation &middot; advisory &middot; measured works &middot; cladding &middot; specification compliance &middot; mediation &middot; disruption &middot; building safety act &middot; final account &middot; expert testimony &middot; design liability &middot;&nbsp;</span>
        </div>
      </div>

      <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%] pt-12 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 mb-10">
          {/* Brand & Accreditations (Left - 5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between">
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

            <div className="mt-10 lg:mt-0">
              <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-brass/60 mb-3">
                Professional Standards
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10px] tracking-[0.15em] text-cream/40">
                <span>RICS</span><span className="text-brass/20">·</span>
                <span>ICE</span><span className="text-brass/20">·</span>
                <span>CIArb</span><span className="text-brass/20">·</span>
                <span>CIOB</span><span className="text-brass/20">·</span>
                <span>EWI</span><span className="text-brass/20">·</span>
                <span>ACADEMY OF EXPERTS</span>
              </div>
            </div>
          </div>

          {/* Links Grid (Right - 7 cols) */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8">
            <div>
              <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-brass/60 mb-4">Practice</div>
              <ul className="space-y-2.5">
                {FOOTER_NAV.main.slice(0, 4).map((item) => (
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
                <li>
                  <Link href="/claims-intelligence" className="text-[12px] text-brass hover:text-brass-light transition-colors duration-200 flex items-center gap-1.5 group w-fit">
                    Claims Intelligence
                    <span className="group-hover:translate-x-0.5 transition-transform">&rarr;</span>
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-brass/60 mb-4">Legal</div>
              <ul className="space-y-2.5">
                {FOOTER_NAV.legal.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-[11px] text-cream/40 hover:text-cream/70 transition-colors duration-200">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
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
