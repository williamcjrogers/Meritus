"use client";

export function HenryBootTerminal({ className = "" }: { className?: string }) {
  return (
    <div
      data-henryboot-terminal
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes flowPipe {
          from { stroke-dashoffset: 40; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes errorFlash {
          0%, 100% { fill: rgba(193, 166, 121, 0.1); stroke: rgba(193, 166, 121, 0.5); }
          50%      { fill: rgba(193, 166, 121, 0.3); stroke: #c1a679; }
        }
        @keyframes scaleBar {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        .terminal-active [data-henryboot-terminal] .anim-flow {
          stroke-dasharray: 8 8;
          animation: flowPipe 1s linear infinite;
        }
        .terminal-active [data-henryboot-terminal] .anim-fade {
          opacity: 0;
          animation: fadeIn 1s ease forwards 0.5s;
        }
        .terminal-active [data-henryboot-terminal] .anim-fade-late {
          opacity: 0;
          animation: fadeIn 1s ease forwards 2s;
        }
        .terminal-active [data-henryboot-terminal] .anim-error {
          animation: errorFlash 2s infinite;
        }
        .terminal-active [data-henryboot-terminal] .anim-bar {
          transform-origin: left;
          transform: scaleX(0);
          animation: scaleBar 1s ease-out forwards 2.5s;
        }
        .terminal-inactive [data-henryboot-terminal] * {
          opacity: 0 !important;
        }
      `,
        }}
      />
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice">
        {/* Background Grid */}
        <g stroke="rgba(109, 165, 126, 0.15)" strokeWidth="0.5">
          {Array.from({ length: 40 }).map((_, i) => (
            <line key={`v${i}`} x1={i * 20} y1="0" x2={i * 20} y2="500" strokeDasharray={i % 5 === 0 ? "none" : "2 2"} stroke={i % 5 === 0 ? "rgba(109, 165, 126, 0.25)" : "rgba(109, 165, 126, 0.1)"} />
          ))}
          {Array.from({ length: 25 }).map((_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 20} x2="800" y2={i * 20} strokeDasharray={i % 5 === 0 ? "none" : "2 2"} stroke={i % 5 === 0 ? "rgba(109, 165, 126, 0.25)" : "rgba(109, 165, 126, 0.1)"} />
          ))}
        </g>

        {/* Telemetry Bar */}
        <g className="anim-fade" fontFamily="monospace" fontSize="8" fill="rgba(109, 165, 126, 0.6)">
          <text x="30" y="25">REF: HENRY_BOOT_V_ALSTOM_[2000]_EWCA_CIV_99</text>
          <text x="350" y="25">ASSET: CCGT_POWER_STATION</text>
          <text x="650" y="25" fill="#c1a679">STS: PRICING_ERROR_IN_VARIATION</text>
          <line x1="0" y1="35" x2="800" y2="35" stroke="rgba(109, 165, 126, 0.3)" strokeWidth="1" />
        </g>

        {/* CCGT Schematic */}
        <g transform="translate(60, 100)" className="anim-fade">
          <text x="0" y="0" fill="#6da57e" fontFamily="monospace" fontSize="10" letterSpacing="1">PLANT_SCHEMATIC: CIVIL_WORKS</text>
          
          <rect x="0" y="30" width="80" height="60" fill="rgba(109, 165, 126, 0.05)" stroke="#6da57e" strokeWidth="1" />
          <text x="40" y="65" fill="#6da57e" fontFamily="monospace" fontSize="8" textAnchor="middle">TURBINE</text>

          <rect x="140" y="30" width="80" height="60" fill="rgba(109, 165, 126, 0.05)" stroke="#6da57e" strokeWidth="1" />
          <text x="180" y="65" fill="#6da57e" fontFamily="monospace" fontSize="8" textAnchor="middle">HRSG</text>

          <rect x="280" y="30" width="80" height="60" fill="rgba(109, 165, 126, 0.05)" stroke="#6da57e" strokeWidth="1" />
          <text x="320" y="65" fill="#6da57e" fontFamily="monospace" fontSize="8" textAnchor="middle">CONDENSER</text>

          <path d="M 80 60 L 140 60" stroke="#6da57e" strokeWidth="2" className="anim-flow" />
          <path d="M 220 60 L 280 60" stroke="#6da57e" strokeWidth="2" className="anim-flow" />

          {/* Varied Cold Water Pipework */}
          <path d="M 320 90 L 320 180 L 100 180" fill="none" stroke="#c1a679" strokeWidth="3" className="anim-flow" />
          <rect x="180" y="165" width="80" height="30" className="anim-error" />
          <text x="220" y="183" fill="#c1a679" fontFamily="monospace" fontSize="8" textAnchor="middle">VAR: C_WATER_PIPE</text>
        </g>

        {/* Valuation Ledger */}
        <g transform="translate(60, 320)">
          <text x="0" y="0" fill="#6da57e" fontFamily="monospace" fontSize="10" letterSpacing="1" className="anim-fade">ICE 6TH ED. CLAUSE 52(1) VALUATION</text>
          
          <g className="anim-fade-late">
            <text x="0" y="30" fill="rgba(245, 240, 232, 0.8)" fontFamily="monospace" fontSize="8">ORIGINAL_BOQ_RATE:</text>
            <rect x="150" y="22" width="200" height="10" fill="rgba(109, 165, 126, 0.3)" />
            <text x="360" y="30" fill="rgba(109, 165, 126, 0.8)" fontFamily="monospace" fontSize="8">CONTAINS_PRICING_ERROR</text>

            <text x="0" y="60" fill="rgba(245, 240, 232, 0.8)" fontFamily="monospace" fontSize="8">CONTRACTOR_CLAIM:</text>
            <rect x="150" y="52" width="300" height="10" fill="rgba(193, 166, 121, 0.5)" className="anim-bar" />
            <text x="460" y="60" fill="#c1a679" fontFamily="monospace" fontSize="8" className="anim-fade-late" style={{ animationDelay: '3s' }}>FAILS_TO_ADJUST_FOR_ERROR</text>

            <text x="0" y="90" fill="rgba(245, 240, 232, 0.8)" fontFamily="monospace" fontSize="8">COURT_RULING:</text>
            <rect x="150" y="82" width="180" height="10" fill="#6da57e" className="anim-bar" style={{ animationDelay: '3s' }} />
            <text x="340" y="90" fill="#6da57e" fontFamily="monospace" fontSize="8" className="anim-fade-late" style={{ animationDelay: '3.5s' }}>RATES_MUST_BE_REASONABLY_ADJUSTED</text>
          </g>
        </g>
      </svg>
    </div>
  );
}
