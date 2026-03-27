"use client";

/**
 * PLACEHOLDER SVG — To be replaced with animated SVG by Gemini
 *
 * CASE: Hochtief v Atkins [2019] EWHC 2109 (TCC)
 * SECTOR: Infrastructure > Highways & Bridges
 *
 * WHAT HAPPENED: Hochtief/Volker Fitzpatrick JV sued Atkins for negligent structural
 * design on the East Kent Access Road (A256/A299). Cottington Road Bridge (two-span
 * steel/concrete over railway) and Cliffsend Underpass (120m tunnel) had design
 * deficiencies. Court found Atkins liable, awarding £800k+ in damages.
 *
 * VISUAL CONCEPT: A structural bridge cross-section (two-span steel/concrete composite)
 * showing the design deficiency at the critical connection point. Include a road
 * alignment plan view with the bridge and underpass locations marked. Show structural
 * load paths with the failure point highlighted. Annotate with engineering tolerances
 * and the deviation from specification.
 *
 * STYLE GUIDE: (same as MurphyTerminal — see that file for full spec)
 * - Use data-hochtief-terminal attribute
 */
export function HochtiefTerminal({ className = "" }: { className?: string }) {
  return (
    <div
      data-hochtief-terminal
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
          AWAITING SVG: Hochtief v Atkins [2019]
        </text>
      </svg>
    </div>
  );
}
