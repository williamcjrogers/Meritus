"use client";

export function MurphyTerminal({ className = "" }: { className?: string }) {
  return (
    <div
      data-murphy-terminal
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes drawLine {
          from { stroke-dashoffset: 1000; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes pulseAlert {
          0%, 100% { opacity: 0.2; transform: scale(0.95); }
          50%      { opacity: 1; transform: scale(1.1); }
        }
        @keyframes crackPropagate {
          0% { stroke-dasharray: 0, 1000; }
          100% { stroke-dasharray: 1000, 0; }
        }
        @keyframes severLink {
          0% { stroke-dashoffset: 0; opacity: 1; }
          100% { stroke-dashoffset: 50; opacity: 0; }
        }
        .terminal-active [data-murphy-terminal] .anim-draw {
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation: drawLine 2.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards 0.3s;
        }
        .terminal-active [data-murphy-terminal] .anim-draw-late {
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation: drawLine 2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards 1.5s;
        }
        .terminal-active [data-murphy-terminal] .anim-fade {
          opacity: 0;
          animation: fadeIn 1s ease forwards 1.2s;
        }
        .terminal-active [data-murphy-terminal] .anim-fade-late {
          opacity: 0;
          animation: fadeIn 1s ease forwards 2.5s;
        }
        .terminal-active [data-murphy-terminal] .anim-crack {
          stroke-dasharray: 0, 1000;
          animation: crackPropagate 1s ease-out forwards 2s;
        }
        .terminal-active [data-murphy-terminal] .anim-pulse {
          animation: pulseAlert 2s infinite ease-in-out;
          transform-origin: center;
        }
        .terminal-active [data-murphy-terminal] .anim-sever {
          stroke-dasharray: 10 5;
          animation: severLink 0.5s forwards 3s;
        }
        .terminal-inactive [data-murphy-terminal] * {
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
          <text x="30" y="25">REF: MURPHY_V_BRENTWOOD_[1991]_1_AC_398</text>
          <text x="350" y="25">STRUCTURAL: RAFT_FOUNDATION_DIAGNOSTICS</text>
          <text x="650" y="25" fill="#c1a679" className="anim-pulse">STS: PURE_ECONOMIC_LOSS</text>
          <line x1="0" y1="35" x2="800" y2="35" stroke="rgba(109, 165, 126, 0.3)" strokeWidth="1" />
        </g>

        {/* House Cross-Section */}
        <g transform="translate(100, 150)">
          {/* Ground/Soil Strata */}
          <path d="M 0 160 L 300 160 L 300 250 L 0 250 Z" fill="rgba(109, 165, 126, 0.05)" stroke="rgba(109, 165, 126, 0.2)" strokeWidth="1" className="anim-draw" />
          <path d="M 0 190 Q 150 180 300 200" stroke="rgba(109, 165, 126, 0.3)" strokeDasharray="4 4" fill="none" className="anim-draw-late" />
          <text x="10" y="240" fill="rgba(109, 165, 126, 0.5)" fontFamily="monospace" fontSize="8" className="anim-fade">SOIL_STRATA: INADEQUATE_BEARING_CAPACITY</text>
          
          {/* Raft Foundation */}
          <path d="M 40 140 L 260 140 L 260 160 L 40 160 Z" fill="rgba(11, 59, 36, 0.6)" stroke="#6da57e" strokeWidth="1.5" className="anim-draw" />
          
          {/* Superstructure (House) */}
          <path d="M 60 140 L 60 60 L 150 20 L 240 60 L 240 140" fill="none" stroke="#6da57e" strokeWidth="1" strokeDasharray="3 3" className="anim-draw" />
          <line x1="60" y1="60" x2="240" y2="60" stroke="#6da57e" strokeWidth="0.5" strokeDasharray="2 2" className="anim-draw" />
          <line x1="150" y1="20" x2="150" y2="140" stroke="#6da57e" strokeWidth="0.5" strokeDasharray="2 2" className="anim-draw" />

          {/* Crack in Foundation */}
          <path d="M 150 160 L 145 152 L 152 147 L 148 140" stroke="#c1a679" strokeWidth="2" fill="none" className="anim-crack" />
          <path d="M 148 140 L 140 100 L 145 60 L 130 30" stroke="#c1a679" strokeWidth="1" strokeDasharray="2 2" fill="none" className="anim-crack" />
          
          {/* Crack Callout */}
          <g className="anim-fade-late">
            <circle cx="150" cy="160" r="5" fill="none" stroke="#c1a679" strokeWidth="1" className="anim-pulse" />
            <line x1="150" y1="160" x2="200" y2="210" stroke="#c1a679" strokeWidth="1" />
            <line x1="200" y1="210" x2="350" y2="210" stroke="#c1a679" strokeWidth="1" />
            <rect x="360" y="195" width="220" height="40" fill="rgba(11, 59, 36, 0.85)" stroke="#c1a679" strokeWidth="1" />
            <text x="370" y="210" fill="#c1a679" fontFamily="monospace" fontSize="9">DEFECT: FOUNDATION_SUBSIDENCE</text>
            <text x="370" y="225" fill="rgba(245, 240, 232, 0.7)" fontFamily="monospace" fontSize="8">LOSS: PURE_ECONOMIC (PROPERTY_VALUE)</text>
          </g>
        </g>

        {/* Liability Chain Diagram */}
        <g transform="translate(480, 80)" className="anim-fade">
          <text x="0" y="0" fill="#6da57e" fontFamily="monospace" fontSize="10" letterSpacing="1">LIABILITY_CHAIN</text>
          
          {/* Nodes */}
          <rect x="0" y="20" width="80" height="25" fill="none" stroke="#6da57e" strokeWidth="1" />
          <text x="40" y="36" fill="rgba(245, 240, 232, 0.8)" fontFamily="monospace" fontSize="8" textAnchor="middle">HOMEOWNER</text>

          <rect x="120" y="20" width="80" height="25" fill="none" stroke="#6da57e" strokeWidth="1" />
          <text x="160" y="36" fill="rgba(245, 240, 232, 0.8)" fontFamily="monospace" fontSize="8" textAnchor="middle">COUNCIL</text>

          <rect x="240" y="20" width="80" height="25" fill="none" stroke="#6da57e" strokeWidth="1" />
          <text x="280" y="36" fill="rgba(245, 240, 232, 0.8)" fontFamily="monospace" fontSize="8" textAnchor="middle">BUILDER</text>

          {/* Links */}
          <line x1="80" y1="32.5" x2="120" y2="32.5" stroke="#c1a679" strokeWidth="1.5" className="anim-sever" />
          <path d="M 95 25 L 105 40" stroke="#c1a679" strokeWidth="1.5" className="anim-fade-late" />
          <path d="M 105 25 L 95 40" stroke="#c1a679" strokeWidth="1.5" className="anim-fade-late" />
          
          <line x1="200" y1="32.5" x2="240" y2="32.5" stroke="#6da57e" strokeWidth="1.5" />

          {/* Legal Ruling Text */}
          <g className="anim-fade-late">
            <line x1="0" y1="60" x2="320" y2="60" stroke="#c1a679" strokeWidth="0.5" strokeDasharray="2 2" />
            <text x="0" y="75" fill="#c1a679" fontFamily="monospace" fontSize="9">RULING: NO_DUTY_OF_CARE</text>
            <text x="0" y="90" fill="rgba(109, 165, 126, 0.8)" fontFamily="monospace" fontSize="8">"A local authority does not owe a</text>
            <text x="0" y="105" fill="rgba(109, 165, 126, 0.8)" fontFamily="monospace" fontSize="8">duty of care to a building owner</text>
            <text x="0" y="120" fill="rgba(109, 165, 126, 0.8)" fontFamily="monospace" fontSize="8">to avoid economic loss..."</text>
            <text x="0" y="140" fill="rgba(245, 240, 232, 0.5)" fontFamily="monospace" fontSize="8">[OVERRULES: ANNS_V_MERTON]</text>
          </g>
        </g>
      </svg>
    </div>
  );
}
