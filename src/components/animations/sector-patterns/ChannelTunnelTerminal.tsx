"use client";

/**
 * PLACEHOLDER SVG — To be replaced with animated SVG by Gemini
 *
 * CASE: Channel Tunnel Group v Balfour Beatty [1993] AC 334
 * SECTOR: Infrastructure > Tunnelling & Marine
 *
 * WHAT HAPPENED: THE Channel Tunnel case. A dispute over cooling system payments
 * led to injunction proceedings. The contract specified ICC arbitration in Brussels
 * under English and French law. The House of Lords held courts can grant
 * interlocutory injunctive relief in support of foreign arbitrations but should
 * not pre-empt the arbitral process. The most famous tunnelling case in UK law.
 *
 * VISUAL CONCEPT: A tunnel boring machine (TBM) cross-section advancing through
 * geological strata beneath the English Channel. Show the Channel cross-section
 * with the tunnel alignment. Visualise the cooling system dispute as a highlighted
 * segment of the tunnel. Include an arbitration jurisdiction diagram showing
 * England ↔ Brussels ↔ France with the ICC arbitration seat. Show the "injunction
 * barrier" being placed and then lifted by the House of Lords.
 *
 * STYLE GUIDE: (same as MurphyTerminal — see that file for full spec)
 * - Use data-channel-terminal attribute
 */
export function ChannelTunnelTerminal({ className = "" }: { className?: string }) {
  return (
    <div
      data-channel-terminal
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
          AWAITING SVG: Channel Tunnel Group v Balfour Beatty [1993]
        </text>
      </svg>
    </div>
  );
}
