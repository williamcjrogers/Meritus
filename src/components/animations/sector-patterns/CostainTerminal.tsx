"use client";

/**
 * PLACEHOLDER SVG — To be replaced with animated SVG by Gemini
 *
 * CASE: Costain v Charles Haswell [2009] EWHC 3140 (TCC)
 * SECTOR: Infrastructure > Water & Utilities
 *
 * WHAT HAPPENED: Costain designed and constructed the Lostock and Rivington Water
 * Treatment Works for United Utilities. Haswell, the civil engineering design
 * consultant, negligently misinterpreted geological data and recommended a ground
 * treatment scheme that failed, requiring expensive redesign to piled foundations.
 *
 * VISUAL CONCEPT: A geological cross-section showing soil strata with borehole
 * data points. Visualise the original ground treatment scheme failing (settlement/
 * collapse) and the redesigned piled foundations. Show the geological data
 * interpretation error — the misread stratum. Include a water treatment works
 * plan view with the affected structure highlighted. Annotate with ground
 * investigation references and bearing capacity values.
 *
 * STYLE GUIDE: (same as MurphyTerminal — see that file for full spec)
 * - Use data-costain-terminal attribute
 */
export function CostainTerminal({ className = "" }: { className?: string }) {
  return (
    <div
      data-costain-terminal
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
          AWAITING SVG: Costain v Haswell [2009]
        </text>
      </svg>
    </div>
  );
}
