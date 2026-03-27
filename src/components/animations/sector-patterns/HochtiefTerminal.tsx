"use client";

export function HochtiefTerminal({ className = "" }: { className?: string }) {
  return (
    <div
      data-hochtief-terminal
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes drawStructure {
          from { stroke-dashoffset: 1500; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes loadPath {
          from { stroke-dashoffset: 200; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes flashWarning {
          0%, 100% { opacity: 0.3; fill: rgba(193, 166, 121, 0.2); }
          50%      { opacity: 1; fill: #c1a679; }
        }
        .terminal-active [data-hochtief-terminal] .anim-draw {
          stroke-dasharray: 1500;
          stroke-dashoffset: 1500;
          animation: drawStructure 3s ease-out forwards 0.2s;
        }
        .terminal-active [data-hochtief-terminal] .anim-fade {
          opacity: 0;
          animation: fadeIn 1s ease forwards 1.2s;
        }
        .terminal-active [data-hochtief-terminal] .anim-load {
          stroke-dasharray: 5 5;
          animation: loadPath 2s linear infinite;
        }
        .terminal-active [data-hochtief-terminal] .anim-warning {
          opacity: 0;
          animation: fadeIn 0.5s forwards 2.5s, flashWarning 1.5s infinite 3s;
        }
        .terminal-inactive [data-hochtief-terminal] * {
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
          <text x="30" y="25">REF: HOCHTIEF_V_ATKINS_[2019]_EWHC_2109</text>
          <text x="350" y="25">STRUCTURAL: BRIDGE_OVER_RAILWAY</text>
          <text x="650" y="25" fill="#c1a679">STS: DESIGN_NEGLIGENCE</text>
          <line x1="0" y1="35" x2="800" y2="35" stroke="rgba(109, 165, 126, 0.3)" strokeWidth="1" />
        </g>

        {/* Bridge Structural Cross-Section */}
        <g transform="translate(100, 150)">
          {/* Ground & Railway below */}
          <path d="M 0 150 L 150 150 L 180 180 L 380 180 L 410 150 L 500 150" fill="none" stroke="rgba(109, 165, 126, 0.3)" strokeWidth="2" className="anim-draw" />
          <line x1="240" y1="180" x2="320" y2="180" stroke="rgba(109, 165, 126, 0.4)" strokeWidth="4" strokeDasharray="10 5" className="anim-fade" />
          <text x="280" y="200" fill="rgba(109, 165, 126, 0.5)" fontFamily="monospace" fontSize="8" textAnchor="middle" className="anim-fade">LIVE_RAILWAY_TRACK</text>

          {/* Abutments and Central Pier */}
          <rect x="50" y="80" width="40" height="70" fill="rgba(109, 165, 126, 0.1)" stroke="#6da57e" strokeWidth="1" className="anim-draw" />
          <rect x="260" y="80" width="40" height="100" fill="rgba(109, 165, 126, 0.1)" stroke="#6da57e" strokeWidth="1" className="anim-draw" />
          <rect x="410" y="80" width="40" height="70" fill="rgba(109, 165, 126, 0.1)" stroke="#6da57e" strokeWidth="1" className="anim-draw" />

          {/* Two-Span Steel/Concrete Composite Deck */}
          <path d="M 40 60 L 460 60 L 460 80 L 40 80 Z" fill="rgba(11, 59, 36, 0.8)" stroke="#6da57e" strokeWidth="1.5" className="anim-draw" />
          
          {/* Deck structural webbing */}
          {Array.from({ length: 20 }).map((_, i) => (
            <line key={`w${i}`} x1={50 + i * 20} y1="60" x2={60 + i * 20} y2="80" stroke="#6da57e" strokeWidth="0.5" className="anim-draw" />
          ))}

          {/* Load Paths (Animated) */}
          <g stroke="rgba(109, 165, 126, 0.6)" strokeWidth="1.5" fill="none" className="anim-fade">
            <path d="M 160 40 Q 160 60 70 80" className="anim-load" />
            <path d="M 160 40 Q 160 60 280 80" className="anim-load" />
            <path d="M 360 40 Q 360 60 280 80" className="anim-load" />
            <path d="M 360 40 Q 360 60 430 80" className="anim-load" />
          </g>

          {/* The Design Failure Point (Central Pier Connection) */}
          <g transform="translate(280, 80)">
            <circle cx="0" cy="0" r="15" stroke="#c1a679" strokeWidth="1.5" fill="none" className="anim-warning" />
            <circle cx="0" cy="0" r="2" fill="#c1a679" className="anim-warning" />
            <line x1="10" y1="-10" x2="80" y2="-60" stroke="#c1a679" strokeWidth="1" className="anim-warning" />
            
            <g className="anim-warning" transform="translate(85, -75)">
              <rect x="0" y="0" width="180" height="50" fill="rgba(11, 59, 36, 0.85)" stroke="#c1a679" strokeWidth="1" />
              <text x="10" y="15" fill="#c1a679" fontFamily="monospace" fontSize="9">CRITICAL_NODE_FAILURE</text>
              <text x="10" y="28" fill="rgba(245, 240, 232, 0.7)" fontFamily="monospace" fontSize="8">NEGLIGENT_STRUCTURAL_DESIGN</text>
              <text x="10" y="40" fill="rgba(245, 240, 232, 0.7)" fontFamily="monospace" fontSize="8">TOLERANCE_EXCEEDED</text>
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
