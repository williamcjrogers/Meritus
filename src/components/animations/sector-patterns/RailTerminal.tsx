"use client";

export function RailTerminal({ className = "" }: { className?: string }) {
  return (
    <div
      data-rail-terminal
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes railDraw {
          from { stroke-dashoffset: 1200; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes railFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes railPulse {
          0%, 100% { opacity: 0.2; transform: scale(0.95); }
          50%      { opacity: 1; transform: scale(1.05); }
        }
        @keyframes railBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .terminal-active [data-rail-terminal] .rail-draw {
          stroke-dasharray: 1200;
          stroke-dashoffset: 1200;
          animation: railDraw 3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards 0.5s;
        }
        .terminal-active [data-rail-terminal] .rail-draw-late {
          stroke-dasharray: 1200;
          stroke-dashoffset: 1200;
          animation: railDraw 2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards 2s;
        }
        .terminal-active [data-rail-terminal] .rail-fade {
          opacity: 0;
          animation: railFade 1.5s ease forwards 1s;
        }
        .terminal-active [data-rail-terminal] .rail-fade-late {
          opacity: 0;
          animation: railFade 1.5s ease forwards 2.5s;
        }
        .terminal-active [data-rail-terminal] .rail-pulse {
          animation: railPulse 2s ease-in-out infinite;
          transform-origin: center;
        }
        .terminal-active [data-rail-terminal] .rail-blink {
          animation: railBlink 2s steps(2) infinite;
        }
        .terminal-inactive [data-rail-terminal] * {
          opacity: 0 !important;
        }
      `,
        }}
      />
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice">
        {/* Background Grid */}
        <g stroke="rgba(109, 165, 126, 0.15)" strokeWidth="0.5">
          {Array.from({ length: 40 }).map((_, i) => (
            <line key={`v${i}`} x1={i * 20} y1="0" x2={i * 20} y2="400" strokeDasharray={i % 5 === 0 ? "none" : "2 2"} stroke={i % 5 === 0 ? "rgba(109, 165, 126, 0.25)" : "rgba(109, 165, 126, 0.1)"} />
          ))}
          {Array.from({ length: 20 }).map((_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 20} x2="800" y2={i * 20} strokeDasharray={i % 5 === 0 ? "none" : "2 2"} stroke={i % 5 === 0 ? "rgba(109, 165, 126, 0.25)" : "rgba(109, 165, 126, 0.1)"} />
          ))}
        </g>

        {/* Top telemetry bar */}
        <g className="rail-fade" fontFamily="monospace" fontSize="8" fill="rgba(109, 165, 126, 0.6)">
          <text x="30" y="25">SYS.ALIGNMENT.TRK_1</text>
          <text x="250" y="25">CHAINAGE: CH 10+000 TO 16+000</text>
          <text x="500" y="25">TOLERANCE: &plusmn;2mm</text>
          <text x="680" y="25" fill="#c1a679" className="rail-blink">STS: CLASH_DETECTED</text>
          <line x1="0" y1="35" x2="800" y2="35" stroke="rgba(109, 165, 126, 0.3)" strokeWidth="1" />
        </g>

        {/* Axis Labels */}
        <g className="rail-fade" fontFamily="monospace" fontSize="8" fill="rgba(109, 165, 126, 0.5)">
          <text x="30" y="380">TIME (WKS) &rarr;</text>
          <text x="680" y="55">CHAINAGE (KM) &rarr;</text>
          <text x="105" y="380">CH 10+00</text>
          <text x="305" y="380">CH 12+00</text>
          <text x="505" y="380">CH 14+00</text>
          <text x="705" y="380">CH 16+00</text>
          <text x="10" y="355">WK 01</text>
          <text x="10" y="255">WK 12</text>
          <text x="10" y="155">WK 24</text>
          <text x="10" y="55">WK 36</text>
        </g>

        {/* Time-Location March Chart */}
        {/* As-Planned Earthworks */}
        <path d="M 100 350 L 600 100" stroke="rgba(109, 165, 126, 0.2)" strokeWidth="16" strokeLinecap="square" className="rail-draw" />
        <text x="130" y="320" fill="rgba(109, 165, 126, 0.6)" fontFamily="monospace" fontSize="9" transform="rotate(-26.5, 100, 350)" className="rail-fade">
          BASELINE: BULK_EARTHWORKS
        </text>

        {/* Actual Earthworks - delayed */}
        <path d="M 100 350 L 300 250 L 450 250 L 700 125" stroke="rgba(109, 165, 126, 0.6)" strokeWidth="6" className="rail-draw" style={{ animationDelay: '0.8s' }} />

        {/* Track Laying As-Planned */}
        <path d="M 100 280 L 460 100" stroke="#c1a679" strokeWidth="1" strokeDasharray="4 4" fill="none" className="rail-draw" style={{ animationDelay: '1s' }} />
        
        {/* Track Laying Actual - Hitting the Earthworks Delay */}
        <path d="M 100 280 L 340 160" stroke="#c1a679" strokeWidth="2" fill="none" className="rail-draw" style={{ animationDelay: '1.2s' }} />
        
        {/* Track Laying Actual - Resuming */}
        <path d="M 450 160 L 520 125" stroke="#c1a679" strokeWidth="2" fill="none" strokeDasharray="2 4" className="rail-draw-late" />

        {/* Delay Delta Vectors */}
        <g className="rail-fade-late" stroke="#c1a679" strokeWidth="0.5" strokeDasharray="2 2">
          <line x1="340" y1="160" x2="450" y2="160" />
          <line x1="450" y1="160" x2="450" y2="250" />
        </g>

        {/* Clash Node */}
        <g style={{ transformOrigin: '340px 160px' }}>
          <circle cx="340" cy="160" r="4" fill="#c1a679" className="rail-fade-late" />
          <circle cx="340" cy="160" r="16" stroke="#c1a679" strokeWidth="1" fill="none" className="rail-pulse rail-fade-late" />
          <circle cx="340" cy="160" r="24" stroke="#c1a679" strokeWidth="0.5" strokeDasharray="2 2" fill="none" className="rail-pulse rail-fade-late" style={{ animationDelay: '0.5s' }} />
        </g>

        {/* Target Reticle at Clash */}
        <g className="rail-fade-late" stroke="#c1a679" strokeWidth="0.5">
          <line x1="310" y1="160" x2="370" y2="160" />
          <line x1="340" y1="130" x2="340" y2="190" />
        </g>

        {/* Clash Callout */}
        <g className="rail-fade-late">
          <path d="M 340 160 L 380 100 L 550 100" stroke="#c1a679" strokeWidth="1" fill="none" />
          <rect x="550" y="70" width="220" height="70" fill="rgba(11, 59, 36, 0.85)" stroke="#c1a679" strokeWidth="1" />
          <text x="560" y="88" fill="#c1a679" fontFamily="monospace" fontSize="10" letterSpacing="1">
            CRITICAL_CLASH: CE-092
          </text>
          <line x1="560" y1="95" x2="760" y2="95" stroke="#c1a679" strokeWidth="0.5" strokeDasharray="2 2" />
          <text x="560" y="110" fill="#6da57e" fontFamily="monospace" fontSize="9" letterSpacing="0.5">
            ACCESS_DENIED // POSSESSION
          </text>
          <text x="560" y="125" fill="rgba(245, 240, 232, 0.6)" fontFamily="monospace" fontSize="8" letterSpacing="0.5">
            DELAY_QUANTIFIED: +42_DAYS
          </text>
        </g>

        {/* Track Schematic at Bottom */}
        <g className="rail-fade">
          <rect x="30" y="330" width="740" height="30" fill="rgba(109, 165, 126, 0.05)" stroke="rgba(109, 165, 126, 0.2)" strokeWidth="1" />
          {/* Rails */}
          <line x1="30" y1="340" x2="770" y2="340" stroke="rgba(109, 165, 126, 0.4)" strokeWidth="1.5" />
          <line x1="30" y1="350" x2="770" y2="350" stroke="rgba(109, 165, 126, 0.4)" strokeWidth="1.5" />
          {/* Sleepers */}
          <line x1="35" y1="345" x2="765" y2="345" stroke="rgba(109, 165, 126, 0.2)" strokeWidth="12" strokeDasharray="3 10" />
          
          {/* Block Section Markers */}
          <circle cx="100" cy="345" r="3" fill="#6da57e" />
          <text x="100" y="325" fill="#6da57e" fontFamily="monospace" fontSize="7" textAnchor="middle">SIG_A1</text>
          
          <circle cx="340" cy="345" r="3" fill="#c1a679" className="rail-blink" />
          <text x="340" y="325" fill="#c1a679" fontFamily="monospace" fontSize="7" textAnchor="middle">SIG_A2 (BLOCK)</text>
          
          <circle cx="600" cy="345" r="3" fill="#6da57e" />
          <text x="600" y="325" fill="#6da57e" fontFamily="monospace" fontSize="7" textAnchor="middle">SIG_A3</text>
        </g>

        {/* Data Stream Box */}
        <g className="rail-fade">
          <rect x="30" y="150" width="160" height="60" fill="rgba(11, 59, 36, 0.5)" stroke="rgba(109, 165, 126, 0.3)" strokeWidth="1" />
          <text x="40" y="165" fill="#6da57e" fontFamily="monospace" fontSize="8">NEC4_ECC_CORE_60.1(2)</text>
          <text x="40" y="180" fill="rgba(245, 240, 232, 0.5)" fontFamily="monospace" fontSize="8">TIA_PROTOCOL_APP_A</text>
          <text x="40" y="195" fill="rgba(245, 240, 232, 0.5)" fontFamily="monospace" fontSize="8">FRAGNET_INSERTED</text>
        </g>

      </svg>
    </div>
  );
}