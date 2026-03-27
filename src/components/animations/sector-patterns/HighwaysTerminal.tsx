"use client";

export function HighwaysTerminal({ className = "" }: { className?: string }) {
  return (
    <div
      data-hwy-terminal
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes hwyDraw {
          from { stroke-dashoffset: 800; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes hwyFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .terminal-active [data-hwy-terminal] .hwy-draw {
          stroke-dasharray: 800;
          stroke-dashoffset: 800;
          animation: hwyDraw 2.5s cubic-bezier(0.4, 0, 0.2, 1) forwards 0.5s;
        }
        .terminal-active [data-hwy-terminal] .hwy-fade {
          opacity: 0;
          animation: hwyFade 1.5s ease forwards 1.2s;
        }
        .terminal-active [data-hwy-terminal] .hwy-fade-late {
          opacity: 0;
          animation: hwyFade 1.5s ease forwards 2s;
        }
        .terminal-inactive [data-hwy-terminal] * {
          opacity: 0 !important;
        }
      `,
        }}
      />
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice">
        <g transform="translate(0, 50)">
        {/* Surface Line */}
        <line x1="0" y1="80" x2="800" y2="80" stroke="#6da57e" strokeWidth="2" className="hwy-draw" />
        <text x="30" y="70" fill="#6da57e" fontFamily="monospace" fontSize="10" letterSpacing="1" className="hwy-fade">DATUM: SURFACE_LEVEL</text>

        {/* Strata Layers */}
        <path d="M 0 160 Q 200 150 400 180 T 800 160" stroke="rgba(109, 165, 126, 0.4)" strokeWidth="1" fill="none" className="hwy-draw" />
        <text x="30" y="150" fill="rgba(109, 165, 126, 0.6)" fontFamily="monospace" fontSize="9" letterSpacing="1" className="hwy-fade">STRATA_A: CLAY/SILT</text>

        <path d="M 0 280 Q 300 320 500 260 T 800 300" stroke="rgba(109, 165, 126, 0.4)" strokeWidth="1" strokeDasharray="4 4" fill="none" className="hwy-draw" style={{ animationDelay: '0.8s' }} />
        <text x="30" y="270" fill="rgba(109, 165, 126, 0.6)" fontFamily="monospace" fontSize="9" letterSpacing="1" className="hwy-fade">STRATA_B: MUDSTONE</text>

        {/* Borehole / Drill Path */}
        <line x1="300" y1="80" x2="300" y2="350" stroke="rgba(109, 165, 126, 0.2)" strokeWidth="20" className="hwy-fade" />
        <line x1="300" y1="80" x2="300" y2="280" stroke="#c1a679" strokeWidth="4" strokeDasharray="8 4" className="hwy-draw" style={{ animationDelay: '1s' }} />
        
        {/* Anomaly Marker */}
        <circle cx="300" cy="280" r="6" fill="#c1a679" className="hwy-fade-late" />
        <circle cx="300" cy="280" r="16" stroke="#c1a679" strokeWidth="1" fill="none" className="hwy-fade-late" />
        <line x1="320" y1="280" x2="400" y2="280" stroke="#c1a679" strokeWidth="1" className="hwy-fade-late" />
        
        {/* Legal Text */}
        <text x="410" y="275" fill="#c1a679" fontFamily="monospace" fontSize="10" letterSpacing="1" className="hwy-fade-late">
          UNFORESEEN_PHYSICAL_CONDITIONS
        </text>
        <text x="410" y="290" fill="#6da57e" fontFamily="monospace" fontSize="9" letterSpacing="1" className="hwy-fade-late">
          ICE_CLAUSE_12 / NEC_60.1(12)
        </text>

        {/* Case Law Box */}
        <rect x="410" y="310" width="320" height="40" fill="rgba(11, 59, 36, 0.5)" stroke="rgba(181, 151, 90, 0.3)" className="hwy-fade-late" />
        <text x="425" y="328" fill="#c1a679" fontFamily="monospace" fontSize="8" letterSpacing="1" className="hwy-fade-late">
          AUTHORITY:
        </text>
        <text x="425" y="340" fill="rgba(245, 240, 232, 0.6)" fontFamily="monospace" fontSize="8" letterSpacing="0.5" className="hwy-fade-late font-serif italic">
          Obrascon Huarte Lain SA v HM Attorney General
        </text>

        </g>
      </svg>
    </div>
  );
}