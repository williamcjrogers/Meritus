import Link from "next/link";
import { SITE_CONFIG, FOOTER_NAV } from "@/lib/constants";
import { HallmarkLogo } from "@/components/icons/HallmarkLogo";

export function Footer() {
  return (
    <footer className="public-footer">
      <div className="public-container">
        <div className="public-footer-main">
          <div>
            <Link href="/" aria-label="Meritus Via home">
              <HallmarkLogo variant="dark" />
            </Link>
            <p>
              Construction disputes advisory.
              <br />
              The detail behind a considered position.
            </p>
            <a href={`mailto:${SITE_CONFIG.email}`}>{SITE_CONFIG.email}</a>
          </div>
          <nav aria-label="Practice">
            <h2>Practice</h2>
            <Link href="/services">Expertise</Link>
            <Link href="/sectors">Sectors</Link>
            <Link href="/method">Approach</Link>
            <Link href="/insights">Insights</Link>
          </nav>
          <nav aria-label="Contact and access">
            <h2>Get in touch</h2>
            <Link href="/contact">Contact</Link>
            <Link href="/credentials">Credentials</Link>
            <Link href="/access">Client access</Link>
            <Link href="/sign-in">Staff sign in</Link>
          </nav>
          <nav aria-label="Legal">
            <h2>Information</h2>
            {FOOTER_NAV.legal.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
            <a
              href={SITE_CONFIG.linkedin}
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn
            </a>
          </nav>
        </div>
        <div className="public-footer-legal">
          <p>{SITE_CONFIG.copyright}</p>
          <p>
            Registered in England and Wales. Company no.{" "}
            {SITE_CONFIG.companyNumber}.
          </p>
        </div>
      </div>
    </footer>
  );
}
