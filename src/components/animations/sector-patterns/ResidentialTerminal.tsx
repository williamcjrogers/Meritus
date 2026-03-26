"use client";

export function ResidentialTerminal({ className = "" }: { className?: string }) {
  return (
    <div
      data-res-terminal
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes resDraw {
          from { stroke-dashoffset: 600; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes resFade {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .terminal-active [data-res-terminal] .res-draw {
          stroke-dasharray: 600;
          stroke-dashoffset: 600;
          animation: resDraw 2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .terminal-active [data-res-terminal] .res-block-1 { animation: resFade 0.8s ease forwards 0.5s; opacity: 0; }
        .terminal-active [data-res-terminal] .res-block-2 { animation: resFade 0.8s ease forwards 1.0s; opacity: 0; }
        .terminal-active [data-res-terminal] .res-block-3 { animation: resFade 0.8s ease forwards 1.5s; opacity: 0; }
        .terminal-active [data-res-terminal] .res-alert { animation: resFade 0.8s ease forwards 2.0s; opacity: 0; }
        .terminal-inactive [data-res-terminal] * { opacity: 0 !important; }
      `,
        }}
      />
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice">
        {/* Base line */}
        <line x1="100" y1="350" x2="700" y2="350" stroke="rgba(109, 165, 126, 0.3)" strokeWidth="1" className="res-draw" />

        {/* Section 1: Podium */}
        <g className="res-block-1">
          <rect x="200" y="250" width="300" height="100" fill="rgba(109, 165, 126, 0.1)" stroke="#6da57e" strokeWidth="1" />
          <text x="215" y="270" fill="#6da57e" fontFamily="monospace" fontSize="9" letterSpacing="1">SEC_01: PODIUM</text>
          <text x="215" y="285" fill="rgba(245, 240, 232, 0.4)" fontFamily="monospace" fontSize="8">PC_CERTIFIED: ON_TIME</text>
        </g>

        {/* Section 2: Tower Lower */}
        <g className="res-block-2">
          <rect x="250" y="150" width="200" height="100" fill="rgba(109, 165, 126, 0.1)" stroke="#6da57e" strokeWidth="1" />
          <text x="265" y="170" fill="#6da57e" fontFamily="monospace" fontSize="9" letterSpacing="1">SEC_02: FL_01-15</text>
          <text x="265" y="185" fill="rgba(245, 240, 232, 0.4)" fontFamily="monospace" fontSize="8">PC_CERTIFIED: +12_WKS</text>
        </g>

        {/* Section 3: Penthouse (Delayed) */}
        <g className="res-block-3">
          <rect x="250" y="50" width="200" height="100" fill="rgba(181, 151, 90, 0.15)" stroke="#c1a679" strokeWidth="1" strokeDasharray="4 4" />
          <text x="265" y="70" fill="#c1a679" fontFamily="monospace" fontSize="9" letterSpacing="1">SEC_03: PENTHOUSE</text>
          <text x="265" y="85" fill="rgba(245, 240, 232, 0.4)" fontFamily="monospace" fontSize="8">DELAY: PARTIAL_POSSESSION</text>
        </g>

        {/* Legal Text / Alert */}
        <g className="res-alert">
          <path d="M 450 100 L 520 100" stroke="#c1a679" strokeWidth="1" fill="none" />
          <text x="530" y="95" fill="#c1a679" fontFamily="monospace" fontSize="10" letterSpacing="1">
            JCT_D&B_CL_2.33 // PRACTICAL_COMPLETION
          </text>
          <text x="530" y="110" fill="rgba(245, 240, 232, 0.6)" fontFamily="serif" fontSize="10" fontStyle="italic" letterSpacing="0.5">
            Ref: Walter Lilly & Co Ltd v Mackay [2012]
          </text>
          <rect x="530" y="125" width="220" height="20" fill="rgba(11, 59, 36, 0.5)" />
          <text x="540" y="138" fill="#6da57e" fontFamily="monospace" fontSize="8" letterSpacing="1">
            LOSS_AND_EXPENSE_PROLONGATION
          </text>
        </g>
      </svg>
    </div>
  );
}