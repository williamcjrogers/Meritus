"use client";

/**
 * PLACEHOLDER SVG — To be replaced with animated SVG by Gemini
 *
 * CASE: Henry Boot v Alstom Combined Cycles [2000] EWCA Civ 99
 * SECTOR: Energy > Power Generation & Grid
 *
 * WHAT HAPPENED: Civil engineering works for a CCGT power station at Connah's Quay,
 * North Wales, under ICE 6th Edition. When the employer varied the cold water
 * pipework elevation, the contractor's pricing error affected variation valuation.
 * Court of Appeal established the correct method for valuing variations under
 * Clause 52(1) of ICE Conditions where original rates contain a mistake.
 *
 * VISUAL CONCEPT: A power station schematic showing the CCGT cycle (gas turbine →
 * HRSG → steam turbine → condenser → cooling water). Highlight the cold water
 * pipework system that was varied. Show a "variation valuation" calculation with
 * the original rate, the error, and the corrected valuation method side by side.
 * Include ICE Clause 52(1) reference and a cost comparison waterfall chart.
 *
 * STYLE GUIDE: (same as MurphyTerminal — see that file for full spec)
 * - Use data-henryboot-terminal attribute
 */
export function HenryBootTerminal({ className = "" }: { className?: string }) {
  return (
    <div
      data-henryboot-terminal
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
          AWAITING SVG: Henry Boot v Alstom [2000]
        </text>
      </svg>
    </div>
  );
}
