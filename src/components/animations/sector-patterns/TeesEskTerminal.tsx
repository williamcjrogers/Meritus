"use client";

export function TeesEskTerminal({ className = "" }: { className?: string }) {
  return (
    <div
      data-tees-terminal
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes tracePlan {
          from { stroke-dashoffset: 3000; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes blinkDefect {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%      { opacity: 1; transform: scale(1.2); }
        }
        @keyframes dashFlow {
          from { stroke-dashoffset: 20; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes strikeLine {
          from { stroke-dasharray: 0, 200; }
          to   { stroke-dasharray: 200, 0; }
        }
        .terminal-active [data-tees-terminal] .anim-draw {
          stroke-dasharray: 3000;
          stroke-dashoffset: 3000;
          animation: tracePlan 3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards 0.2s;
        }
        .terminal-active [data-tees-terminal] .anim-fade {
          opacity: 0;
          animation: fadeIn 1s ease forwards 1s;
        }
        .terminal-active [data-tees-terminal] .anim-fade-late {
          opacity: 0;
          animation: fadeIn 1s ease forwards 2s;
        }
        .terminal-active [data-tees-terminal] .anim-defect {
          opacity: 0;
          animation: fadeIn 0.5s ease forwards 2s, blinkDefect 2s infinite ease-in-out 2.5s;
          transform-origin: center;
        }
        .terminal-active [data-tees-terminal] .anim-flow {
          stroke-dasharray: 4 4;
          animation: dashFlow 1s linear infinite;
        }
        .terminal-active [data-tees-terminal] .anim-strike {
          stroke-dasharray: 0, 200;
          animation: strikeLine 0.5s ease forwards 3s;
        }
        .terminal-inactive [data-tees-terminal] * {
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
          <text x="30" y="25">REF: TEES_ESK_NHS_V_THREE_VALLEYS_[2018]_EWHC_1659</text>
          <text x="350" y="25">FACILITY: 365_BED_MENTAL_HEALTH_UNIT</text>
          <text x="620" y="25" fill="#c1a679">STS: PFI_TERMINATED</text>
          <line x1="0" y1="35" x2="800" y2="35" stroke="rgba(109, 165, 126, 0.3)" strokeWidth="1" />
        </g>

        {/* Hospital Floor Plan / Schematic */}
        <g transform="translate(60, 100)">
          {/* Main blocks */}
          <path d="M 0 0 L 120 0 L 120 60 L 250 60 L 250 200 L 150 200 L 150 140 L 0 140 Z" fill="rgba(109, 165, 126, 0.05)" stroke="#6da57e" strokeWidth="1" className="anim-draw" />
          
          {/* Internal corridors */}
          <path d="M 60 0 L 60 140" stroke="rgba(109, 165, 126, 0.3)" strokeWidth="1" strokeDasharray="4 2" className="anim-draw" />
          <path d="M 120 100 L 250 100" stroke="rgba(109, 165, 126, 0.3)" strokeWidth="1" strokeDasharray="4 2" className="anim-draw" />
          
          {/* Defect Markers */}
          <g transform="translate(30, 40)" className="anim-defect">
            <circle cx="0" cy="0" r="6" fill="rgba(193, 166, 121, 0.2)" stroke="#c1a679" strokeWidth="1" />
            <circle cx="0" cy="0" r="2" fill="#c1a679" />
            <text x="12" y="3" fill="#c1a679" fontFamily="monospace" fontSize="8">ROOF_DEFECT</text>
          </g>

          <g transform="translate(200, 80)" className="anim-defect" style={{ animationDelay: '2.2s' }}>
            <circle cx="0" cy="0" r="6" fill="rgba(193, 166, 121, 0.2)" stroke="#c1a679" strokeWidth="1" />
            <circle cx="0" cy="0" r="2" fill="#c1a679" />
            <text x="12" y="3" fill="#c1a679" fontFamily="monospace" fontSize="8">FIRE_SAFETY</text>
          </g>

          <g transform="translate(180, 160)" className="anim-defect" style={{ animationDelay: '2.4s' }}>
            <circle cx="0" cy="0" r="6" fill="rgba(193, 166, 121, 0.2)" stroke="#c1a679" strokeWidth="1" />
            <circle cx="0" cy="0" r="2" fill="#c1a679" />
            <text x="12" y="3" fill="#c1a679" fontFamily="monospace" fontSize="8">PLUMBING</text>
          </g>

          {/* Diagnostic Overlay */}
          <rect x="0" y="220" width="250" height="50" fill="none" stroke="rgba(109, 165, 126, 0.3)" strokeWidth="1" className="anim-fade" />
          <text x="10" y="235" fill="rgba(109, 165, 126, 0.8)" fontFamily="monospace" fontSize="8" className="anim-fade">DEFECT_ANALYSIS_SCAN</text>
          <text x="10" y="250" fill="#c1a679" fontFamily="monospace" fontSize="8" className="anim-fade-late">SEVERE_COMPARTMENTATION_FAILURE</text>
          <text x="10" y="260" fill="#c1a679" fontFamily="monospace" fontSize="8" className="anim-fade-late">BUILDING_REGULATIONS_NON_COMPLIANT</text>
        </g>

        {/* PFI Contract Structure Diagram */}
        <g transform="translate(420, 100)">
          <text x="0" y="0" fill="#6da57e" fontFamily="monospace" fontSize="10" letterSpacing="1" className="anim-fade">PFI_CONTRACT_ARCHITECTURE</text>
          
          {/* Trust Node */}
          <rect x="100" y="30" width="120" height="30" fill="rgba(109, 165, 126, 0.1)" stroke="#6da57e" strokeWidth="1" className="anim-fade" />
          <text x="160" y="48" fill="rgba(245, 240, 232, 0.9)" fontFamily="monospace" fontSize="9" textAnchor="middle" className="anim-fade">NHS_TRUST</text>

          {/* Lines */}
          <line x1="160" y1="60" x2="160" y2="100" stroke="#6da57e" strokeWidth="1.5" className="anim-fade" />
          <path d="M 160 80 L 260 80 L 260 100" stroke="#6da57e" strokeWidth="1" className="anim-fade" />

          {/* SPV Node */}
          <rect x="100" y="100" width="120" height="30" fill="rgba(11, 59, 36, 0.6)" stroke="#6da57e" strokeWidth="1" className="anim-fade" />
          <text x="160" y="118" fill="rgba(245, 240, 232, 0.9)" fontFamily="monospace" fontSize="9" textAnchor="middle" className="anim-fade">PROJECT_CO (SPV)</text>

          {/* Funder Node */}
          <rect x="220" y="100" width="80" height="30" fill="none" stroke="#6da57e" strokeWidth="1" strokeDasharray="2 2" className="anim-fade" />
          <text x="260" y="118" fill="rgba(109, 165, 126, 0.8)" fontFamily="monospace" fontSize="8" textAnchor="middle" className="anim-fade">FUNDERS</text>

          {/* Flow to Contractor */}
          <line x1="160" y1="130" x2="160" y2="170" stroke="#6da57e" strokeWidth="1.5" className="anim-fade" />

          {/* Contractor Node */}
          <rect x="100" y="170" width="120" height="30" fill="rgba(109, 165, 126, 0.1)" stroke="#6da57e" strokeWidth="1" className="anim-fade" />
          <text x="160" y="188" fill="rgba(245, 240, 232, 0.9)" fontFamily="monospace" fontSize="9" textAnchor="middle" className="anim-fade">D&B_CONTRACTOR</text>

          {/* Termination Event */}
          <g className="anim-fade-late">
            {/* Cut line between Trust and SPV */}
            <path d="M 140 80 L 180 80" stroke="#c1a679" strokeWidth="3" className="anim-strike" />
            <text x="80" y="83" fill="#c1a679" fontFamily="monospace" fontSize="9">TERMINATION</text>
            
            <rect x="0" y="220" width="320" height="50" fill="rgba(11, 59, 36, 0.8)" stroke="#c1a679" strokeWidth="1" />
            <text x="10" y="235" fill="#c1a679" fontFamily="monospace" fontSize="9">RULING: VALID_TERMINATION</text>
            <text x="10" y="250" fill="rgba(245, 240, 232, 0.7)" fontFamily="monospace" fontSize="8">TRUST ENTITLED TO TERMINATE PROJECT AGREEMENT</text>
            <text x="10" y="260" fill="rgba(245, 240, 232, 0.7)" fontFamily="monospace" fontSize="8">DUE TO ACCUMULATION OF MAJOR CONSTRUCTION DEFECTS.</text>
          </g>
        </g>
      </svg>
    </div>
  );
}
