"use client";

import { useEffect, useRef, useState } from "react";

/**
 * TerminalBox — shared wrapper that provides the dark-green viewport,
 * scroll-triggered activation, and a slow radar/scanner sweep.
 */
export function TerminalBox({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-terminal
      className={`bg-green aspect-[16/10] relative overflow-hidden ${className}`}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes terminalScan {
          0%   { transform: translateX(-100%); opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { transform: translateX(800%); opacity: 0; }
        }
        [data-terminal] .terminal-scan {
          animation: terminalScan 8s ease-in-out infinite;
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          [data-terminal] .terminal-scan { animation: none; opacity: 0; }
        }
      `,
        }}
      />

      {/* Scanner sweep */}
      <div
        className={`absolute inset-y-0 w-24 z-[5] pointer-events-none bg-gradient-to-r from-transparent via-[#6da57e]/[0.07] to-transparent ${active ? "terminal-scan" : "opacity-0"}`}
      />

      {/* Content — activated on scroll */}
      <div className={active ? "terminal-active" : "terminal-inactive"}>
        {children}
      </div>
    </div>
  );
}
