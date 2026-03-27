"use client";

export function BalfourDLRTerminal({ className = "" }: { className?: string }) {
  return (
    <div
      data-balfour-dlr-terminal
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes drawRoute {
          from { stroke-dashoffset: 1000; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes trainMove {
          0%   { transform: translateX(0); }
          100% { transform: translateX(200px); }
        }
        @keyframes pulseNode {
          0%, 100% { r: 4; opacity: 0.5; }
          50%      { r: 8; opacity: 1; }
        }
        .terminal-active [data-balfour-dlr-terminal] .anim-route {
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation: drawRoute 3s ease-out forwards 0.2s;
        }
        .terminal-active [data-balfour-dlr-terminal] .anim-fade {
          opacity: 0;
          animation: fadeIn 1s ease forwards 1s;
        }
        .terminal-active [data-balfour-dlr-terminal] .anim-train {
          animation: trainMove 4s linear infinite;
        }
        .terminal-active [data-balfour-dlr-terminal] .anim-pulse {
          animation: pulseNode 2s infinite ease-in-out;
          transform-origin: center;
        }
        .terminal-active [data-balfour-dlr-terminal] .anim-fade-late {
          opacity: 0;
          animation: fadeIn 1s ease forwards 2.5s;
        }
        .terminal-inactive [data-balfour-dlr-terminal] * {
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
          <text x="30" y="25">REF: BALFOUR_BEATTY_V_DLR_(1996)_78_BLR_42</text>
          <text x="350" y="25">SYSTEM: LIGHT_RAIL_EXTENSION</text>
          <text x="650" y="25" fill="#c1a679">STS: CERTIFIER_DISPUTE</text>
          <line x1="0" y1="35" x2="800" y2="35" stroke="rgba(109, 165, 126, 0.3)" strokeWidth="1" />
        </g>

        {/* DLR Network Map Segment */}
        <g transform="translate(60, 150)">
          {/* Main Line */}
          <path d="M 0 50 L 100 50 L 150 100 L 350 100" fill="none" stroke="rgba(109, 165, 126, 0.3)" strokeWidth="4" />
          
          {/* Beckton Extension Line (Animated) */}
          <path d="M 150 100 L 200 150 L 350 150" fill="none" stroke="#6da57e" strokeWidth="4" className="anim-route" />
          
          {/* Stations */}
          <g className="anim-fade">
            <circle cx="100" cy="50" r="5" fill="#112a1d" stroke="#6da57e" strokeWidth="2" />
            <text x="100" y="35" fill="rgba(109, 165, 126, 0.8)" fontFamily="monospace" fontSize="8" textAnchor="middle">POPLAR</text>
            
            <circle cx="150" cy="100" r="5" fill="#112a1d" stroke="#6da57e" strokeWidth="2" />
            
            <circle cx="350" cy="150" r="5" fill="#112a1d" stroke="#6da57e" strokeWidth="2" />
            <text x="350" y="170" fill="rgba(109, 165, 126, 0.8)" fontFamily="monospace" fontSize="8" textAnchor="middle">BECKTON_EXT</text>
          </g>

          {/* Moving Train */}
          <g className="anim-fade">
            <g className="anim-train" transform="translate(200, 150)">
              <rect x="-15" y="-4" width="30" height="8" fill="#c1a679" rx="2" />
            </g>
          </g>
        </g>

        {/* Contract & Certification Diagram */}
        <g transform="translate(420, 150)">
          <text x="0" y="-50" fill="#6da57e" fontFamily="monospace" fontSize="10" letterSpacing="1" className="anim-fade">CERTIFICATION_MECHANISM: ICE_5TH</text>
          
          {/* Missing Engineer */}
          <g className="anim-fade">
            <rect x="100" y="-30" width="100" height="30" fill="none" stroke="rgba(193, 166, 121, 0.4)" strokeWidth="1" strokeDasharray="2 2" />
            <text x="150" y="-12" fill="rgba(193, 166, 121, 0.6)" fontFamily="monospace" fontSize="8" textAnchor="middle">INDEP_ENGINEER</text>
            <line x1="100" y1="-30" x2="200" y2="0" stroke="rgba(193, 166, 121, 0.4)" strokeWidth="1" />
            <line x1="200" y1="-30" x2="100" y2="0" stroke="rgba(193, 166, 121, 0.4)" strokeWidth="1" />
            <text x="150" y="10" fill="#c1a679" fontFamily="monospace" fontSize="7" textAnchor="middle">ROLE_REMOVED</text>
          </g>

          {/* The Setup */}
          <rect x="0" y="30" width="100" height="40" fill="rgba(109, 165, 126, 0.1)" stroke="#6da57e" strokeWidth="1" className="anim-fade" />
          <text x="50" y="50" fill="rgba(245, 240, 232, 0.9)" fontFamily="monospace" fontSize="9" textAnchor="middle" className="anim-fade">EMPLOYER</text>
          <text x="50" y="62" fill="rgba(109, 165, 126, 0.6)" fontFamily="monospace" fontSize="7" textAnchor="middle" className="anim-fade">(DLR)</text>

          <rect x="200" y="30" width="100" height="40" fill="rgba(109, 165, 126, 0.1)" stroke="#6da57e" strokeWidth="1" className="anim-fade" />
          <text x="250" y="50" fill="rgba(245, 240, 232, 0.9)" fontFamily="monospace" fontSize="9" textAnchor="middle" className="anim-fade">CONTRACTOR</text>
          <text x="250" y="62" fill="rgba(109, 165, 126, 0.6)" fontFamily="monospace" fontSize="7" textAnchor="middle" className="anim-fade">(Balfour Beatty)</text>

          {/* Direct Certification Flow */}
          <path d="M 100 50 L 200 50" stroke="#6da57e" strokeWidth="2" className="anim-fade" />
          <polygon points="190,46 200,50 190,54" fill="#6da57e" className="anim-fade" />
          
          <g className="anim-fade-late">
            {/* The Legal Constraint Overlay */}
            <rect x="110" y="41" width="80" height="18" fill="#112a1d" stroke="#c1a679" strokeWidth="1" />
            <text x="150" y="53" fill="#c1a679" fontFamily="monospace" fontSize="7" textAnchor="middle">CERTIFICATION</text>
            
            <circle cx="150" cy="50" r="4" fill="none" stroke="#c1a679" strokeWidth="1" className="anim-pulse" />

            <rect x="0" y="90" width="300" height="55" fill="rgba(11, 59, 36, 0.8)" stroke="#c1a679" strokeWidth="1" />
            <text x="10" y="105" fill="#c1a679" fontFamily="monospace" fontSize="9">IMPLIED_TERM: DUTY_OF_FAIR_DEALING</text>
            <text x="10" y="120" fill="rgba(245, 240, 232, 0.7)" fontFamily="monospace" fontSize="8">"Where employer acts as certifier, there is</text>
            <text x="10" y="132" fill="rgba(245, 240, 232, 0.7)" fontFamily="monospace" fontSize="8">an implied duty to act honestly, fairly,</text>
            <text x="10" y="144" fill="rgba(245, 240, 232, 0.7)" fontFamily="monospace" fontSize="8">and reasonably in exercising discretion."</text>
          </g>
        </g>
      </svg>
    </div>
  );
}
