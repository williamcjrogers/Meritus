"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HallmarkLogo } from "@/components/icons/HallmarkLogo";
import { HeaderAuth } from "./HeaderAuth";
import { MobileNav } from "./MobileNav";

export const PUBLIC_NAV = [
  { label: "Expertise", href: "/services" },
  { label: "Approach", href: "/method" },
  { label: "Insights", href: "/insights" },
  { label: "Contact", href: "/contact" },
] as const;

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeMenu = () => {
    setMobileOpen(false);
    trigger.current?.focus();
  };

  return (
    <header
      className="public-header"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setMobileOpen(false);
      }}
    >
      <div className="public-container public-header-inner">
        <Link href="/" aria-label="Meritus Via home" className="public-brand">
          <HallmarkLogo variant="dark" />
        </Link>
        <nav className="public-desktop-nav" aria-label="Main navigation">
          {PUBLIC_NAV.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              aria-current={
                pathname === href || pathname.startsWith(`${href}/`)
                  ? "page"
                  : undefined
              }
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="public-account-nav">
          <Link href="/access" className="public-client-access">
            Client access
          </Link>
          <HeaderAuth darkChrome />
        </div>
        <button
          ref={trigger}
          type="button"
          className="public-menu-toggle"
          aria-expanded={mobileOpen}
          aria-controls="public-mobile-navigation"
          onClick={() => (mobileOpen ? closeMenu() : setMobileOpen(true))}
        >
          {mobileOpen ? "Close menu" : "Menu"}
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            aria-hidden="true"
            fill="none"
          >
            <path
              d={mobileOpen ? "M4 4l10 10M14 4L4 14" : "M2 5h14M2 12h14"}
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        </button>
      </div>
      <MobileNav isOpen={mobileOpen} onClose={closeMenu} />
    </header>
  );
}
