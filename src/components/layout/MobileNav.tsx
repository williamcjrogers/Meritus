"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MobileAuth } from "./MobileAuth";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}
const links = [
  { label: "Expertise", href: "/services" },
  { label: "Approach", href: "/method" },
  { label: "Insights", href: "/insights" },
  { label: "Contact", href: "/contact" },
];

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const panel = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    if (isOpen) panel.current?.querySelector<HTMLAnchorElement>("a")?.focus();
  }, [isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    const resize = () => {
      if (window.matchMedia("(min-width: 1100px)").matches) onClose();
    };
    document.addEventListener("keydown", dismiss);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("keydown", dismiss);
      window.removeEventListener("resize", resize);
    };
  }, [isOpen, onClose]);

  return (
    <div
      ref={panel}
      id="public-mobile-navigation"
      className="public-mobile-nav"
      hidden={!isOpen}
    >
      <nav aria-label="Mobile navigation">
        {links.map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            onClick={onClose}
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
      <div className="public-mobile-secondary">
        <Link href="/sectors" onClick={onClose}>
          Sectors
        </Link>
        <Link href="/credentials" onClick={onClose}>
          Credentials
        </Link>
      </div>
      <div className="public-mobile-account">
        <Link href="/access" onClick={onClose} className="public-client-access">
          Client access
        </Link>
        <MobileAuth onNavigate={onClose} />
      </div>
    </div>
  );
}
