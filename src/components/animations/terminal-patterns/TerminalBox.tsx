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

      {/* HUD Borders */}
      <div className="absolute inset-0 pointer-events-none z-20">
        {/* Subtle inner grid lines forming a border */}
        <div className="absolute inset-4 border border-[#6da57e]/20" />
        
        {/* Corner Brackets */}
        <div className="absolute top-4 left-4 w-6 h-6 border-t border-l border-[#c1a679]/60" />
        <div className="absolute top-4 right-4 w-6 h-6 border-t border-r border-[#c1a679]/60" />
        <div className="absolute bottom-4 left-4 w-6 h-6 border-b border-l border-[#c1a679]/60" />
        <div className="absolute bottom-4 right-4 w-6 h-6 border-b border-r border-[#c1a679]/60" />
        
        {/* Corner Markers */}
        <div className="absolute top-[14px] left-6 text-[#6da57e]/50 font-mono text-[8px] tracking-widest">SYS.OP.01</div>
        <div className="absolute bottom-[14px] right-6 text-[#6da57e]/50 font-mono text-[8px] tracking-widest">AXIS_LOCK</div>
      </div>
    </div>
  );
}
