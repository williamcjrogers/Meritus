"use client";

/**
 * PLACEHOLDER SVG — To be replaced with animated SVG by Gemini
 *
 * CASE: Balfour Beatty v Docklands Light Railway (1996) 78 BLR 42
 * SECTOR: Infrastructure > Rail & Transport
 *
 * WHAT HAPPENED: Beckton Extension of the DLR under ICE 5th Edition with
 * arbitration clause removed. The employer (not independent engineer) made
 * certifying decisions. Court of Appeal held that the employer has an implied
 * duty to act honestly, fairly, and reasonably in exercising contractual discretion.
 *
 * VISUAL CONCEPT: A DLR-style elevated rail network map showing the Beckton
 * Extension route. Visualise the certification process: payment certificates flowing
 * from employer (instead of independent engineer). Show the "duty of fair dealing"
 * as a governance overlay / constraint on the employer's discretionary power.
 * Include ICE clause references and a timeline of the dispute events.
 *
 * STYLE GUIDE: (same as MurphyTerminal — see that file for full spec)
 * - Use data-balfour-dlr-terminal attribute
 */
export function BalfourDLRTerminal({ className = "" }: { className?: string }) {
  return (
    <div
      data-balfour-dlr-terminal
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
          AWAITING SVG: Balfour Beatty v DLR [1996]
        </text>
      </svg>
    </div>
  );
}
