"use client";

/**
 * PLACEHOLDER SVG — To be replaced with animated SVG by Gemini
 *
 * CASE: Beaufort Developments v Gilbert-Ash [1998] UKHL 19
 * SECTOR: Buildings > Commercial & Mixed-Use
 *
 * WHAT HAPPENED: A nine-storey commercial office building in Belfast under JCT.
 * The House of Lords held that courts have inherent power to open up, review, and
 * revise architect's certificates, and employers retain rights of set-off against
 * certified sums. Overruled Northern Regional Health Authority v Derek Crouch [1984].
 *
 * VISUAL CONCEPT: A commercial building elevation (9 storeys) with interim payment
 * certificate values flowing down a cascade. Show an architect's certificate being
 * "opened up" — the certified figure splitting to reveal the true figure beneath.
 * Include a set-off mechanism visualised as a balance / ledger with amounts being
 * deducted. Annotate with JCT clause references.
 *
 * STYLE GUIDE: (same as MurphyTerminal — see that file for full spec)
 * - Use data-beaufort-terminal attribute
 */
export function BeaufortTerminal({ className = "" }: { className?: string }) {
  return (
    <div
      data-beaufort-terminal
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
          AWAITING SVG: Beaufort v Gilbert-Ash [1998]
        </text>
      </svg>
    </div>
  );
}
