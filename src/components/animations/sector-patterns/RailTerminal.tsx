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
          from { stroke-dashoffset: 1000; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes railFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes railPulse {
          0%, 100% { opacity: 0.3; }
          50%      { opacity: 1; }
        }
        .terminal-active [data-rail-terminal] .rail-draw {
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation: railDraw 3s cubic-bezier(0.4, 0, 0.2, 1) forwards 0.5s;
        }
        .terminal-active [data-rail-terminal] .rail-fade {
          opacity: 0;
          animation: railFade 1.5s ease forwards 1.5s;
        }
        .terminal-active [data-rail-terminal] .rail-fade-late {
          opacity: 0;
          animation: railFade 1.5s ease forwards 2.5s;
        }
        .terminal-active [data-rail-terminal] .rail-pulse {
          animation: railPulse 2s ease-in-out infinite;
        }
        .terminal-inactive [data-rail-terminal] * {
          opacity: 0 !important;
        }
      `,
        }}
      />
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice">
        {/* Background Grid */}
        <g stroke="rgba(109, 165, 126, 0.15)" strokeWidth="1" strokeDasharray="2 4">
          <line x1="0" y1="100" x2="800" y2="100" />
          <line x1="0" y1="200" x2="800" y2="200" />
          <line x1="0" y1="300" x2="800" y2="300" />
          <line x1="200" y1="0" x2="200" y2="400" />
          <line x1="400" y1="0" x2="400" y2="400" />
          <line x1="600" y1="0" x2="600" y2="400" />
        </g>

        {/* Phase Links (Non-critical) */}
        <path d="M 100 150 L 300 250 L 500 150 L 700 250" stroke="rgba(109, 165, 126, 0.3)" strokeWidth="2" fill="none" className="rail-draw" />
        <path d="M 100 250 L 300 150 L 500 250 L 700 150" stroke="rgba(109, 165, 126, 0.3)" strokeWidth="2" fill="none" className="rail-draw" />

        {/* Nodes */}
        {[
          [100, 150], [300, 250], [500, 150], [700, 250],
          [100, 250], [300, 150], [500, 250], [700, 150]
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="4" fill="#6da57e" className="rail-fade" />
        ))}

        {/* Critical Path / Interface Delay */}
        <path d="M 300 150 L 400 200 L 500 150" stroke="#c1a679" strokeWidth="3" fill="none" className="rail-draw" style={{ animationDelay: '1s' }} />
        <circle cx="400" cy="200" r="6" fill="#c1a679" className="rail-fade-late rail-pulse" />
        <circle cx="400" cy="200" r="14" stroke="#c1a679" strokeWidth="1" strokeDasharray="2 2" fill="none" className="rail-fade-late rail-pulse" />

        {/* Labels & Citations */}
        <text x="420" y="195" fill="#c1a679" fontFamily="monospace" fontSize="10" letterSpacing="1" className="rail-fade-late">
          INTERFACE_CLASH: CE-092
        </text>
        <text x="420" y="210" fill="#6da57e" fontFamily="monospace" fontSize="9" letterSpacing="1" className="rail-fade-late">
          NEC4_ECC_CORE_CL_60.1
        </text>

        {/* Code Block / SCL Citation */}
        <rect x="50" y="320" width="300" height="50" fill="rgba(11, 59, 36, 0.5)" stroke="rgba(109, 165, 126, 0.3)" className="rail-fade" />
        <text x="65" y="340" fill="#6da57e" fontFamily="monospace" fontSize="9" letterSpacing="1" className="rail-fade">
          SCL_PROTOCOL_2ND_ED:
        </text>
        <text x="65" y="355" fill="rgba(245, 240, 232, 0.5)" fontFamily="monospace" fontSize="9" letterSpacing="1" className="rail-fade">
          TIME_IMPACT_ANALYSIS_MANDATED
        </text>
      </svg>
    </div>
  );
}