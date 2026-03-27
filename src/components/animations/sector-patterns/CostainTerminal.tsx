"use client";

export function CostainTerminal({ className = "" }: { className?: string }) {
  return (
    <div
      data-costain-terminal
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes drawBorehole {
          from { stroke-dashoffset: 400; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes groundSettle {
          0%   { transform: translateY(0); }
          100% { transform: translateY(15px); }
        }
        @keyframes pulseError {
          0%, 100% { opacity: 0.5; }
          50%      { opacity: 1; fill: #c1a679; }
        }
        .terminal-active [data-costain-terminal] .anim-draw {
          stroke-dasharray: 400;
          stroke-dashoffset: 400;
          animation: drawBorehole 2s ease-out forwards 0.2s;
        }
        .terminal-active [data-costain-terminal] .anim-fade {
          opacity: 0;
          animation: fadeIn 1s ease forwards 1.2s;
        }
        .terminal-active [data-costain-terminal] .anim-settle {
          animation: groundSettle 2s ease-in-out forwards 2s;
        }
        .terminal-active [data-costain-terminal] .anim-error {
          opacity: 0;
          animation: fadeIn 0.5s forwards 2.5s, pulseError 2s infinite 3s;
        }
        .terminal-inactive [data-costain-terminal] * {
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
          <text x="30" y="25">REF: COSTAIN_V_HASWELL_[2009]_EWHC_3140</text>
          <text x="350" y="25">GEOTECH: WATER_TREATMENT_WORKS</text>
          <text x="650" y="25" fill="#c1a679">STS: STRATA_MISINTERPRETED</text>
          <line x1="0" y1="35" x2="800" y2="35" stroke="rgba(109, 165, 126, 0.3)" strokeWidth="1" />
        </g>

        {/* Geological Cross Section */}
        <g transform="translate(100, 100)">
          {/* Surface Line */}
          <path d="M 0 50 L 500 50" stroke="#6da57e" strokeWidth="2" className="anim-draw" />
          
          {/* Strata Layers */}
          <path d="M 0 100 Q 250 120 500 90" fill="none" stroke="rgba(109, 165, 126, 0.4)" strokeWidth="1" strokeDasharray="4 4" className="anim-draw" />
          <path d="M 0 180 Q 200 160 500 200" fill="none" stroke="rgba(109, 165, 126, 0.4)" strokeWidth="1" strokeDasharray="4 4" className="anim-draw" />
          
          {/* Strata Labels */}
          <g className="anim-fade" fontFamily="monospace" fontSize="8" fill="rgba(109, 165, 126, 0.5)">
            <text x="10" y="75">STRATUM_A: MADE_GROUND</text>
            <text x="10" y="140">STRATUM_B: ALLUVIUM (WEAK)</text>
            <text x="10" y="220">STRATUM_C: MUDSTONE_BEDROCK</text>
          </g>

          {/* Borehole Data Log */}
          <g transform="translate(150, 0)">
            <line x1="0" y1="30" x2="0" y2="250" stroke="#6da57e" strokeWidth="1" className="anim-draw" />
            <rect x="-10" y="30" width="20" height="5" fill="#6da57e" className="anim-fade" />
            <text x="15" y="45" fill="rgba(109, 165, 126, 0.8)" fontFamily="monospace" fontSize="7" className="anim-fade">BH_04</text>
            
            {/* The misinterpretation point */}
            <rect x="-4" y="130" width="8" height="40" fill="none" stroke="#c1a679" strokeWidth="1" className="anim-error" />
            <line x1="5" y1="150" x2="100" y2="150" stroke="#c1a679" strokeWidth="1" className="anim-error" />
            
            <g transform="translate(105, 140)" className="anim-error">
              <rect x="0" y="0" width="220" height="40" fill="rgba(11, 59, 36, 0.85)" stroke="#c1a679" strokeWidth="1" />
              <text x="10" y="15" fill="#c1a679" fontFamily="monospace" fontSize="9">DATA_MISINTERPRETATION</text>
              <text x="10" y="28" fill="rgba(245, 240, 232, 0.7)" fontFamily="monospace" fontSize="8">GEOTECHNICAL_CAPACITY_OVERSTATED</text>
            </g>
          </g>

          {/* Failed Ground Treatment / Structure */}
          <g transform="translate(300, 20)">
            <rect x="0" y="0" width="120" height="30" fill="rgba(109, 165, 126, 0.2)" stroke="#6da57e" strokeWidth="1" className="anim-fade" />
            <text x="60" y="18" fill="rgba(245, 240, 232, 0.8)" fontFamily="monospace" fontSize="8" textAnchor="middle" className="anim-fade">WTW_STRUCTURE</text>
            
            {/* Settling animation applied to the structure and ground beneath */}
            <g className="anim-settle">
              <rect x="0" y="30" width="120" height="20" fill="rgba(193, 166, 121, 0.2)" stroke="#c1a679" strokeWidth="1" />
              <text x="60" y="44" fill="#c1a679" fontFamily="monospace" fontSize="7" textAnchor="middle">GROUND_TREATMENT_FAILED</text>
            </g>

            {/* Piled Redesign overlay (Late) */}
            <g className="anim-error">
              <line x1="20" y1="30" x2="20" y2="180" stroke="#6da57e" strokeWidth="3" strokeDasharray="5 2" />
              <line x1="100" y1="30" x2="100" y2="180" stroke="#6da57e" strokeWidth="3" strokeDasharray="5 2" />
              <text x="60" y="175" fill="#6da57e" fontFamily="monospace" fontSize="8" textAnchor="middle">REDESIGN: PILED_FOUNDATION</text>
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
