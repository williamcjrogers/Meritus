"use client";

/**
 * PLACEHOLDER SVG — To be replaced with animated SVG by Gemini
 *
 * CASE: Murphy v Brentwood District Council [1991] 1 AC 398
 * SECTOR: Buildings > Residential & Prime Development
 *
 * WHAT HAPPENED: A homeowner discovered defective raft foundations in his house,
 * approved by the council's engineers. The House of Lords held that local
 * authorities owe no duty of care in negligence for pure economic loss arising
 * from defective buildings, overruling Anns v Merton.
 *
 * VISUAL CONCEPT: Cross-section of a residential building with a raft foundation.
 * Show the foundation cracking / deflecting under load. Annotate the structural
 * failure point with forensic callouts. Include a "liability chain" diagram
 * (homeowner → council → engineer) with the council link severed / struck through.
 *
 * STYLE GUIDE:
 * - viewBox="0 0 800 500"
 * - Background grid: rgba(109, 165, 126, 0.15) lines
 * - Primary line colour: #6da57e (green)
 * - Accent / highlight colour: #c1a679 (brass)
 * - Text: monospace, sizes 7-10px
 * - Animations: CSS keyframes via <style dangerouslySetInnerHTML>
 * - Use data-murphy-terminal attribute on root div
 * - Class pattern: .terminal-active [data-murphy-terminal] .class-name
 * - Must include: draw-on lines, fade-in labels, pulsing highlight at failure point
 */
export function MurphyTerminal({ className = "" }: { className?: string }) {
  return (
    <div
      data-murphy-terminal
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
          AWAITING SVG: Murphy v Brentwood [1991]
        </text>
      </svg>
    </div>
  );
}
