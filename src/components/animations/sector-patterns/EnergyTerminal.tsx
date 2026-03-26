"use client";

export function EnergyTerminal({ className = "" }: { className?: string }) {
  return (
    <div
      data-nrg-terminal
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes nrgDraw {
          from { stroke-dashoffset: 1200; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes nrgFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .terminal-active [data-nrg-terminal] .nrg-draw {
          stroke-dasharray: 1200;
          stroke-dashoffset: 1200;
          animation: nrgDraw 3s cubic-bezier(0.4, 0, 0.2, 1) forwards 0.5s;
        }
        .terminal-active [data-nrg-terminal] .nrg-fade {
          opacity: 0;
          animation: nrgFade 1.5s ease forwards 1.5s;
        }
        .terminal-active [data-nrg-terminal] .nrg-fade-late {
          opacity: 0;
          animation: nrgFade 1.5s ease forwards 2.5s;
        }
        .terminal-inactive [data-nrg-terminal] * { opacity: 0 !important; }
      `,
        }}
      />
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice">
        {/* Axes */}
        <line x1="50" y1="350" x2="750" y2="350" stroke="rgba(109, 165, 126, 0.5)" strokeWidth="1" className="nrg-fade" />
        <line x1="50" y1="50" x2="50" y2="350" stroke="rgba(109, 165, 126, 0.5)" strokeWidth="1" className="nrg-fade" />

        {/* Expected Performance Curve */}
        <path d="M 50 350 C 200 350, 300 100, 750 100" stroke="rgba(109, 165, 126, 0.3)" strokeWidth="2" strokeDasharray="4 4" fill="none" className="nrg-draw" />
        <text x="600" y="90" fill="rgba(109, 165, 126, 0.6)" fontFamily="monospace" fontSize="9" className="nrg-fade">EXPECTED_OUTPUT (MW)</text>

        {/* Actual Performance Curve (drops off) */}
        <path d="M 50 350 C 200 350, 300 150, 450 150 C 550 150, 600 250, 750 250" stroke="#c1a679" strokeWidth="2" fill="none" className="nrg-draw" style={{ animationDelay: '1s' }} />
        <text x="600" y="270" fill="#c1a679" fontFamily="monospace" fontSize="9" className="nrg-fade-late">ACTUAL_OUTPUT: DEFICIT</text>

        {/* Highlight Difference */}
        <g className="nrg-fade-late">
          <line x1="600" y1="100" x2="600" y2="250" stroke="#c1a679" strokeWidth="1" strokeDasharray="2 2" />
          <polygon points="597,105 600,100 603,105" fill="#c1a679" />
          <polygon points="597,245 600,250 603,245" fill="#c1a679" />
          <text x="610" y="180" fill="#c1a679" fontFamily="monospace" fontSize="10">PERFORMANCE_LDs_TRIGGERED</text>
        </g>

        {/* Contract references */}
        <g className="nrg-fade-late">
          <rect x="80" y="80" width="280" height="60" fill="rgba(11, 59, 36, 0.5)" stroke="rgba(109, 165, 126, 0.2)" />
          <text x="95" y="100" fill="#6da57e" fontFamily="monospace" fontSize="9" letterSpacing="1">
            FIDIC_YELLOW_BOOK_CL_9
          </text>
          <text x="95" y="115" fill="#6da57e" fontFamily="monospace" fontSize="9" letterSpacing="1">
            TESTING_ON_COMPLETION
          </text>
          <text x="95" y="130" fill="rgba(245, 240, 232, 0.4)" fontFamily="serif" fontSize="9" fontStyle="italic">
            Ref: MT Højgaard v E.ON Climate
          </text>
        </g>
      </svg>
    </div>
  );
}