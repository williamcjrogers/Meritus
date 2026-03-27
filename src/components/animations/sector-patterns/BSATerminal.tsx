"use client";

export function BSATerminal({ className = "" }: { className?: string }) {
  return (
    <div
      data-bsa-terminal
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes bsaDraw {
          from { stroke-dashoffset: 500; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes bsaFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .terminal-active [data-bsa-terminal] .bsa-draw {
          stroke-dasharray: 500;
          stroke-dashoffset: 500;
          animation: bsaDraw 2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .terminal-active [data-bsa-terminal] .bsa-fade-1 { animation: bsaFade 1s ease forwards 0.5s; opacity: 0; }
        .terminal-active [data-bsa-terminal] .bsa-fade-2 { animation: bsaFade 1s ease forwards 1.2s; opacity: 0; }
        .terminal-active [data-bsa-terminal] .bsa-fade-3 { animation: bsaFade 1s ease forwards 1.8s; opacity: 0; }
        .terminal-inactive [data-bsa-terminal] * { opacity: 0 !important; }
      `,
        }}
      />
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice">
        <g transform="translate(0, 50)">
        {/* Structural Wall */}
        <rect x="150" y="50" width="80" height="300" fill="rgba(109, 165, 126, 0.15)" stroke="#6da57e" strokeWidth="1" className="bsa-fade-1" />
        <text x="160" y="40" fill="#6da57e" fontFamily="monospace" fontSize="8" className="bsa-fade-1">STRUCTURAL_SFS</text>

        {/* Insulation */}
        <rect x="230" y="50" width="60" height="300" fill="rgba(109, 165, 126, 0.05)" stroke="rgba(109, 165, 126, 0.5)" strokeWidth="1" strokeDasharray="4 2" className="bsa-fade-1" />
        <text x="235" y="40" fill="rgba(109, 165, 126, 0.7)" fontFamily="monospace" fontSize="8" className="bsa-fade-1">COMBUSTIBLE_INS</text>

        {/* Cavity */}
        <rect x="290" y="50" width="40" height="300" fill="none" stroke="rgba(109, 165, 126, 0.3)" strokeWidth="1" className="bsa-fade-1" />
        
        {/* Missing Cavity Barrier Indicator */}
        <g className="bsa-fade-2">
          <circle cx="310" cy="200" r="12" fill="none" stroke="#c1a679" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="310" y1="200" x2="400" y2="150" stroke="#c1a679" strokeWidth="1" />
          <text x="410" y="145" fill="#c1a679" fontFamily="monospace" fontSize="9">DEFECT: MISSING_CAVITY_BARRIER</text>
        </g>

        {/* ACM Cladding Panel */}
        <rect x="330" y="50" width="20" height="300" fill="rgba(181, 151, 90, 0.2)" stroke="#c1a679" strokeWidth="1" className="bsa-fade-2" />
        <text x="325" y="40" fill="#c1a679" fontFamily="monospace" fontSize="8" className="bsa-fade-2">ACM_PANEL</text>

        {/* Legal Overlay */}
        <g className="bsa-fade-3">
          <rect x="410" y="170" width="300" height="80" fill="rgba(11, 59, 36, 0.7)" stroke="#6da57e" strokeWidth="1" />
          <text x="425" y="195" fill="#c1a679" fontFamily="monospace" fontSize="11" letterSpacing="1">
            BUILDING_SAFETY_ACT_2022
          </text>
          <text x="425" y="215" fill="#6da57e" fontFamily="monospace" fontSize="9" letterSpacing="1">
            ss.116-125: REMEDIATION_CONTRIBUTION
          </text>
          <text x="425" y="235" fill="rgba(245, 240, 232, 0.5)" fontFamily="serif" fontSize="10" fontStyle="italic">
            Defective Premises Act 1972 extended liability
          </text>
        </g>
        </g>
      </svg>
    </div>
  );
}