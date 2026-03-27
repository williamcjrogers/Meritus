"use client";

export function URSTerminal({ className = "" }: { className?: string }) {
  return (
    <div
      data-urs-terminal
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes drawGrid {
          from { stroke-dashoffset: 2000; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes scanDown {
          0%   { transform: translateY(0); }
          50%  { transform: translateY(180px); }
          100% { transform: translateY(0); }
        }
        @keyframes flashRed {
          0%, 100% { fill: rgba(193, 166, 121, 0.2); }
          50%      { fill: #c1a679; }
        }
        @keyframes timelineExtend {
          from { stroke-dasharray: 0, 500; }
          to   { stroke-dasharray: 500, 0; }
        }
        .terminal-active [data-urs-terminal] .anim-draw {
          stroke-dasharray: 2000;
          stroke-dashoffset: 2000;
          animation: drawGrid 3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards 0.2s;
        }
        .terminal-active [data-urs-terminal] .anim-fade {
          opacity: 0;
          animation: fadeIn 1s ease forwards 1.5s;
        }
        .terminal-active [data-urs-terminal] .anim-fade-late {
          opacity: 0;
          animation: fadeIn 1s ease forwards 2.5s;
        }
        .terminal-active [data-urs-terminal] .anim-scan {
          animation: scanDown 4s ease-in-out infinite 1s;
        }
        .terminal-active [data-urs-terminal] .anim-defect {
          animation: flashRed 1.5s infinite;
        }
        .terminal-active [data-urs-terminal] .anim-timeline {
          stroke-dasharray: 0, 500;
          animation: timelineExtend 1.5s ease-out forwards 2s;
        }
        .terminal-inactive [data-urs-terminal] * {
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
          <text x="30" y="25">REF: URS_CORP_V_BDW_TRADING_[2025]_UKSC_21</text>
          <text x="350" y="25">REGIME: BUILDING_SAFETY_ACT_2022</text>
          <text x="650" y="25" fill="#c1a679">STS: RETROSPECTIVE_LIABILITY</text>
          <line x1="0" y1="35" x2="800" y2="35" stroke="rgba(109, 165, 126, 0.3)" strokeWidth="1" />
        </g>

        {/* High Rise Cladding Section */}
        <g transform="translate(60, 80)">
          {/* Concrete Core */}
          <rect x="0" y="0" width="80" height="250" fill="rgba(109, 165, 126, 0.05)" stroke="#6da57e" strokeWidth="1" className="anim-draw" />
          
          {/* Floors */}
          {Array.from({ length: 10 }).map((_, i) => (
            <line key={`f${i}`} x1="0" y1={i * 25} x2="120" y2={i * 25} stroke="#6da57e" strokeWidth="0.5" strokeDasharray="2 2" className="anim-draw" />
          ))}

          {/* Cladding System */}
          <path d="M 80 0 L 100 0 L 100 250 L 80 250" fill="none" stroke="#6da57e" strokeWidth="1" className="anim-draw" />
          
          {/* Defective Insulation Panels */}
          {Array.from({ length: 10 }).map((_, i) => (
            <rect 
              key={`p${i}`} 
              x="82" 
              y={i * 25 + 2} 
              width="16" 
              height="21" 
              className={i === 4 || i === 7 ? "anim-defect" : "anim-fade"} 
              fill="rgba(109, 165, 126, 0.2)"
            />
          ))}

          {/* Scanner */}
          <g className="anim-scan">
            <line x1="-10" y1="0" x2="130" y2="0" stroke="#c1a679" strokeWidth="1" />
            <polygon points="-10,0 -5,-5 -5,5" fill="#c1a679" />
          </g>
          
          {/* Callout */}
          <g className="anim-fade-late">
            <line x1="100" y1="112" x2="140" y2="112" stroke="#c1a679" strokeWidth="1" />
            <line x1="140" y1="112" x2="160" y2="90" stroke="#c1a679" strokeWidth="1" />
            <text x="165" y="85" fill="#c1a679" fontFamily="monospace" fontSize="8">STRUCTURAL_DESIGN_DEFECT</text>
            <text x="165" y="95" fill="rgba(245, 240, 232, 0.6)" fontFamily="monospace" fontSize="7">VOLUNTARY_REMEDIATION_REQUIRED</text>
          </g>
        </g>

        {/* Retrospective Timeline */}
        <g transform="translate(60, 360)">
          <text x="0" y="0" fill="#6da57e" fontFamily="monospace" fontSize="10" letterSpacing="1" className="anim-fade">BSA s.135: EXTENDED LIMITATION PERIOD</text>
          
          {/* Timeline Axis */}
          <line x1="0" y1="20" x2="600" y2="20" stroke="rgba(109, 165, 126, 0.3)" strokeWidth="1" />
          <path d="M 600 20 L 0 20" stroke="#c1a679" strokeWidth="2" fill="none" className="anim-timeline" />
          
          {/* Years */}
          <g className="anim-fade" fontFamily="monospace" fontSize="8" fill="rgba(109, 165, 126, 0.8)">
            <line x1="0" y1="15" x2="0" y2="25" stroke="#6da57e" strokeWidth="1" />
            <text x="0" y="35" textAnchor="middle">1992</text>
            
            <line x1="200" y1="15" x2="200" y2="25" stroke="#6da57e" strokeWidth="1" />
            <text x="200" y="35" textAnchor="middle">2002</text>
            
            <line x1="400" y1="15" x2="400" y2="25" stroke="#6da57e" strokeWidth="1" />
            <text x="400" y="35" textAnchor="middle">2012</text>
            
            <line x1="600" y1="15" x2="600" y2="25" stroke="#6da57e" strokeWidth="1" />
            <text x="600" y="35" textAnchor="middle">2022 (BSA)</text>
          </g>

          <g className="anim-fade-late">
            <rect x="0" y="-30" width="100" height="15" fill="rgba(193, 166, 121, 0.1)" stroke="#c1a679" strokeWidth="0.5" />
            <text x="5" y="-20" fill="#c1a679" fontFamily="monospace" fontSize="7">30_YEAR_REACH_BACK</text>
            <path d="M 50 -15 L 50 15" stroke="#c1a679" strokeWidth="1" strokeDasharray="2 2" />
          </g>
        </g>

        {/* Liability / Recovery Flow */}
        <g transform="translate(480, 100)">
          <rect x="0" y="0" width="220" height="120" fill="rgba(11, 59, 36, 0.4)" stroke="rgba(109, 165, 126, 0.3)" strokeWidth="1" className="anim-fade" />
          <text x="10" y="20" fill="#6da57e" fontFamily="monospace" fontSize="9" className="anim-fade">LIABILITY & RECOVERY</text>
          
          <rect x="20" y="40" width="70" height="30" fill="rgba(109, 165, 126, 0.1)" stroke="#6da57e" strokeWidth="1" className="anim-fade" />
          <text x="55" y="58" fill="rgba(245, 240, 232, 0.9)" fontFamily="monospace" fontSize="8" textAnchor="middle" className="anim-fade">DEVELOPER</text>

          <rect x="130" y="40" width="70" height="30" fill="rgba(109, 165, 126, 0.1)" stroke="#6da57e" strokeWidth="1" className="anim-fade" />
          <text x="165" y="58" fill="rgba(245, 240, 232, 0.9)" fontFamily="monospace" fontSize="8" textAnchor="middle" className="anim-fade">DESIGNER</text>

          <g className="anim-fade-late">
            {/* Recovery arrow flowing backward from Dev to Designer */}
            <path d="M 95 55 L 125 55" stroke="#c1a679" strokeWidth="1.5" />
            <polygon points="125,55 120,52 120,58" fill="#c1a679" />
            <text x="110" y="48" fill="#c1a679" fontFamily="monospace" fontSize="7" textAnchor="middle">RECOVERY</text>
            
            <text x="10" y="90" fill="rgba(245, 240, 232, 0.7)" fontFamily="monospace" fontSize="7">"No requirement for prior 3rd party claim</text>
            <text x="10" y="102" fill="rgba(245, 240, 232, 0.7)" fontFamily="monospace" fontSize="7">to recover voluntary remediation costs"</text>
          </g>
        </g>
      </svg>
    </div>
  );
}
