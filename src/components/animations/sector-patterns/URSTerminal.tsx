"use client";

/**
 * PLACEHOLDER SVG — To be replaced with animated SVG by Gemini
 *
 * CASE: URS Corporation v BDW Trading [2025] UKSC 21
 * SECTOR: Buildings > Building Safety Act Remediation
 *
 * WHAT HAPPENED: The first Supreme Court interpretation of BSA 2022. BDW
 * (Barratt/David Wilson Homes) discovered structural design defects in high-rise
 * developments designed by URS and voluntarily remediated them. The Supreme Court
 * unanimously held that developers can recover voluntarily incurred remediation
 * costs in negligence without a prior third-party claim, and clarified the
 * retrospective effect of extended limitation periods under s.135 BSA (back to 1992).
 *
 * VISUAL CONCEPT: A high-rise building cross-section showing cladding layers being
 * peeled back / inspected. Show the BSA retrospective timeline stretching back to
 * 1992. Visualise the liability chain (developer → designer) with remediation cost
 * recovery flowing in reverse. Include a "compliance matrix" scanning each floor
 * for defects. Fire safety indicators and cladding system annotations.
 *
 * STYLE GUIDE: (same as MurphyTerminal — see that file for full spec)
 * - Use data-urs-terminal attribute
 */
export function URSTerminal({ className = "" }: { className?: string }) {
  return (
    <div
      data-urs-terminal
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
          AWAITING SVG: URS v BDW [2025]
        </text>
      </svg>
    </div>
  );
}
