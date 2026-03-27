"use client";

export function ChannelTunnelTerminal({ className = "" }: { className?: string }) {
  return (
    <div
      data-channel-terminal
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes digTunnel {
          from { stroke-dashoffset: 400; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes dropInjunction {
          0%   { transform: translateY(-50px); opacity: 0; }
          50%  { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(0); opacity: 0.3; stroke-dasharray: 2 4; }
        }
        @keyframes dataFlow {
          from { stroke-dashoffset: 20; }
          to   { stroke-dashoffset: 0; }
        }
        .terminal-active [data-channel-terminal] .anim-dig {
          stroke-dasharray: 400;
          stroke-dashoffset: 400;
          animation: digTunnel 4s linear forwards 0.5s;
        }
        .terminal-active [data-channel-terminal] .anim-fade {
          opacity: 0;
          animation: fadeIn 1s ease forwards 1s;
        }
        .terminal-active [data-channel-terminal] .anim-fade-late {
          opacity: 0;
          animation: fadeIn 1s ease forwards 2.5s;
        }
        .terminal-active [data-channel-terminal] .anim-injunction {
          opacity: 0;
          animation: dropInjunction 2s ease-in-out forwards 3s;
        }
        .terminal-active [data-channel-terminal] .anim-flow {
          stroke-dasharray: 4 4;
          animation: dataFlow 1s linear infinite;
        }
        .terminal-inactive [data-channel-terminal] * {
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
          <text x="30" y="25">REF: CHANNEL_TUNNEL_V_BALFOUR_BEATTY_[1993]_AC_334</text>
          <text x="350" y="25">JURISDICTION: ENG &gt; FRA | SEAT: BRUSSELS</text>
          <text x="650" y="25" fill="#c1a679">STS: INJUNCTIVE_RELIEF</text>
          <line x1="0" y1="35" x2="800" y2="35" stroke="rgba(109, 165, 126, 0.3)" strokeWidth="1" />
        </g>

        {/* Channel Cross Section */}
        <g transform="translate(50, 200)">
          {/* Sea Level */}
          <path d="M 0 0 Q 200 10 400 0" fill="none" stroke="rgba(109, 165, 126, 0.4)" strokeWidth="1" />
          <text x="10" y="-10" fill="rgba(109, 165, 126, 0.6)" fontFamily="monospace" fontSize="8">ENGLISH_CHANNEL</text>
          
          {/* Seabed */}
          <path d="M 0 50 Q 150 80 400 60" fill="none" stroke="#6da57e" strokeWidth="2" />
          
          {/* TBM Tunnel Path */}
          <path d="M 0 120 Q 200 150 400 120" fill="none" stroke="rgba(109, 165, 126, 0.2)" strokeWidth="20" strokeLinecap="round" />
          
          {/* Actual Tunnel Boring (Animated) */}
          <path d="M 0 120 Q 200 150 400 120" fill="none" stroke="#6da57e" strokeWidth="16" strokeLinecap="round" className="anim-dig" />
          
          {/* Cooling System Dispute Area */}
          <g className="anim-fade-late">
            <rect x="180" y="115" width="40" height="40" fill="none" stroke="#c1a679" strokeWidth="1" strokeDasharray="2 2" />
            <line x1="200" y1="115" x2="250" y2="70" stroke="#c1a679" strokeWidth="1" />
            <text x="255" y="65" fill="#c1a679" fontFamily="monospace" fontSize="8">DISPUTE: COOLING_SYSTEM</text>
          </g>
        </g>

        {/* Jurisdiction & Arbitration Diagram */}
        <g transform="translate(480, 100)" className="anim-fade">
          <text x="0" y="0" fill="#6da57e" fontFamily="monospace" fontSize="10" letterSpacing="1">ARBITRATION_AGREEMENT</text>
          
          <rect x="0" y="30" width="80" height="30" fill="rgba(109, 165, 126, 0.1)" stroke="#6da57e" strokeWidth="1" />
          <text x="40" y="48" fill="rgba(245, 240, 232, 0.9)" fontFamily="monospace" fontSize="8" textAnchor="middle">ENGLISH_LAW</text>

          <rect x="180" y="30" width="80" height="30" fill="rgba(109, 165, 126, 0.1)" stroke="#6da57e" strokeWidth="1" />
          <text x="220" y="48" fill="rgba(245, 240, 232, 0.9)" fontFamily="monospace" fontSize="8" textAnchor="middle">FRENCH_LAW</text>

          <rect x="90" y="100" width="80" height="30" fill="rgba(11, 59, 36, 0.6)" stroke="#c1a679" strokeWidth="1" />
          <text x="130" y="115" fill="#c1a679" fontFamily="monospace" fontSize="8" textAnchor="middle">ICC_BRUSSELS</text>
          <text x="130" y="125" fill="rgba(245, 240, 232, 0.6)" fontFamily="monospace" fontSize="6" textAnchor="middle">(SEAT)</text>

          {/* Links */}
          <path d="M 40 60 L 110 100" stroke="#6da57e" strokeWidth="1" className="anim-flow" />
          <path d="M 220 60 L 150 100" stroke="#6da57e" strokeWidth="1" className="anim-flow" />

          {/* Injunction Mechanic */}
          <g className="anim-fade-late">
            <line x1="0" y1="180" x2="260" y2="180" stroke="#c1a679" strokeWidth="0.5" strokeDasharray="2 2" />
            <text x="0" y="175" fill="#c1a679" fontFamily="monospace" fontSize="8">INTERLOCUTORY_RELIEF (s.37(1) SCA 1981)</text>
            
            {/* The Injunction Block (Drops down, then fades out as court refuses to pre-empt) */}
            <g className="anim-injunction">
              <rect x="40" y="190" width="180" height="20" fill="#c1a679" />
              <text x="130" y="203" fill="#112a1d" fontFamily="monospace" fontSize="9" textAnchor="middle" fontWeight="bold">INJUNCTION_BARRIER</text>
            </g>

            <rect x="0" y="230" width="260" height="40" fill="rgba(11, 59, 36, 0.85)" stroke="#6da57e" strokeWidth="1" />
            <text x="10" y="245" fill="rgba(245, 240, 232, 0.8)" fontFamily="monospace" fontSize="8">"Courts have power to grant relief, but</text>
            <text x="10" y="258" fill="rgba(245, 240, 232, 0.8)" fontFamily="monospace" fontSize="8">should not pre-empt arbitral process."</text>
          </g>
        </g>
      </svg>
    </div>
  );
}
