import Link from "next/link";
import { SITE_CONFIG, FOOTER_NAV } from "@/lib/constants";
import { LinkedInIcon } from "@/components/icons";

export function Footer() {
  return (
    <footer className="bg-green text-cream/50" role="contentinfo">
      <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%] pt-10 pb-6 lg:pt-12 lg:pb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          {/* Brand */}
          <div>
            <span className="flex items-baseline gap-1.5">
              <span
                className="font-serif text-xl font-semibold tracking-[0.18em] text-cream/80"
                style={{ fontVariantCaps: "all-small-caps" }}
              >
                Meritus
              </span>
              <span className="font-serif text-sm font-normal tracking-[0.15em] italic text-brass/70">
                Via
              </span>
            </span>
            <p className="mt-1.5 text-[12px] text-brass/70 italic font-serif">
              {SITE_CONFIG.legalTagline}
            </p>
            <div className="mt-5">
              <a
                href={SITE_CONFIG.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cream/30 hover:text-brass transition-colors duration-200"
                aria-label="Meritus Via on LinkedIn"
              >
                <LinkedInIcon className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <ul className="space-y-2">
              {FOOTER_NAV.main.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-[12px] text-cream/50 hover:text-brass transition-colors duration-200">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact & Legal */}
          <div>
            <div className="text-[12px]">
              <a href={`mailto:${SITE_CONFIG.email}`} className="text-cream/50 hover:text-brass transition-colors duration-200">
                {SITE_CONFIG.email}
              </a>
            </div>
            <div className="mt-4 space-y-1.5">
              {FOOTER_NAV.legal.map((item) => (
                <p key={item.href}>
                  <Link href={item.href} className="text-[11px] text-cream/30 hover:text-cream/50 transition-colors duration-200">
                    {item.label}
                  </Link>
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* Professional accreditations */}
        <div className="mt-8 pt-6 border-t border-cream/5">
          <div className="flex flex-col items-center gap-2.5">
            <div className="font-mono text-[8px] tracking-[0.3em] uppercase text-cream/20">
              Professional Standards
            </div>
            <div className="flex flex-wrap justify-center items-center gap-x-5 gap-y-1.5 font-mono text-[10px] tracking-[0.2em] uppercase text-cream/25">
              <span>RICS</span>
              <span className="text-cream/10">·</span>
              <span>ICE</span>
              <span className="text-cream/10">·</span>
              <span>CIArb</span>
              <span className="text-cream/10">·</span>
              <span>CIOB</span>
              <span className="text-cream/10">·</span>
              <span>EWI</span>
              <span className="text-cream/10">·</span>
              <span>Academy of Experts</span>
            </div>
            <p className="text-[9px] text-cream/15 text-center max-w-md">
              Partners hold chartered and fellowship-level memberships across leading professional institutions.
            </p>
          </div>
        </div>

        {/* Discipline drift — barely visible scrolling keywords */}
        <div className="mt-5 overflow-hidden" aria-hidden="true">
          <div className="footer-drift whitespace-nowrap font-mono text-[8px] tracking-[0.3em] uppercase text-cream/[0.06]">
            <span>delay analysis &middot; quantum &middot; fire safety &middot; drawing review &middot; prolongation &middot; causation &middot; advisory &middot; measured works &middot; cladding &middot; specification compliance &middot; mediation &middot; disruption &middot; building safety act &middot; final account &middot; expert testimony &middot; design liability &middot;&nbsp;</span>
            <span>delay analysis &middot; quantum &middot; fire safety &middot; drawing review &middot; prolongation &middot; causation &middot; advisory &middot; measured works &middot; cladding &middot; specification compliance &middot; mediation &middot; disruption &middot; building safety act &middot; final account &middot; expert testimony &middot; design liability &middot;&nbsp;</span>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-cream/5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <p className="text-[10px] text-cream/30">{SITE_CONFIG.copyright}</p>
            <p className="text-[10px] text-cream/30">{SITE_CONFIG.legalFooter}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
