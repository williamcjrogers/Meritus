"use client";

export function HojgaardTerminal({ className = "" }: { className?: string }) {
  return (
    <div
      data-hojgaard-terminal
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes drawStructure {
          from { stroke-dashoffset: 1000; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes waveMotion {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50px); }
        }
        @keyframes flashEquation {
          0%, 100% { fill: rgba(193, 166, 121, 0.1); stroke: rgba(193, 166, 121, 0.5); }
          50%      { fill: rgba(193, 166, 121, 0.3); stroke: #c1a679; }
        }
        @keyframes failJoint {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(2deg); }
        }
        .terminal-active [data-hojgaard-terminal] .anim-draw {
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation: drawStructure 3s ease-out forwards 0.2s;
        }
        .terminal-active [data-hojgaard-terminal] .anim-fade {
          opacity: 0;
          animation: fadeIn 1s ease forwards 1s;
        }
        .terminal-active [data-hojgaard-terminal] .anim-wave {
          animation: waveMotion 3s linear infinite;
        }
        .terminal-active [data-hojgaard-terminal] .anim-eq {
          animation: flashEquation 1.5s infinite 2s;
        }
        .terminal-active [data-hojgaard-terminal] .anim-fail {
          transform-origin: bottom center;
          animation: failJoint 0.5s ease-in forwards 3s;
        }
        .terminal-inactive [data-hojgaard-terminal] * {
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
          <text x="30" y="25">REF: MT_HOJGAARD_V_E.ON_[2017]_UKSC_59</text>
          <text x="350" y="25">ASSET: OFFSHORE_WIND_MONOPILE</text>
          <text x="650" y="25" fill="#c1a679">STS: FITNESS_FOR_PURPOSE_BREACH</text>
          <line x1="0" y1="35" x2="800" y2="35" stroke="rgba(109, 165, 126, 0.3)" strokeWidth="1" />
        </g>

        {/* Offshore Wind Turbine */}
        <g transform="translate(150, 100)">
          {/* Sea level */}
          <g className="anim-fade" stroke="rgba(109, 165, 126, 0.4)" fill="none" strokeWidth="1">
            <path d="M -100 150 Q -50 140 0 150 T 100 150 T 200 150 T 300 150" className="anim-wave" />
            <path d="M -100 160 Q -50 170 0 160 T 100 160 T 200 160 T 300 160" className="anim-wave" style={{ animationDelay: '0.5s', stroke: 'rgba(109, 165, 126, 0.2)' }} />
          </g>
          <text x="-50" y="145" fill="rgba(109, 165, 126, 0.5)" fontFamily="monospace" fontSize="8" className="anim-fade">WAVE_LOADING</text>

          {/* Seabed */}
          <path d="M -100 300 L 250 300" stroke="#6da57e" strokeWidth="2" className="anim-draw" />

          {/* Monopile foundation (subsea) */}
          <rect x="40" y="220" width="40" height="150" fill="rgba(109, 165, 126, 0.1)" stroke="#6da57e" strokeWidth="1" className="anim-draw" />
          
          {/* Transition Piece / Grouted Connection */}
          <g className="anim-fail">
            <path d="M 35 220 L 85 220 L 75 100 L 45 100 Z" fill="rgba(11, 59, 36, 0.6)" stroke="#6da57e" strokeWidth="1.5" className="anim-draw" />
            <path d="M 50 100 L 50 0 L 70 0 L 70 100" fill="none" stroke="#6da57e" strokeWidth="1" className="anim-draw" />
            
            {/* The Grouted Joint failure indicator */}
            <circle cx="60" cy="220" r="10" stroke="#c1a679" strokeWidth="1" fill="none" className="anim-fade" style={{ animationDelay: '2.5s' }} />
          </g>

          <g className="anim-fade" style={{ animationDelay: '2.5s' }}>
            <line x1="70" y1="220" x2="150" y2="200" stroke="#c1a679" strokeWidth="1" />
            <text x="155" y="195" fill="#c1a679" fontFamily="monospace" fontSize="8">GROUTED_CONNECTION_FAILURE</text>
          </g>
        </g>

        {/* Legal & Mathematical Analysis */}
        <g transform="translate(420, 100)">
          <text x="0" y="0" fill="#6da57e" fontFamily="monospace" fontSize="10" letterSpacing="1" className="anim-fade">CONTRACTUAL_OBLIGATIONS</text>
          
          <rect x="0" y="20" width="300" height="50" fill="rgba(109, 165, 126, 0.05)" stroke="#6da57e" strokeWidth="1" className="anim-fade" />
          <text x="10" y="35" fill="rgba(245, 240, 232, 0.8)" fontFamily="monospace" fontSize="8" className="anim-fade">OBLIGATION_1: COMPLY_WITH_J101_STANDARD</text>
          
          <rect x="0" y="80" width="300" height="50" fill="rgba(11, 59, 36, 0.6)" stroke="#c1a679" strokeWidth="1" className="anim-fade" />
          <text x="10" y="95" fill="#c1a679" fontFamily="monospace" fontSize="8" className="anim-fade">OBLIGATION_2: 20_YEAR_DESIGN_LIFE (FFP)</text>

          {/* The Equation Error */}
          <g className="anim-fade" style={{ animationDelay: '1.5s' }} transform="translate(0, 160)">
            <text x="0" y="0" fill="rgba(109, 165, 126, 0.8)" fontFamily="monospace" fontSize="8">J101_CALCULATION:</text>
            <rect x="0" y="10" width="180" height="30" className="anim-eq" />
            <text x="10" y="30" fill="rgba(245, 240, 232, 0.9)" fontFamily="monospace" fontSize="10">δ = (F × L³) / (3 × E × I) × 10</text>
            <text x="190" y="30" fill="#c1a679" fontFamily="monospace" fontSize="8">← TENFOLD_ERROR</text>
          </g>

          {/* The Supreme Court Ruling */}
          <g className="anim-fade" style={{ animationDelay: '3s' }} transform="translate(0, 230)">
            <rect x="0" y="0" width="350" height="40" fill="none" stroke="#6da57e" strokeWidth="0.5" strokeDasharray="2 2" />
            <text x="10" y="15" fill="rgba(245, 240, 232, 0.9)" fontFamily="monospace" fontSize="8">SUPREME_COURT_RULING:</text>
            <text x="10" y="30" fill="#6da57e" fontFamily="monospace" fontSize="8">"Fitness for purpose warranty takes precedence</text>
            <text x="10" y="42" fill="#6da57e" fontFamily="monospace" fontSize="8">over compliance with flawed design standard."</text>
          </g>
        </g>
      </svg>
    </div>
  );
}
