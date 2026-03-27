"use client";

import { useState } from "react";

/**
 * TerminalToggle — small tab toggle for switching between two terminal
 * visualizations (A/B examples) within a service section.
 */
export function TerminalToggle({
  labels,
  texts,
  children,
}: {
  labels: [string, string];
  texts?: [string, string];
  children: [React.ReactNode, React.ReactNode];
}) {
  const [active, setActive] = useState(0);

  return (
    <div className="relative h-full">
      {/* Outer HUD Borders for TerminalToggle */}
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

      <div className="flex flex-col h-full bg-green p-5 lg:p-6 relative overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-[150px] bg-gradient-to-t from-stone/10 to-transparent pointer-events-none z-0" />

        <div className="relative z-10 flex gap-4 mb-3">
          {labels.map((label, i) => (
            <button
              key={label}
              onClick={() => setActive(i)}
              className={`font-mono text-[10px] tracking-[0.15em] uppercase pb-1 border-b transition-colors duration-200 ${active === i
                  ? "text-brass border-brass/60"
                  : "text-cream/30 border-transparent hover:text-cream/50"
                }`}
            >
              {label}
            </button>
          ))}
        </div>

        {texts && (
          <div key={`text-${active}`} className="relative z-10 mb-6 min-h-[80px] animate-in fade-in duration-500">
            <div className="font-mono text-[10px] tracking-[0.15em] text-brass/60 mb-2 mt-1">
              Illustrative analysis: {labels[active]}
            </div>
            <p className="font-mono text-[12px] text-cream/70 leading-relaxed">
              {texts[active]}
            </p>
          </div>
        )}

        <div className="relative z-10 flex-1 w-full min-h-[250px]">
          {children[active]}
        </div>
      </div>
    </div>
  );
}
