"use client";

export function SabicTerminal({ className = "" }: { className?: string }) {
  return (
    <div
      data-sabic-terminal
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes drawPfd {
          from { stroke-dashoffset: 1500; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes drawCurve {
          from { stroke-dashoffset: 300; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes strikeTerminate {
          from { stroke-dasharray: 0, 150; }
          to   { stroke-dasharray: 150, 0; }
        }
        @keyframes blinkWarn {
          0%, 100% { opacity: 0.5; }
          50%      { opacity: 1; }
        }
        .terminal-active [data-sabic-terminal] .anim-pfd {
          stroke-dasharray: 1500;
          stroke-dashoffset: 1500;
          animation: drawPfd 3s ease-out forwards 0.2s;
        }
        .terminal-active [data-sabic-terminal] .anim-fade {
          opacity: 0;
          animation: fadeIn 1s ease forwards 1s;
        }
        .terminal-active [data-sabic-terminal] .anim-curve-base {
          stroke-dasharray: 300;
          stroke-dashoffset: 300;
          animation: drawCurve 2s linear forwards 1.5s;
        }
        .terminal-active [data-sabic-terminal] .anim-curve-actual {
          stroke-dasharray: 300;
          stroke-dashoffset: 300;
          animation: drawCurve 1.5s linear forwards 2s;
        }
        .terminal-active [data-sabic-terminal] .anim-terminate {
          stroke-dasharray: 0, 150;
          animation: strikeTerminate 0.5s ease-out forwards 3.5s;
        }
        .terminal-active [data-sabic-terminal] .anim-warn {
          animation: blinkWarn 1s infinite;
        }
        .terminal-inactive [data-sabic-terminal] * {
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
          <text x="30" y="25">REF: SABIC_V_PUNJ_LLOYD_[2013]_EWHC_2916</text>
          <text x="350" y="25">PROCESS: LDPE_PETROCHEMICAL_PLANT</text>
          <text x="650" y="25" fill="#c1a679">STS: EPC_TERMINATION</text>
          <line x1="0" y1="35" x2="800" y2="35" stroke="rgba(109, 165, 126, 0.3)" strokeWidth="1" />
        </g>

        {/* PFD (Process Flow Diagram) Background Layer */}
        <g transform="translate(60, 80)" stroke="#6da57e" strokeWidth="1" fill="none" className="anim-pfd" opacity="0.3">
          <rect x="0" y="0" width="60" height="80" />
          <circle cx="120" cy="40" r="30" />
          <polygon points="180,10 220,40 180,70" />
          <path d="M 60 40 L 90 40" />
          <path d="M 150 40 L 180 40" />
          <path d="M 220 40 L 260 40 L 260 100" />
        </g>
        <text x="60" y="70" fill="rgba(109, 165, 126, 0.4)" fontFamily="monospace" fontSize="10" letterSpacing="1" className="anim-fade">EPC_DESIGN_SCHEMATIC</text>

        {/* Progress S-Curve Analysis */}
        <g transform="translate(60, 220)">
          <text x="0" y="0" fill="#6da57e" fontFamily="monospace" fontSize="10" letterSpacing="1" className="anim-fade">SCHEDULE_PROGRESS_ANALYSIS (S-CURVE)</text>
          
          {/* Axes */}
          <line x1="0" y1="20" x2="0" y2="200" stroke="rgba(109, 165, 126, 0.5)" strokeWidth="1" className="anim-fade" />
          <line x1="0" y1="200" x2="400" y2="200" stroke="rgba(109, 165, 126, 0.5)" strokeWidth="1" className="anim-fade" />
          <text x="5" y="30" fill="rgba(109, 165, 126, 0.5)" fontFamily="monospace" fontSize="7" className="anim-fade">% COMPLETE</text>
          <text x="360" y="215" fill="rgba(109, 165, 126, 0.5)" fontFamily="monospace" fontSize="7" className="anim-fade">TIME</text>

          {/* Baseline Curve */}
          <path d="M 0 200 C 100 200, 200 40, 400 40" fill="none" stroke="rgba(109, 165, 126, 0.3)" strokeWidth="2" strokeDasharray="4 4" className="anim-curve-base" />
          
          {/* Actual Progress Curve (Flatlines) */}
          <path d="M 0 200 C 80 190, 150 160, 250 160" fill="none" stroke="#c1a679" strokeWidth="2" className="anim-curve-actual" />
          
          {/* Termination Cut Line */}
          <line x1="250" y1="20" x2="250" y2="220" stroke="#c1a679" strokeWidth="1.5" className="anim-terminate" />
          
          <g className="anim-fade" style={{ animationDelay: '4s' }}>
            <text x="255" y="30" fill="#c1a679" fontFamily="monospace" fontSize="8" className="anim-warn">TERMINATION_FOR_DEFAULT</text>
            <text x="255" y="42" fill="rgba(245, 240, 232, 0.6)" fontFamily="monospace" fontSize="7">"Failure to proceed with</text>
            <text x="255" y="52" fill="rgba(245, 240, 232, 0.6)" fontFamily="monospace" fontSize="7">due diligence"</text>
            
            <line x1="250" y1="160" x2="250" y2="65" stroke="rgba(193, 166, 121, 0.5)" strokeWidth="1" strokeDasharray="2 2" />
            <text x="255" y="110" fill="rgba(193, 166, 121, 0.8)" fontFamily="monospace" fontSize="7">DELAY_DELTA</text>
          </g>
        </g>

        {/* Damages Assessment Box */}
        <g transform="translate(500, 200)" className="anim-fade" style={{ animationDelay: '4.5s' }}>
          <rect x="0" y="0" width="240" height="150" fill="rgba(11, 59, 36, 0.6)" stroke="#6da57e" strokeWidth="1" />
          <rect x="0" y="0" width="240" height="25" fill="rgba(109, 165, 126, 0.2)" />
          <text x="10" y="16" fill="#6da57e" fontFamily="monospace" fontSize="9">QUANTUM: COMPLETION_COSTS</text>

          <text x="10" y="50" fill="rgba(245, 240, 232, 0.8)" fontFamily="monospace" fontSize="8">EMPLOYER_CLAIM:</text>
          <text x="230" y="50" fill="rgba(245, 240, 232, 0.8)" fontFamily="monospace" fontSize="8" textAnchor="end">£27,500,000</text>
          
          <text x="10" y="70" fill="rgba(109, 165, 126, 0.8)" fontFamily="monospace" fontSize="8">PERFORMANCE_BOND:</text>
          <text x="230" y="70" fill="rgba(109, 165, 126, 0.8)" fontFamily="monospace" fontSize="8" textAnchor="end">ENFORCED</text>

          <text x="10" y="90" fill="rgba(109, 165, 126, 0.8)" fontFamily="monospace" fontSize="8">ADVANCE_PAYMENT_GUARANTEE:</text>
          <text x="230" y="90" fill="rgba(109, 165, 126, 0.8)" fontFamily="monospace" fontSize="8" textAnchor="end">ENFORCED</text>

          <line x1="10" y1="110" x2="230" y2="110" stroke="#6da57e" strokeWidth="0.5" strokeDasharray="2 2" />

          <text x="10" y="130" fill="#c1a679" fontFamily="monospace" fontSize="9">TCC_AWARD:</text>
          <text x="230" y="130" fill="#c1a679" fontFamily="monospace" fontSize="9" textAnchor="end">£11,800,000</text>
        </g>
      </svg>
    </div>
  );
}
