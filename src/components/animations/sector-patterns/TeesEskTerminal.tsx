"use client";

/**
 * PLACEHOLDER SVG — To be replaced with animated SVG by Gemini
 *
 * CASE: Tees Esk & Wear Valleys NHS v Three Valleys Healthcare [2018] EWHC 1659 (TCC)
 * SECTOR: Buildings > Healthcare & Education
 *
 * WHAT HAPPENED: Roseberry Park Hospital, a 365-bed mental health PFI facility in
 * Middlesbrough, suffered serious construction defects to roofing, plumbing, and
 * fire safety systems. The court upheld the NHS Trust's right to terminate the
 * PFI agreement. One of the first successful terminations of a healthcare PFI
 * contract for construction defects.
 *
 * VISUAL CONCEPT: A hospital floor plan / schematic with defect markers appearing
 * at roofing, plumbing, and fire safety locations. Show a PFI contract structure
 * diagram (SPV → contractor → subcontractors) with the termination point highlighted.
 * Include defect severity indicators and a "compliance scan" progressing across
 * building systems. Annotate with building regulation references.
 *
 * STYLE GUIDE: (same as MurphyTerminal — see that file for full spec)
 * - Use data-tees-terminal attribute
 */
export function TeesEskTerminal({ className = "" }: { className?: string }) {
  return (
    <div
      data-tees-terminal
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
          AWAITING SVG: Tees Esk v Three Valleys [2018]
        </text>
      </svg>
    </div>
  );
}
