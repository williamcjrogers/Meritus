"use client";

/**
 * DelayTIATerminal,Time Impact Analysis visualization.
 * A network of schedule nodes with a red disruption fragnet inserted;
 * the gold critical path routes cleanly above it, unbreached.
 */
export function DelayTIATerminal({ className = "" }: { className?: string }) {
  return (
    <div
      data-tia-terminal
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes tiaDraw {
          from { stroke-dashoffset: 1500; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes tiaFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes tiaFragnet {
          from { opacity: 0; transform: scaleY(0.8); }
          to   { opacity: 1; transform: scaleY(1); }
        }
        @keyframes tiaPulse {
          0%, 100% { opacity: 0.3; }
          50%      { opacity: 0.8; }
        }
        @keyframes tiaGlow {
          0%, 100% { opacity: 0; filter: blur(2px); }
          50%      { opacity: 0.3; filter: blur(4px); }
        }
        @keyframes tiaReject {
          from { stroke-dashoffset: 200; }
          to   { stroke-dashoffset: 0; }
        }
        .terminal-active [data-tia-terminal] .tia-grid {
          opacity: 0;
          animation: tiaFade 1.5s ease forwards 0.2s;
        }
        .terminal-active [data-tia-terminal] .tia-fragnet {
          opacity: 0;
          animation: tiaFragnet 1.2s ease forwards 0.8s;
        }
        .terminal-active [data-tia-terminal] .tia-draw {
          stroke-dasharray: 1500;
          stroke-dashoffset: 1500;
          animation: tiaDraw 3s cubic-bezier(0.4, 0, 0.2, 1) forwards 1.2s;
          will-change: stroke-dashoffset;
        }
        .terminal-active [data-tia-terminal] .tia-glow {
          animation: tiaGlow 3s ease-in-out infinite;
        }
        .terminal-active [data-tia-terminal] .tia-fade {
          opacity: 0;
          animation: tiaFade 1.5s ease forwards 2.5s;
        }
        .terminal-active [data-tia-terminal] .tia-fade-2 {
          opacity: 0;
          animation: tiaFade 1.5s ease forwards 3.2s;
        }
        .terminal-active [data-tia-terminal] .tia-fade-3 {
          opacity: 0;
          animation: tiaFade 1.2s ease forwards 3.8s;
        }
        .terminal-active [data-tia-terminal] .tia-pulse {
          animation: tiaPulse 2.5s ease-in-out infinite;
        }
        .terminal-active [data-tia-terminal] .tia-reject {
          stroke-dasharray: 200;
          stroke-dashoffset: 200;
          animation: tiaReject 0.8s ease forwards 4s;
        }
        .terminal-inactive [data-tia-terminal] * {
          opacity: 0 !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .terminal-active [data-tia-terminal] .tia-grid,
          .terminal-active [data-tia-terminal] .tia-fragnet,
          .terminal-active [data-tia-terminal] .tia-draw,
          .terminal-active [data-tia-terminal] .tia-glow,
          .terminal-active [data-tia-terminal] .tia-fade,
          .terminal-active [data-tia-terminal] .tia-fade-2,
          .terminal-active [data-tia-terminal] .tia-fade-3,
          .terminal-active [data-tia-terminal] .tia-pulse,
          .terminal-active [data-tia-terminal] .tia-reject {
            animation: none;
            opacity: 0.5;
            stroke-dashoffset: 0;
          }
        }
      `,
        }}
      />

      <svg
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        viewBox="0 0 800 400"
      >
        {/* Faint grid */}
        <g className="tia-grid" stroke="#1e3b2b" strokeWidth="0.5" strokeDasharray="2 6" opacity="0.5">
          <line x1="0" y1="100" x2="800" y2="100" />
          <line x1="0" y1="200" x2="800" y2="200" />
          <line x1="0" y1="300" x2="800" y2="300" />
          <line x1="200" y1="0" x2="200" y2="400" />
          <line x1="400" y1="0" x2="400" y2="400" />
          <line x1="600" y1="0" x2="600" y2="400" />
        </g>

        {/* Schedule network,faint background activity nodes and links */}
        <g className="tia-grid">
          {/* Activity nodes (small rects) */}
          <rect x="60" y="120" width="60" height="20" rx="2" fill="none" stroke="#2d563a" strokeWidth="1" />
          <rect x="160" y="120" width="60" height="20" rx="2" fill="none" stroke="#2d563a" strokeWidth="1" />
          <rect x="260" y="120" width="60" height="20" rx="2" fill="none" stroke="#2d563a" strokeWidth="1" />
          <rect x="460" y="120" width="60" height="20" rx="2" fill="none" stroke="#2d563a" strokeWidth="1" />
          <rect x="560" y="120" width="60" height="20" rx="2" fill="none" stroke="#2d563a" strokeWidth="1" />
          <rect x="660" y="120" width="60" height="20" rx="2" fill="none" stroke="#2d563a" strokeWidth="1" />

          {/* Lower non-critical path nodes */}
          <rect x="160" y="220" width="60" height="20" rx="2" fill="none" stroke="#2d563a" strokeWidth="0.8" opacity="0.5" />
          <rect x="260" y="260" width="60" height="20" rx="2" fill="none" stroke="#2d563a" strokeWidth="0.8" opacity="0.5" />
          <rect x="460" y="260" width="60" height="20" rx="2" fill="none" stroke="#2d563a" strokeWidth="0.8" opacity="0.5" />
          <rect x="560" y="220" width="60" height="20" rx="2" fill="none" stroke="#2d563a" strokeWidth="0.8" opacity="0.5" />

          {/* Network links,faint connecting lines */}
          <line x1="120" y1="130" x2="160" y2="130" stroke="#2d563a" strokeWidth="0.8" />
          <line x1="220" y1="130" x2="260" y2="130" stroke="#2d563a" strokeWidth="0.8" />
          <line x1="520" y1="130" x2="560" y2="130" stroke="#2d563a" strokeWidth="0.8" />
          <line x1="620" y1="130" x2="660" y2="130" stroke="#2d563a" strokeWidth="0.8" />

          {/* Non-critical links */}
          <line x1="220" y1="140" x2="260" y2="260" stroke="#2d563a" strokeWidth="0.5" opacity="0.4" strokeDasharray="2 3" />
          <line x1="320" y1="270" x2="460" y2="270" stroke="#2d563a" strokeWidth="0.5" opacity="0.4" strokeDasharray="2 3" />
          <line x1="520" y1="260" x2="560" y2="230" stroke="#2d563a" strokeWidth="0.5" opacity="0.4" strokeDasharray="2 3" />

          {/* Activity labels */}
          <text x="70" y="135" fill="#355a42" fontFamily="monospace" fontSize="7" letterSpacing="0.5">ACT_14</text>
          <text x="170" y="135" fill="#355a42" fontFamily="monospace" fontSize="7" letterSpacing="0.5">ACT_15</text>
          <text x="270" y="135" fill="#355a42" fontFamily="monospace" fontSize="7" letterSpacing="0.5">ACT_16</text>
          <text x="470" y="135" fill="#355a42" fontFamily="monospace" fontSize="7" letterSpacing="0.5">ACT_17</text>
          <text x="570" y="135" fill="#355a42" fontFamily="monospace" fontSize="7" letterSpacing="0.5">ACT_18</text>
          <text x="670" y="135" fill="#355a42" fontFamily="monospace" fontSize="7" letterSpacing="0.5">ACT_19</text>
        </g>

        {/* Disruption fragnet,red-tinted block inserted between ACT_16 and ACT_17 */}
        <g className="tia-fragnet">
          <rect
            x="335"
            y="165"
            width="110"
            height="90"
            rx="2"
            fill="rgba(74, 4, 4, 0.25)"
            stroke="#6b2020"
            strokeWidth="1"
            strokeDasharray="3 2"
          />
          {/* Fragnet internal nodes */}
          <rect x="350" y="180" width="40" height="14" rx="1" fill="none" stroke="#6b2020" strokeWidth="0.8" />
          <rect x="350" y="205" width="40" height="14" rx="1" fill="none" stroke="#6b2020" strokeWidth="0.8" />
          <rect x="350" y="230" width="40" height="14" rx="1" fill="none" stroke="#6b2020" strokeWidth="0.8" />
          <line x1="390" y1="193" x2="400" y2="205" stroke="#6b2020" strokeWidth="0.6" />
          <line x1="390" y1="212" x2="400" y2="230" stroke="#6b2020" strokeWidth="0.6" />

          {/* Fragnet label */}
          <text x="340" y="162" fill="#6b2020" fontFamily="monospace" fontSize="8" letterSpacing="0.5">FRAGNET_ERE_14-19</text>

          {/* Float consumption indicator */}
          <line x1="335" y1="268" x2="445" y2="268" stroke="#6b2020" strokeWidth="0.5" strokeDasharray="2 2" />
          <text x="350" y="280" fill="#6b2020" fontFamily="monospace" fontSize="7" letterSpacing="0.5" className="tia-pulse">22D_FLOAT_CONSUMED</text>
        </g>

        {/* Critical path,gold line routing ABOVE the fragnet, unaffected */}
        <path
          d="M 60 130 L 320 130 L 340 110 L 450 110 L 460 130 L 720 130"
          stroke="#c1a679"
          strokeWidth="1.5"
          fill="none"
          className="tia-draw"
        />

        {/* Glow behind critical path bypass */}
        <path
          d="M 320 130 L 450 110"
          stroke="#c1a679"
          strokeWidth="6"
          fill="none"
          className="tia-glow"
        />

        {/* Critical path start/end markers */}
        <circle cx="60" cy="130" r="3" fill="#c1a679" className="tia-fade" />
        <circle cx="720" cy="130" r="3" fill="#c1a679" className="tia-fade" />

        {/* Callout,Critical path unbreached */}
        <line x1="400" y1="110" x2="400" y2="70" stroke="#2d563a" strokeWidth="0.8" className="tia-fade" />
        <text x="410" y="75" fill="#c1a679" fontFamily="monospace" fontSize="10" letterSpacing="1" className="tia-fade-2">
          CRITICAL_PATH: UNBREACHED
        </text>
        <text x="410" y="90" fill="#6da57e" fontFamily="monospace" fontSize="8" letterSpacing="1" className="tia-fade-2">
          FLOAT_ABSORBED,NO_EXTENSION
        </text>

        {/* Status readout,bottom */}
        <text x="60" y="340" fill="#355a42" fontFamily="monospace" fontSize="9" letterSpacing="1" className="tia-fade-2">
          PROTOCOL: TIA,FRAGNETS_INSERTED
        </text>
        <text x="60" y="356" fill="#355a42" fontFamily="monospace" fontSize="8" letterSpacing="1" className="tia-fade-2">
          EMPLOYER_RISK_EVENTS: 14-19,PROJECT_FLOAT: 22D
        </text>

        {/* EOT Claim rejected label */}
        <text x="60" y="380" fill="#c1a679" fontFamily="monospace" fontSize="10" letterSpacing="1" className="tia-fade-3">
          EOT_CLAIM: 3WK
        </text>
        <line
          x1="55"
          y1="380"
          x2="220"
          y2="380"
          stroke="#6b2020"
          strokeWidth="1"
          className="tia-reject"
        />
        <text x="230" y="380" fill="#6b2020" fontFamily="monospace" fontSize="10" letterSpacing="1" className="tia-fade-3">
          [REJECTED]
        </text>
      </svg>
    </div>
  );
}
