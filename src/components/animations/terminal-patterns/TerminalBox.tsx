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
      className={`relative aspect-[16/10] ${className}`}
    >
      {/* Outer HUD Borders (Floating outside the green section) */}
      <div className="absolute -inset-2 sm:-inset-4 pointer-events-none z-20">
        {/* Corner Brackets */}
        <div className="absolute top-0 left-0 w-3 h-3 sm:w-5 sm:h-5 border-t border-l border-[#c1a679]/60" />
        <div className="absolute top-0 right-0 w-3 h-3 sm:w-5 sm:h-5 border-t border-r border-[#c1a679]/60" />
        <div className="absolute bottom-0 left-0 w-3 h-3 sm:w-5 sm:h-5 border-b border-l border-[#c1a679]/60" />
        <div className="absolute bottom-0 right-0 w-3 h-3 sm:w-5 sm:h-5 border-b border-r border-[#c1a679]/60" />
        
        {/* Corner Markers */}
        <div className="absolute -top-4 left-0 text-[#c1a679]/50 font-mono text-[7px] sm:text-[8px] tracking-widest hidden sm:block">SYS.OP.01</div>
        <div className="absolute -bottom-4 right-0 text-[#c1a679]/50 font-mono text-[7px] sm:text-[8px] tracking-widest hidden sm:block">AXIS_LOCK</div>
      </div>

      {/* Inner Green Screen */}
      <div className="absolute inset-0 bg-green overflow-hidden rounded-sm shadow-xl border border-green/20">
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
    </div>
  );
}
