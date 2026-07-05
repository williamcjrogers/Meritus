"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { NAV_ITEMS, NAV_PANEL_INFO, INSIGHT_ARTICLES } from "@/lib/constants";
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

  // When the mega menu is open the panel supplies a dark backdrop from the
  // very top of the page, so the chrome switches to its over-dark treatment
  // regardless of scroll position.
  const overlayOpen = openMenu !== null;
  const darkChrome = scrolled && !overlayOpen;
  const activeSection = NAV_ITEMS.find((item) => item.label === openMenu && item.children);
  const latestInsight = INSIGHT_ARTICLES[INSIGHT_ARTICLES.length - 1];

  // The sheet's height glides between sections: measure the natural content
  // height on open and on every section switch, and let framer tween to it.
  const sheetInnerRef = useRef<HTMLDivElement | null>(null);
  const [sheetHeight, setSheetHeight] = useState<number | "auto">("auto");

  useEffect(() => {
    if (!overlayOpen) return;
    const el = sheetInnerRef.current;
    if (el) setSheetHeight(el.offsetHeight);
  }, [overlayOpen, openMenu]);

  useEffect(() => {
    if (!overlayOpen) {
      setSheetHeight("auto"); // next open starts at natural height, no stale tween
      return;
    }
    const el = sheetInnerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSheetHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [overlayOpen]);

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
          darkChrome
            ? "bg-stone/95 backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.05)] border-green/5"
            : "bg-transparent shadow-none border-transparent"
        }`}
      >
        <div className="relative z-10 max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%]">
          <nav className="relative flex items-center justify-between h-16 lg:h-20" aria-label="Main navigation">
            <Link href="/">
              <HallmarkLogo
                size="header"
                variant={darkChrome ? "dark" : "light"}
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
                      darkChrome ? "text-green/70 hover:text-green" : "text-cream/80 hover:text-cream"
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
                        darkChrome ? "bg-green/30" : "bg-cream/30"
                      } ${isActive || isOpen ? "!w-full !bg-brass/50" : ""}`}
                    />
                  </Link>
                );
              })}

            </div>

            {/* Right Action Links */}
            <div className="hidden lg:flex items-center gap-6">
              <Link
                href="/contact"
                className="group inline-flex items-center gap-2 px-4 py-2 rounded-md border-2 border-brass bg-brass text-[12px] font-medium tracking-wide text-green transition-all duration-300 hover:bg-brass-light hover:border-brass-light hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(181,151,90,0.15)]"
              >
                Request Conflict Check
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
                  <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
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
                  className={`block w-5 h-[1.5px] transition-all duration-300 ${darkChrome ? "bg-green" : "bg-cream"} ${i === 0 && mobileOpen ? "rotate-45 translate-y-[4.5px]" : ""}
                    ${i === 1 && mobileOpen ? "opacity-0" : ""}
                    ${i === 2 && mobileOpen ? "-rotate-45 -translate-y-[4.5px]" : ""}`}
                />
              ))}
            </button>
          </nav>
        </div>

        {/* Mega menu — a full-width sheet that drops from the very top of the
            page (the nav row sits on top of it). Shows ONLY the hovered
            section: its links on the left, section-specific information on
            the right. Switching sections cross-fades the content without
            re-running the curtain. */}
        <AnimatePresence>
          {activeSection && (
            <motion.div
              key="mega-sheet"
              initial={{ y: "-100%" }}
              animate={{ y: 0 }}
              exit={{ y: "-100%" }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="hidden lg:block absolute inset-x-0 top-0 bg-[#0b1f13]/95 backdrop-blur-md border-b border-brass/15 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.55)]"
              onMouseEnter={() => {
                if (closeTimer.current) clearTimeout(closeTimer.current);
              }}
              onMouseLeave={scheduleClose}
            >
              <motion.div
                initial={false}
                animate={{ height: sheetHeight }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div ref={sheetInnerRef}>
                  <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%] pt-24 pb-10">
                {/* Keyed remount: switching sections replaces the content
                    instantly and the new section animates in — no waiting on
                    exit animations, so rapid hover switches stay snappy. */}
                <motion.div
                  key={activeSection.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="grid grid-cols-12 gap-10"
                >
                    {/* Left — the hovered section's links */}
                    <div className="col-span-5">
                      <div className="font-mono text-[10px] font-medium uppercase tracking-[0.25em] text-brass mb-3 px-1">
                        {activeSection.label}
                      </div>
                      <div className="h-[1px] bg-brass/15 mb-2" />
                      {activeSection.children!.map((child, i) => (
                        <motion.div
                          key={child.href}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.35, delay: 0.1 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                        >
                          <Link
                            href={child.href}
                            onClick={(e) => handleChildClick(e, child.href)}
                            className="group/item relative flex items-center justify-between gap-6 py-3 px-1"
                          >
                            <span>
                              <span className="block font-serif text-[19px] leading-snug text-cream/90 group-hover/item:text-brass transition-colors duration-300">
                                {child.label}
                              </span>
                              {child.desc && (
                                <span className="block text-[11px] font-light text-cream/40 mt-0.5">
                                  {child.desc}
                                </span>
                              )}
                            </span>
                            <span
                              aria-hidden="true"
                              className="shrink-0 inline-flex items-center gap-2 font-mono text-[9px] tracking-[0.2em] uppercase text-brass opacity-0 -translate-x-1 group-hover/item:opacity-100 group-hover/item:translate-x-0 transition-all duration-300"
                            >
                              Visit <span className="text-sm leading-none" aria-hidden="true">→</span>
                            </span>
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-x-0 bottom-0 h-px w-0 bg-brass/25 transition-all duration-500 ease-out group-hover/item:w-full"
                            />
                          </Link>
                        </motion.div>
                      ))}
                    </div>

                    {/* Right — information specific to the hovered section */}
                    <div className="col-span-7 pl-10 grid grid-cols-2 gap-8 content-start">
                      {(() => {
                        const info = NAV_PANEL_INFO[activeSection.label];
                        if (!info) return null;
                        return (
                          <>
                            <motion.div
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.35, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
                            >
                              <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-brass/70 mb-4">
                                {info.eyebrow}
                              </div>
                              <p className="text-[13px] text-cream/60 font-light leading-[1.8]">
                                {info.body}
                              </p>
                              <Link
                                href={activeSection.href}
                                className="mt-6 inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-brass hover:text-brass-light transition-colors duration-200 group/lnk"
                              >
                                {info.linkLabel}
                                <span aria-hidden="true" className="group-hover/lnk:translate-x-0.5 transition-transform duration-200">→</span>
                              </Link>
                            </motion.div>

                            <motion.div
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.35, delay: 0.26, ease: [0.22, 1, 0.36, 1] }}
                              className="self-start"
                            >
                              {activeSection.label === "Insights" ? (
                                <Link
                                  href={latestInsight.href}
                                  className="group/card relative block border border-brass/15 bg-white/[0.02] p-6 hover:border-brass/40 transition-colors duration-300"
                                >
                                  <span className="absolute top-0 left-0 w-2 h-2 border-t border-l border-brass/40" aria-hidden="true" />
                                  <span className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-brass/40" aria-hidden="true" />
                                  <span className="block font-mono text-[9px] tracking-[0.2em] uppercase text-brass/70">
                                    {latestInsight.category} · {latestInsight.date}
                                  </span>
                                  <span className="mt-3 block font-serif text-[17px] leading-snug text-cream/90 group-hover/card:text-brass transition-colors duration-300">
                                    {latestInsight.title}
                                  </span>
                                  <span className="mt-4 block font-mono text-[9px] tracking-[0.15em] uppercase text-cream/40">
                                    {latestInsight.readTime} · Read briefing →
                                  </span>
                                </Link>
                              ) : info.quote ? (
                                <div className="relative border border-brass/15 bg-white/[0.02] p-6">
                                  <span className="absolute top-0 left-0 w-2 h-2 border-t border-l border-brass/40" aria-hidden="true" />
                                  <span className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-brass/40" aria-hidden="true" />
                                  <p className="font-serif italic text-[18px] text-cream/80 leading-snug">
                                    {info.quote}
                                  </p>
                                </div>
                              ) : info.stat ? (
                                <div className="relative border border-brass/15 bg-white/[0.02] p-6">
                                  <span className="absolute top-0 left-0 w-2 h-2 border-t border-l border-brass/40" aria-hidden="true" />
                                  <span className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-brass/40" aria-hidden="true" />
                                  <div className="font-serif text-[56px] leading-none text-brass/30">{info.stat.value}</div>
                                  <div className="mt-3 font-mono text-[9px] tracking-[0.2em] uppercase text-cream/40">{info.stat.label}</div>
                                </div>
                              ) : null}
                            </motion.div>
                          </>
                        );
                      })()}
                    </div>
                </motion.div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <MobileNav isOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}
