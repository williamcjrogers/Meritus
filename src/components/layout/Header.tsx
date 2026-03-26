"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { HallmarkLogo } from "@/components/icons/HallmarkLogo";
import { MobileNav } from "./MobileNav";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          setScrolled(window.scrollY > 40);
          ticking = false;
        });
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 border-b ${
          scrolled 
            ? "bg-stone/95 backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.05)] border-green/5" 
            : "bg-transparent shadow-none border-transparent"
        }`}
      >
        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%]">
          <nav className="relative flex items-center justify-between h-16 lg:h-20" aria-label="Main navigation">
            <Link href="/">
              <HallmarkLogo
                size="header"
                variant={scrolled ? "dark" : "light"}
              />
            </Link>

            {/* Center Navigation Links */}
            <div className="hidden lg:flex items-center justify-center absolute left-[45%] -translate-x-1/2 gap-8">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative group text-[13px] font-medium tracking-wide transition-colors duration-300 py-1 ${
                      scrolled ? "text-green/70 hover:text-green" : "text-cream/80 hover:text-cream"
                    } ${isActive ? "!text-brass" : ""}`}
                  >
                    {item.label}
                    <span 
                      className={`absolute bottom-0 left-0 w-0 h-[1px] transition-all duration-300 ease-out group-hover:w-full ${
                        scrolled ? "bg-green/30" : "bg-cream/30"
                      } ${isActive ? "!w-full !bg-brass/50" : ""}`} 
                    />
                  </Link>
                );
              })}
            </div>

            {/* Right Action Links */}
            <div className="hidden lg:flex items-center gap-6">
              <Link
                href="/contact"
                className={`relative group text-[13px] font-medium tracking-wide transition-colors duration-300 py-1 ${
                  scrolled ? "text-green/90 hover:text-green" : "text-cream hover:text-cream"
                }`}
              >
                Request Conflict Check
                <span 
                  className={`absolute bottom-0 left-0 w-full h-[1px] transition-all duration-300 ease-out ${
                    scrolled ? "bg-green/20 group-hover:bg-brass/60" : "bg-cream/20 group-hover:bg-brass/60"
                  }`} 
                />
              </Link>
              <Link
                href="/claims-intelligence"
                className="text-[12px] font-medium tracking-wide bg-brass text-green px-4 py-1.5 rounded-sm hover:bg-[#d4ba8d] hover:-translate-y-[1px] transition-all duration-300 shadow-sm hover:shadow-md border border-brass/50"
              >
                Claims Intelligence
              </Link>
            </div>

            <button
              className="lg:hidden relative w-8 h-8 flex flex-col items-center justify-center gap-1.5"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={`block w-5 h-[1.5px] transition-all duration-300 ${scrolled ? "bg-green" : "bg-cream"} ${i === 0 && mobileOpen ? "rotate-45 translate-y-[4.5px]" : ""}
                    ${i === 1 && mobileOpen ? "opacity-0" : ""}
                    ${i === 2 && mobileOpen ? "-rotate-45 -translate-y-[4.5px]" : ""}`}
                />
              ))}
            </button>
          </nav>
        </div>
      </header>

      <MobileNav isOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}
