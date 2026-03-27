"use client";

export function BeaufortTerminal({ className = "" }: { className?: string }) {
  return (
    <div
      data-beaufort-terminal
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes drawBuilding {
          from { stroke-dashoffset: 2000; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes slideDown {
          from { transform: translateY(-20px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
        @keyframes splitCert {
          0%   { transform: translateX(0); }
          100% { transform: translateX(30px); }
        }
        @keyframes splitCertOpposite {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-30px); }
        }
        @keyframes scanline {
          0%   { transform: translateY(0); }
          100% { transform: translateY(180px); }
        }
        .terminal-active [data-beaufort-terminal] .anim-draw {
          stroke-dasharray: 2000;
          stroke-dashoffset: 2000;
          animation: drawBuilding 3s ease-in-out forwards 0.2s;
        }
        .terminal-active [data-beaufort-terminal] .anim-fade {
          opacity: 0;
          animation: fadeIn 1s ease forwards 1.5s;
        }
        .terminal-active [data-beaufort-terminal] .anim-cert {
          opacity: 0;
          animation: slideDown 0.8s ease forwards 2s;
        }
        .terminal-active [data-beaufort-terminal] .anim-split-right {
          animation: splitCert 1s ease forwards 3s;
        }
        .terminal-active [data-beaufort-terminal] .anim-split-left {
          animation: splitCertOpposite 1s ease forwards 3s;
        }
        .terminal-active [data-beaufort-terminal] .anim-scan {
          animation: scanline 2.5s linear infinite;
        }
        .terminal-inactive [data-beaufort-terminal] * {
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

        {/* Telemetry */}
        <g className="anim-fade" fontFamily="monospace" fontSize="8" fill="rgba(109, 165, 126, 0.6)">
          <text x="30" y="25">REF: BEAUFORT_V_GILBERT_ASH_[1998]_UKHL_19</text>
          <text x="350" y="25">FORM: JCT_STANDARD_FORM</text>
          <text x="650" y="25" fill="#c1a679">STS: CERT_OPENED_UP</text>
          <line x1="0" y1="35" x2="800" y2="35" stroke="rgba(109, 165, 126, 0.3)" strokeWidth="1" />
        </g>

        {/* 9-Storey Building Elevation */}
        <g transform="translate(80, 100)">
          <rect x="0" y="0" width="160" height="270" fill="rgba(109, 165, 126, 0.05)" stroke="#6da57e" strokeWidth="1" className="anim-draw" />
          
          {/* Storeys */}
          {Array.from({ length: 8 }).map((_, i) => (
            <line key={`floor${i}`} x1="0" y1={(i + 1) * 30} x2="160" y2={(i + 1) * 30} stroke="#6da57e" strokeWidth="0.5" strokeDasharray="4 2" className="anim-draw" />
          ))}
          
          {/* Glazing / Columns */}
          {Array.from({ length: 3 }).map((_, i) => (
            <line key={`col${i}`} x1={(i + 1) * 40} y1="0" x2={(i + 1) * 40} y2="270" stroke="#6da57e" strokeWidth="0.5" className="anim-draw" />
          ))}

          {/* Scanner Line over building */}
          <g className="anim-fade">
            <line x1="-10" y1="0" x2="170" y2="0" stroke="#c1a679" strokeWidth="1" className="anim-scan" />
            <polygon points="-10,0 -5,-5 -5,5" fill="#c1a679" className="anim-scan" />
            <polygon points="170,0 165,-5 165,5" fill="#c1a679" className="anim-scan" />
          </g>

          {/* Building Labels */}
          <g className="anim-fade" fontFamily="monospace" fontSize="8" fill="rgba(109, 165, 126, 0.7)">
            <text x="-30" y="15">L09</text>
            <text x="-30" y="135">L05</text>
            <text x="-30" y="255">L01</text>
          </g>
        </g>

        {/* Certification Process Diagram */}
        <g transform="translate(320, 100)">
          <text x="0" y="0" fill="#6da57e" fontFamily="monospace" fontSize="10" letterSpacing="1" className="anim-fade">VALUATION & CERTIFICATION</text>
          
          <line x1="80" y1="15" x2="80" y2="250" stroke="rgba(109, 165, 126, 0.3)" strokeWidth="1" strokeDasharray="4 4" className="anim-draw" />
          
          {/* Certificate Flow */}
          <g className="anim-cert">
            <rect x="20" y="30" width="120" height="30" fill="rgba(11, 59, 36, 0.8)" stroke="#6da57e" strokeWidth="1" />
            <text x="80" y="45" fill="rgba(245, 240, 232, 0.8)" fontFamily="monospace" fontSize="8" textAnchor="middle">ARCHITECT_CERT_14</text>
            <text x="80" y="55" fill="#c1a679" fontFamily="monospace" fontSize="9" textAnchor="middle">£1,450,000</text>
          </g>
          
          {/* The Opening Up Action */}
          <g className="anim-fade-late" transform="translate(0, 100)">
            <line x1="-20" y1="15" x2="180" y2="15" stroke="#c1a679" strokeWidth="0.5" strokeDasharray="2 2" />
            <text x="200" y="18" fill="#c1a679" fontFamily="monospace" fontSize="9">INHERENT_POWER_TO_OPEN_UP</text>
            
            {/* Split logic */}
            <g className="anim-split-left">
              <rect x="0" y="30" width="75" height="40" fill="rgba(11, 59, 36, 0.5)" stroke="rgba(109, 165, 126, 0.6)" strokeWidth="1" />
              <text x="37.5" y="45" fill="rgba(109, 165, 126, 0.8)" fontFamily="monospace" fontSize="7" textAnchor="middle">CERTIFIED</text>
              <text x="37.5" y="60" fill="rgba(109, 165, 126, 0.8)" fontFamily="monospace" fontSize="9" textAnchor="middle" textDecoration="line-through">£1,450k</text>
            </g>

            <g className="anim-split-right">
              <rect x="85" y="30" width="75" height="40" fill="rgba(193, 166, 121, 0.1)" stroke="#c1a679" strokeWidth="1" />
              <text x="122.5" y="45" fill="#c1a679" fontFamily="monospace" fontSize="7" textAnchor="middle">TRUE_VALUE</text>
              <text x="122.5" y="60" fill="#c1a679" fontFamily="monospace" fontSize="9" textAnchor="middle">£1,120k</text>
            </g>
          </g>

          {/* Set-Off Ledger */}
          <g className="anim-fade-late" transform="translate(200, 200)">
            <rect x="0" y="0" width="220" height="70" fill="none" stroke="#6da57e" strokeWidth="0.5" />
            <rect x="0" y="0" width="220" height="15" fill="rgba(109, 165, 126, 0.2)" />
            <text x="5" y="11" fill="rgba(245, 240, 232, 0.8)" fontFamily="monospace" fontSize="8">EMPLOYER_SET_OFF_LEDGER</text>
            
            <text x="5" y="30" fill="rgba(109, 165, 126, 0.8)" fontFamily="monospace" fontSize="8">CERTIFIED_SUM:</text>
            <text x="210" y="30" fill="rgba(109, 165, 126, 0.8)" fontFamily="monospace" fontSize="8" textAnchor="end">£1,450,000</text>
            
            <text x="5" y="45" fill="#c1a679" fontFamily="monospace" fontSize="8">DEFECTS_DEDUCTION:</text>
            <text x="210" y="45" fill="#c1a679" fontFamily="monospace" fontSize="8" textAnchor="end">-£330,000</text>
            
            <line x1="5" y1="52" x2="215" y2="52" stroke="#6da57e" strokeWidth="0.5" strokeDasharray="1 2" />
            
            <text x="5" y="62" fill="rgba(245, 240, 232, 0.9)" fontFamily="monospace" fontSize="8">NET_PAYABLE:</text>
            <text x="210" y="62" fill="rgba(245, 240, 232, 0.9)" fontFamily="monospace" fontSize="8" textAnchor="end">£1,120,000</text>
          </g>
        </g>
      </svg>
    </div>
  );
}
