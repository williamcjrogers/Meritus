"use client";

/**
 * PLACEHOLDER SVG — To be replaced with animated SVG by Gemini
 *
 * CASE: MT Højgaard v E.ON Climate & Renewables [2017] UKSC 59
 * SECTOR: Energy > Renewables
 *
 * WHAT HAPPENED: Offshore wind farm foundations at Robin Rigg in the Solway Firth
 * failed shortly after completion. The contract required compliance with J101
 * design standard (which contained an unknown mathematical error with a tenfold
 * factor) and separately warranted a 20-year design life. The Supreme Court held
 * the 20-year design life obligation was a binding fitness-for-purpose warranty
 * that took precedence over compliance with the flawed design standard.
 *
 * VISUAL CONCEPT: An offshore wind turbine cross-section showing the monopile
 * foundation in the seabed. Visualise the grouted connection joint that failed.
 * Show wave loading forces acting on the structure. Include a "design life
 * countdown" (20 years → actual failure point). Visualise the J101 standard
 * calculation error (the tenfold factor) as a highlighted equation. Show the
 * Solway Firth wind farm layout with affected turbine positions marked.
 *
 * STYLE GUIDE: (same as MurphyTerminal — see that file for full spec)
 * - Use data-hojgaard-terminal attribute
 */
export function HojgaardTerminal({ className = "" }: { className?: string }) {
  return (
    <div
      data-hojgaard-terminal
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice">
        <g stroke="rgba(109, 165, 126, 0.15)" strokeWidth="0.5">
          {Array.from({ length: 40 }).map((_, i) => (
            <line key={`v${i}`} x1={i * 20} y1="0" x2={i * 20} y2="500" strokeDasharray={i % 5 === 0 ? "none" : "2 2"} stroke={i % 5 === 0 ? "rgba(109, 165, 126, 0.25)" : "rgba(109, 165, 126, 0.1)"} />
          ))}
          {Array.from({ length: 25 }).map((_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 20} x2="800" y2={i * 20} strokeDasharray={i % 5 === 0 ? "none" : "2 2"} stroke={i % 5 === 0 ? "rgba(109, 165, 126, 0.25)" : "rgba(109, 165, 126, 0.1)"} />
          ))}
        </g>
        <text x="400" y="250" textAnchor="middle" fill="rgba(109, 165, 126, 0.3)" fontFamily="monospace" fontSize="11">
          AWAITING SVG: MT Højgaard v E.ON [2017]
        </text>
      </svg>
    </div>
  );
}
