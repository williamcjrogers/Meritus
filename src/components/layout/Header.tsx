"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { NAV_ITEMS } from "@/lib/constants";
import { smoothScrollToId } from "@/lib/smooth-scroll";
import { HallmarkLogo } from "@/components/icons/HallmarkLogo";
import { MobileNav } from "./MobileNav";

// Pages whose hash links are long scrolling sections (not tabs)
const SMOOTH_HASH_PATHS = ["/services", "/method"];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingHash = useRef<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  const handleChildClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    setOpenMenu(null);
    const [path, hash] = href.split("#");
    if (!hash) return;

    // Sectors: the hash selects a tab inside the page (handled by SectorsClient).
    // Set the hash directly so `hashchange` fires (Next's pushState would not).
    if (path === "/sectors") {
      e.preventDefault();
      if (pathname === "/sectors") {
        if (window.location.hash === `#${hash}`) {
          window.dispatchEvent(new HashChangeEvent("hashchange"));
        } else {
          window.location.hash = hash;
        }
      } else {
        router.push(`/sectors#${hash}`);
      }
      return;
    }

    if (!SMOOTH_HASH_PATHS.includes(path)) return;

    e.preventDefault();
    if (path === pathname) {
      window.history.pushState(null, "", `#${hash}`);
      smoothScrollToId(hash);
    } else {
      // Land the new page at the top, then sweep down to the section
      pendingHash.current = hash;
      router.push(path, { scroll: true });
    }
  };

  // After a cross-page navigation, wait for the section to exist, then sweep
  useEffect(() => {
    if (!pendingHash.current) return;
    const hash = pendingHash.current;
    pendingHash.current = null;

    let attempts = 0;
    const tryScroll = () => {
      const el = document.getElementById(hash);
      if (el) {
        window.scrollTo({ top: 0, behavior: "instant" });
        window.history.replaceState(null, "", `#${hash}`);
        smoothScrollToId(hash);
      } else if (attempts++ < 40) {
        setTimeout(tryScroll, 50);
      }
    };
    tryScroll();
  }, [pathname]);

  const openDropdown = (label: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenMenu(label);
  };

  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenMenu(null), 150);
  };

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
    setOpenMenu(null);
  }, [pathname]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

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
            <div
              className="hidden lg:flex items-center justify-center absolute left-[45%] -translate-x-1/2 gap-8"
              onMouseLeave={scheduleClose}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  scheduleClose();
                }
              }}
            >
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                const isOpen = openMenu === item.label;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onMouseEnter={() => (item.children ? openDropdown(item.label) : scheduleClose())}
                    onFocus={() => item.children && openDropdown(item.label)}
                    aria-haspopup={item.children ? "menu" : undefined}
                    aria-expanded={item.children ? isOpen : undefined}
                    className={`relative group inline-flex items-center gap-1.5 text-[13px] font-medium tracking-wide transition-colors duration-300 py-1 ${
                      scrolled ? "text-green/70 hover:text-green" : "text-cream/80 hover:text-cream"
                    } ${isActive ? "!text-brass" : ""}`}
                  >
                    {item.label}
                    {item.children && (
                      <svg
                        width="8"
                        height="8"
                        viewBox="0 0 8 8"
                        fill="none"
                        aria-hidden="true"
                        className={`transition-transform duration-300 opacity-60 ${isOpen ? "rotate-180" : ""}`}
                      >
                        <path d="M1 2.5 4 5.5 7 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    <span
                      className={`absolute bottom-0 left-0 w-0 h-[1px] transition-all duration-300 ease-out group-hover:w-full ${
                        scrolled ? "bg-green/30" : "bg-cream/30"
                      } ${isActive ? "!w-full !bg-brass/50" : ""}`}
                    />
                  </Link>
                );
              })}

              {/* Unified mega menu — every section's links in one panel */}
              <AnimatePresence>
                {openMenu !== null && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, x: "-50%" }}
                    animate={{ opacity: 1, y: 0, x: "-50%" }}
                    exit={{ opacity: 0, y: 6, x: "-50%" }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="absolute top-full left-1/2 pt-3 w-[860px] z-50"
                    onMouseEnter={() => {
                      if (closeTimer.current) clearTimeout(closeTimer.current);
                    }}
                  >
                    <div className="relative bg-[#0b1f13]/95 backdrop-blur-md border border-brass/15 rounded-sm shadow-2xl shadow-black/40 overflow-hidden">
                      {/* Decorative corner markers */}
                      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-brass/40" />
                      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-brass/40" />

                      <div className="grid grid-cols-4 divide-x divide-brass/10 py-4">
                        {NAV_ITEMS.map((section) =>
                          section.children ? (
                            <div
                              key={section.href}
                              onMouseEnter={() => openDropdown(section.label)}
                              className={`transition-opacity duration-300 ${
                                openMenu === section.label ? "opacity-100" : "opacity-70"
                              }`}
                            >
                              <Link
                                href={section.href}
                                className={`block px-5 pt-1 pb-2 text-[10px] font-medium uppercase tracking-[0.2em] transition-colors duration-200 ${
                                  openMenu === section.label
                                    ? "text-brass"
                                    : "text-brass/50 hover:text-brass"
                                }`}
                              >
                                {section.label}
                              </Link>
                              <div className="h-[1px] bg-brass/10 mx-5 mb-1.5" />
                              {section.children.map((child) => (
                                <div key={child.href}>
                                  {child.divider && (
                                    <div className="h-[1px] bg-brass/10 mx-5 my-1.5" />
                                  )}
                                  <Link
                                    href={child.href}
                                    onClick={(e) => handleChildClick(e, child.href)}
                                    className="group/dd flex flex-col gap-0.5 px-5 py-2 transition-colors duration-200 hover:bg-white/[0.04]"
                                  >
                                    <span className="text-[13px] font-medium tracking-wide leading-snug text-cream/90 group-hover/dd:text-brass transition-colors duration-200">
                                      {child.label}
                                    </span>
                                    {child.desc && (
                                      <span className="text-[11px] font-light text-cream/40 leading-snug">
                                        {child.desc}
                                      </span>
                                    )}
                                  </Link>
                                </div>
                              ))}
                            </div>
                          ) : null
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right Action Links */}
            <div className="hidden lg:flex items-center gap-6">
              <Link
                href="/contact"
                className={`inline-flex items-center px-5 py-2 border text-[12px] font-medium tracking-wide transition-all duration-300 hover:border-brass hover:text-brass hover:bg-brass/5 ${
                  scrolled ? "border-green/25 text-green" : "border-cream/30 text-cream"
                }`}
              >
                Request Conflict Check
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
