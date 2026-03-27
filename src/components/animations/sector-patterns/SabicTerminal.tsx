"use client";

/**
 * PLACEHOLDER SVG — To be replaced with animated SVG by Gemini
 *
 * CASE: Sabic v Punj Lloyd [2013] EWHC 2916 (TCC)
 * SECTOR: Energy > Process & Industrial
 *
 * WHAT HAPPENED: A £135m EPC contract for a low-density polyethylene (LDPE)
 * petrochemical plant at the former ICI site at Wilton, Teesside. SABIC terminated
 * the EPC contractor (Simon Carves / Punj Lloyd) for failure to proceed with due
 * diligence and sought ~£27.5m in damages. Court upheld termination and awarded
 * £11.8m in completion costs. Leading TCC authority on EPC contract termination.
 *
 * VISUAL CONCEPT: A process flow diagram (PFD) of an LDPE polymerisation plant
 * showing reactors, extruders, and cooling systems. Visualise the construction
 * progress stalling — a "progress curve" (S-curve) flatlining against the baseline.
 * Show the termination event as a decisive cut point on the timeline. Include
 * performance bond and advance payment guarantee indicators. Annotate with EPC
 * milestone references and the completion cost differential.
 *
 * STYLE GUIDE: (same as MurphyTerminal — see that file for full spec)
 * - Use data-sabic-terminal attribute
 */
export function SabicTerminal({ className = "" }: { className?: string }) {
  return (
    <div
      data-sabic-terminal
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
          AWAITING SVG: Sabic v Punj Lloyd [2013]
        </text>
      </svg>
    </div>
  );
}
