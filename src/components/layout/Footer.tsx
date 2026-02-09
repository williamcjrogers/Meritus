import Link from "next/link";
import { SITE_CONFIG, FOOTER_NAV } from "@/lib/constants";
import { LinkedInIcon } from "@/components/icons";

export function Footer() {
  return (
    <footer className="bg-green text-cream/50" role="contentinfo">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-[8%] py-20 lg:py-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-16 lg:gap-20">
          {/* Brand */}
          <div>
            <span
              className="font-serif text-xl font-semibold tracking-[0.18em] text-cream/80"
              style={{ fontVariantCaps: "all-small-caps" }}
            >
              Meritus
            </span>
            <p className="mt-2 text-[13px] text-brass/70 italic font-serif">
              {SITE_CONFIG.legalTagline}
            </p>
            <div className="mt-6">
              <a
                href={SITE_CONFIG.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cream/30 hover:text-brass transition-colors duration-200"
                aria-label="Meritus on LinkedIn"
              >
                <LinkedInIcon className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <ul className="space-y-3">
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
            <div className="mt-8 space-y-2">
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

        <div className="mt-16 pt-6 border-t border-cream/10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <p className="text-[11px] text-cream/30">{SITE_CONFIG.copyright}</p>
            <p className="text-[11px] text-cream/30">{SITE_CONFIG.legalFooter}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
