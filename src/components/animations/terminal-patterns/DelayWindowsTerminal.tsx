"use client";

/**
 * DelayWindowsTerminal,Windows analysis & As-Planned vs As-Built.
 * Isolates Window 4 (Weeks 12-16): a 42-day claim is reduced to 24 days
 * after concurrent steel fabrication mitigation is identified.
 */
export function DelayWindowsTerminal({ className = "" }: { className?: string }) {
  return (
    <div
      data-dw-terminal
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes dwDraw {
          from { stroke-dashoffset: 1500; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes dwFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes dwShrink {
          from { opacity: 0.5; }
          to   { opacity: 0.2; }
        }
        @keyframes dwStrike {
          from { stroke-dashoffset: 600; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes dwGoldDraw {
          from { stroke-dashoffset: 400; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes dwScanHighlight {
          0%   { opacity: 0; }
          30%  { opacity: 0.6; }
          100% { opacity: 0.3; }
        }
        @keyframes dwPulse {
          0%, 100% { opacity: 0.4; }
          50%      { opacity: 1; }
        }
        .terminal-active [data-dw-terminal] .dw-grid {
          opacity: 0;
          animation: dwFade 1.5s ease forwards 0.2s;
        }
        .terminal-active [data-dw-terminal] .dw-frame {
          stroke-dasharray: 1500;
          stroke-dashoffset: 1500;
          animation: dwDraw 2s cubic-bezier(0.4, 0, 0.2, 1) forwards 0.4s;
          will-change: stroke-dashoffset;
        }
        .terminal-active [data-dw-terminal] .dw-claim {
          opacity: 0;
          animation: dwFade 1.5s ease forwards 1.2s;
        }
        .terminal-active [data-dw-terminal] .dw-concurrent {
          opacity: 0;
          animation: dwScanHighlight 2s ease forwards 2s;
        }
        .terminal-active [data-dw-terminal] .dw-strike {
          stroke-dasharray: 600;
          stroke-dashoffset: 600;
          animation: dwStrike 0.8s ease forwards 2.8s;
        }
        .terminal-active [data-dw-terminal] .dw-shrink {
          animation: dwShrink 0.6s ease forwards 2.8s;
        }
        .terminal-active [data-dw-terminal] .dw-gold {
          stroke-dasharray: 400;
          stroke-dashoffset: 400;
          animation: dwGoldDraw 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards 3.2s;
          will-change: stroke-dashoffset;
        }
        .terminal-active [data-dw-terminal] .dw-gold-fade {
          opacity: 0;
          animation: dwFade 1s ease forwards 3.5s;
        }
        .terminal-active [data-dw-terminal] .dw-fade {
          opacity: 0;
          animation: dwFade 1.5s ease forwards 3.8s;
        }
        .terminal-active [data-dw-terminal] .dw-fade-2 {
          opacity: 0;
          animation: dwFade 1.2s ease forwards 4.2s;
        }
        .terminal-active [data-dw-terminal] .dw-pulse {
          animation: dwPulse 2.5s ease-in-out infinite;
        }
        .terminal-inactive [data-dw-terminal] * {
          opacity: 0 !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .terminal-active [data-dw-terminal] .dw-grid,
          .terminal-active [data-dw-terminal] .dw-frame,
          .terminal-active [data-dw-terminal] .dw-claim,
          .terminal-active [data-dw-terminal] .dw-concurrent,
          .terminal-active [data-dw-terminal] .dw-strike,
          .terminal-active [data-dw-terminal] .dw-shrink,
          .terminal-active [data-dw-terminal] .dw-gold,
          .terminal-active [data-dw-terminal] .dw-gold-fade,
          .terminal-active [data-dw-terminal] .dw-fade,
          .terminal-active [data-dw-terminal] .dw-fade-2,
          .terminal-active [data-dw-terminal] .dw-pulse {
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
        <g className="dw-grid" stroke="#1e3b2b" strokeWidth="0.5" strokeDasharray="2 6" opacity="0.5">
          <line x1="0" y1="100" x2="800" y2="100" />
          <line x1="0" y1="200" x2="800" y2="200" />
          <line x1="0" y1="300" x2="800" y2="300" />
          <line x1="150" y1="0" x2="150" y2="400" />
          <line x1="350" y1="0" x2="350" y2="400" />
          <line x1="550" y1="0" x2="550" y2="400" />
          <line x1="750" y1="0" x2="750" y2="400" />
        </g>

        {/* Window isolation frame */}
        <rect
          x="100"
          y="60"
          width="600"
          height="260"
          rx="2"
          fill="none"
          stroke="#2d563a"
          strokeWidth="1"
          className="dw-frame"
        />

        {/* Window header label */}
        <text x="110" y="52" fill="#6da57e" fontFamily="monospace" fontSize="10" letterSpacing="1" className="dw-grid">
          WINDOW_4: WK12,WK16
        </text>

        {/* Week markers along top */}
        <g className="dw-grid">
          <text x="120" y="78" fill="#355a42" fontFamily="monospace" fontSize="7">WK12</text>
          <text x="258" y="78" fill="#355a42" fontFamily="monospace" fontSize="7">WK13</text>
          <text x="398" y="78" fill="#355a42" fontFamily="monospace" fontSize="7">WK14</text>
          <text x="538" y="78" fill="#355a42" fontFamily="monospace" fontSize="7">WK15</text>
          <text x="660" y="78" fill="#355a42" fontFamily="monospace" fontSize="7">WK16</text>
          {/* Tick marks */}
          <line x1="120" y1="82" x2="120" y2="88" stroke="#355a42" strokeWidth="0.5" />
          <line x1="260" y1="82" x2="260" y2="88" stroke="#355a42" strokeWidth="0.5" />
          <line x1="400" y1="82" x2="400" y2="88" stroke="#355a42" strokeWidth="0.5" />
          <line x1="540" y1="82" x2="540" y2="88" stroke="#355a42" strokeWidth="0.5" />
          <line x1="680" y1="82" x2="680" y2="88" stroke="#355a42" strokeWidth="0.5" />
        </g>

        {/* 42-day claimed bar,long, faint */}
        <g className="dw-claim dw-shrink">
          <rect x="120" y="110" width="560" height="22" rx="1" fill="rgba(45, 86, 58, 0.3)" stroke="#2d563a" strokeWidth="0.8" />
          <text x="130" y="125" fill="#355a42" fontFamily="monospace" fontSize="9" letterSpacing="0.5">
            CLAIMED_DELAY: 42D
          </text>
          {/* Hatch pattern for claimed bar */}
          <g stroke="#2d563a" strokeWidth="0.3" opacity="0.4">
            {Array.from({ length: 20 }, (_, i) => (
              <line key={i} x1={140 + i * 28} y1="110" x2={148 + i * 28} y2="132" />
            ))}
          </g>
        </g>

        {/* Strike-through on claimed bar */}
        <line
          x1="115"
          y1="121"
          x2="690"
          y2="121"
          stroke="#6b2020"
          strokeWidth="1.5"
          className="dw-strike"
        />

        {/* Concurrent work bar,secondary, highlighted by scanner */}
        <g className="dw-concurrent">
          {/* Highlight glow behind concurrent bar */}
          <rect x="118" y="148" width="240" height="28" rx="1" fill="rgba(109, 165, 126, 0.08)" />
          <rect x="120" y="150" width="236" height="24" rx="1" fill="none" stroke="#6da57e" strokeWidth="1" strokeDasharray="3 2" />
          <text x="130" y="167" fill="#6da57e" fontFamily="monospace" fontSize="8" letterSpacing="0.5">
            CONCURRENT: STEEL_FABRICATION
          </text>
          <text x="370" y="167" fill="#355a42" fontFamily="monospace" fontSize="8" letterSpacing="0.5">
            MITIGATION: -18D
          </text>
        </g>

        {/* Net compensable delay,gold bar, shorter */}
        <rect
          x="120"
          y="200"
          width="320"
          height="24"
          rx="1"
          fill="rgba(193, 166, 121, 0.15)"
          stroke="#c1a679"
          strokeWidth="1.5"
          className="dw-gold"
        />
        <text x="130" y="217" fill="#c1a679" fontFamily="monospace" fontSize="10" letterSpacing="0.5" className="dw-gold-fade">
          NET_COMPENSABLE: 24D
        </text>

        {/* Gold endpoint marker */}
        <circle cx="440" cy="212" r="3" fill="#c1a679" className="dw-gold-fade" />

        {/* Bracket showing reduction */}
        <g className="dw-fade">
          <path d="M 442 202 L 680 202 L 680 222 L 442 222" fill="none" stroke="#6b2020" strokeWidth="0.8" strokeDasharray="2 2" />
          <text x="510" y="216" fill="#6b2020" fontFamily="monospace" fontSize="8" letterSpacing="0.5">DEDUCTED: 18D</text>
        </g>

        {/* As-planned vs As-built comparison labels */}
        <g className="dw-fade">
          <text x="120" y="260" fill="#355a42" fontFamily="monospace" fontSize="8" letterSpacing="0.5">AS-PLANNED ·····</text>
          <line x1="240" y1="257" x2="350" y2="257" stroke="#355a42" strokeWidth="0.8" strokeDasharray="4 4" />
          <text x="120" y="278" fill="#6da57e" fontFamily="monospace" fontSize="8" letterSpacing="0.5">AS-BUILT  ―――</text>
          <line x1="240" y1="275" x2="350" y2="275" stroke="#6da57e" strokeWidth="0.8" />
        </g>

        {/* Status readout */}
        <text x="110" y="340" fill="#355a42" fontFamily="monospace" fontSize="9" letterSpacing="1" className="dw-fade-2">
          PROTOCOL: WINDOWS,AS-PLANNED_v_AS-BUILT
        </text>
        <text x="110" y="358" fill="#c1a679" fontFamily="monospace" fontSize="9" letterSpacing="1" className="dw-fade-2 dw-pulse">
          NET_COMPENSABLE_DELAY: 24_DAYS
        </text>
      </svg>
    </div>
  );
}
