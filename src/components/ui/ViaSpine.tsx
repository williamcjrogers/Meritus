"use client";

import { useEffect, useRef } from "react";

/**
 * ViaSpine — the site's signature element.
 *
 * "Via" is the way / the path; the firm's craft is critical-path analysis. This
 * is that idea made literal: a measured programme axis pinned to the left margin,
 * with the brand diamond travelling it as the reader moves down the page. A
 * hairline in the margin — present on every page, quiet on all of them. Desktop
 * only (there is no margin to spare on small screens); scroll-linked, so it
 * needs no motion exception.
 */
export function ViaSpine() {
  const fillRef = useRef<HTMLDivElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      if (fillRef.current) fillRef.current.style.transform = `scaleY(${progress})`;
      if (nodeRef.current) nodeRef.current.style.top = `${progress * 100}%`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="hidden lg:block fixed left-6 xl:left-9 top-[7rem] bottom-12 w-px z-40 pointer-events-none"
    >
      {/* Programme baseline (as-planned) */}
      <div className="absolute inset-0 bg-brass/15" />

      {/* Measured ticks — a programme's time axis, so it reads as a rule, not a scrollbar */}
      {[0, 25, 50, 75, 100].map((t) => (
        <div
          key={t}
          className="absolute -left-[3px] h-px w-[7px] bg-brass/25"
          style={{ top: `${t}%` }}
        />
      ))}

      {/* Progress travelled (as-built) */}
      <div
        ref={fillRef}
        className="absolute inset-x-0 top-0 h-full origin-top bg-gradient-to-b from-brass/40 to-brass/70"
        style={{ transform: "scaleY(0)" }}
      />

      {/* The travelling node — the brand diamond */}
      <div
        ref={nodeRef}
        className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ top: "0%" }}
      >
        <div className="h-[7px] w-[7px] rotate-45 bg-brass shadow-[0_0_10px_rgba(181,151,90,0.55)]" />
      </div>
    </div>
  );
}
