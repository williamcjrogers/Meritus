"use client";

export function CommercialTerminal({ className = "" }: { className?: string }) {
  return (
    <div
      data-com-terminal
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes comDraw {
          from { stroke-dashoffset: 800; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes comFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes comWarn {
          0%, 100% { fill: rgba(181, 151, 90, 0.2); }
          50%      { fill: rgba(181, 151, 90, 0.6); }
        }
        .terminal-active [data-com-terminal] .com-draw {
          stroke-dasharray: 800;
          stroke-dashoffset: 800;
          animation: comDraw 2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .terminal-active [data-com-terminal] .com-fade-1 { animation: comFade 1s ease forwards 0.5s; opacity: 0; }
        .terminal-active [data-com-terminal] .com-fade-2 { animation: comFade 1s ease forwards 1.2s; opacity: 0; }
        .terminal-active [data-com-terminal] .com-fade-3 { animation: comFade 1s ease forwards 1.8s; opacity: 0; }
        .terminal-active [data-com-terminal] .com-warn { animation: comWarn 2s ease-in-out infinite; }
        .terminal-inactive [data-com-terminal] * { opacity: 0 !important; }
      `,
        }}
      />
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice">
        <g transform="translate(0, 50)">
        {/* Grid lines */}
        <g stroke="rgba(109, 165, 126, 0.1)" strokeWidth="1" className="com-fade-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <line key={i} x1="0" y1={50 * i} x2="800" y2={50 * i} />
          ))}
          {Array.from({ length: 16 }).map((_, i) => (
            <line key={i} x1={50 * i} y1="0" x2={50 * i} y2="400" />
          ))}
        </g>

        {/* HVAC Path */}
        <path d="M 100 100 L 300 100 L 300 200 L 500 200 L 500 300 L 700 300" stroke="#6da57e" strokeWidth="2" fill="none" className="com-draw" style={{ animationDelay: '0.2s' }} />
        <text x="110" y="90" fill="#6da57e" fontFamily="monospace" fontSize="9" className="com-fade-1">SYS: HVAC_DUCTING</text>

        {/* Electrical Path */}
        <path d="M 150 300 L 300 300 L 300 200 L 600 200 L 600 100" stroke="rgba(109, 165, 126, 0.5)" strokeWidth="2" strokeDasharray="4 4" fill="none" className="com-draw" style={{ animationDelay: '0.6s' }} />
        <text x="160" y="290" fill="rgba(109, 165, 126, 0.7)" fontFamily="monospace" fontSize="9" className="com-fade-2">SYS: ELEC_CONTAINMENT</text>

        {/* Clash Point */}
        <circle cx="300" cy="200" r="10" className="com-fade-3 com-warn" stroke="#c1a679" strokeWidth="1" />
        <circle cx="500" cy="200" r="10" className="com-fade-3 com-warn" stroke="#c1a679" strokeWidth="1" style={{ animationDelay: '0.5s' }} />

        {/* Callouts */}
        <g className="com-fade-3">
          <line x1="300" y1="200" x2="250" y2="150" stroke="#c1a679" strokeWidth="1" />
          <text x="120" y="145" fill="#c1a679" fontFamily="monospace" fontSize="9">COORDINATION_FAILURE</text>

          <line x1="500" y1="200" x2="550" y2="150" stroke="#c1a679" strokeWidth="1" />
          <text x="560" y="145" fill="#c1a679" fontFamily="monospace" fontSize="10" letterSpacing="1">LIQUIDATED_DAMAGES</text>
          
          <rect x="560" y="155" width="220" height="24" fill="rgba(11, 59, 36, 0.5)" stroke="rgba(109, 165, 126, 0.3)" />
          <text x="570" y="171" fill="rgba(245, 240, 232, 0.6)" fontFamily="serif" fontSize="9" fontStyle="italic">
            Triple Point Technology v PTT [2021]
          </text>
        </g>
        </g>
      </svg>
    </div>
  );
}