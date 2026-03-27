"use client";

/**
 * DelayTerminal,Abstract minimalist Gantt chart showing critical path
 * divergence at EVENT_47. Lines draw themselves in on scroll.
 */
export function DelayTerminal({ className = "" }: { className?: string }) {
  return (
    <div
      data-delay-terminal
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes dtDraw {
          from { stroke-dashoffset: 1500; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes dtFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes dtPulse {
          0%, 100% { opacity: 0.2; }
          50%      { opacity: 1; }
        }
        @keyframes dtGlow {
          0%, 100% { opacity: 0; filter: blur(2px); }
          50%      { opacity: 0.4; filter: blur(4px); }
        }
        .terminal-active [data-delay-terminal] .dt-draw {
          stroke-dasharray: 1500;
          stroke-dashoffset: 1500;
          animation: dtDraw 3s cubic-bezier(0.4, 0, 0.2, 1) forwards 0.5s;
          will-change: stroke-dashoffset;
        }
        .terminal-active [data-delay-terminal] .dt-fade {
          opacity: 0;
          animation: dtFade 1.5s ease forwards 1.8s;
        }
        .terminal-active [data-delay-terminal] .dt-fade-2 {
          opacity: 0;
          animation: dtFade 1.5s ease forwards 2.4s;
        }
        .terminal-active [data-delay-terminal] .dt-pulse {
          animation: dtPulse 2.5s ease-in-out infinite;
        }
        .terminal-active [data-delay-terminal] .dt-glow {
          animation: dtGlow 3s ease-in-out infinite;
        }
        .terminal-inactive [data-delay-terminal] * {
          opacity: 0 !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .terminal-active [data-delay-terminal] .dt-draw,
          .terminal-active [data-delay-terminal] .dt-fade,
          .terminal-active [data-delay-terminal] .dt-fade-2,
          .terminal-active [data-delay-terminal] .dt-pulse,
          .terminal-active [data-delay-terminal] .dt-glow {
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
        {/* Faint grid lines */}
        <g stroke="#1e3b2b" strokeWidth="1" strokeDasharray="2 4" fill="none">
          <line x1="0" y1="100" x2="800" y2="100" />
          <line x1="0" y1="200" x2="800" y2="200" />
          <line x1="0" y1="300" x2="800" y2="300" />
          <line x1="400" y1="0" x2="400" y2="400" />
          <line x1="600" y1="0" x2="600" y2="400" />
          <line x1="200" y1="0" x2="200" y2="400" />
        </g>

        {/* Concurrent delay zone */}
        <rect
          x="400"
          y="80"
          width="200"
          height="240"
          fill="rgba(30, 59, 43, 0.4)"
          stroke="#2d563a"
          strokeWidth="1"
          strokeDasharray="2 2"
          className="dt-fade"
        />
        <text
          x="410"
          y="70"
          fill="#355a42"
          fontFamily="monospace"
          fontSize="10"
          letterSpacing="1"
          className="dt-fade"
        >
          CONCURRENT: WK38,WK52
        </text>

        {/* As-planned ghost line */}
        <path
          d="M 200 150 L 750 150"
          stroke="#2d563a"
          strokeWidth="1"
          strokeDasharray="4 4"
          fill="none"
          className="dt-fade"
        />
        <text
          x="660"
          y="140"
          fill="#355a42"
          fontFamily="monospace"
          fontSize="10"
          letterSpacing="1"
          className="dt-fade"
        >
          [AS-PLANNED]
        </text>

        {/* Faint background programme bars */}
        <g stroke="#2d563a" strokeWidth="1" opacity="0.5" className="dt-fade">
          <line x1="120" y1="120" x2="350" y2="120" />
          <line x1="180" y1="180" x2="450" y2="180" />
          <line x1="250" y1="210" x2="500" y2="210" />
          <line x1="300" y1="250" x2="620" y2="250" />
          <line x1="150" y1="280" x2="480" y2="280" />
          <line x1="350" y1="310" x2="680" y2="310" />
        </g>

        {/* Critical path,gold line that draws itself */}
        <path
          d="M 100 150 L 400 150 L 480 280 L 750 280"
          stroke="#c1a679"
          strokeWidth="1.5"
          fill="none"
          className="dt-draw"
        />

        {/* Glow behind critical path divergence */}
        <path
          d="M 380 150 L 500 280"
          stroke="#c1a679"
          strokeWidth="6"
          fill="none"
          className="dt-glow"
        />

        {/* Divergence node with pulsing ring */}
        <circle
          cx="400"
          cy="150"
          r="4"
          stroke="#c1a679"
          strokeWidth="1.5"
          fill="none"
          className="dt-pulse"
        />
        <circle
          cx="400"
          cy="150"
          r="14"
          stroke="#c1a679"
          strokeWidth="1"
          strokeDasharray="2 2"
          fill="none"
          className="dt-pulse"
        />

        {/* Crosshair at divergence */}
        <line
          x1="392"
          y1="150"
          x2="408"
          y2="150"
          stroke="#c1a679"
          strokeWidth="0.5"
          className="dt-pulse"
        />
        <line
          x1="400"
          y1="142"
          x2="400"
          y2="158"
          stroke="#c1a679"
          strokeWidth="0.5"
          className="dt-pulse"
        />

        {/* Callout line and labels */}
        <line
          x1="400"
          y1="136"
          x2="400"
          y2="100"
          stroke="#2d563a"
          strokeWidth="1"
          className="dt-fade"
        />
        <text
          x="410"
          y="108"
          fill="#c1a679"
          fontFamily="monospace"
          fontSize="10"
          letterSpacing="1"
          className="dt-fade"
        >
          EVENT_47
        </text>
        <text
          x="410"
          y="122"
          fill="#6da57e"
          fontFamily="monospace"
          fontSize="9"
          letterSpacing="1"
          className="dt-fade"
        >
          DIVERGENCE_DETECTED
        </text>

        {/* Adjusted path endpoint */}
        <circle
          cx="480"
          cy="280"
          r="3"
          fill="#c1a679"
          className="dt-fade-2"
        />
        <text
          x="490"
          y="275"
          fill="#6da57e"
          fontFamily="monospace"
          fontSize="9"
          letterSpacing="1"
          className="dt-fade-2"
        >
          ADJUSTED_PATH
        </text>

        {/* Endpoint marker */}
        <circle
          cx="750"
          cy="280"
          r="3"
          fill="#6da57e"
          className="dt-fade-2"
        />

        {/* Small data labels along bars */}
        <text
          x="130"
          y="115"
          fill="#355a42"
          fontFamily="monospace"
          fontSize="8"
          className="dt-fade"
        >
          ACT_012
        </text>
        <text
          x="310"
          y="245"
          fill="#355a42"
          fontFamily="monospace"
          fontSize="8"
          className="dt-fade"
        >
          ACT_038
        </text>
        <text
          x="360"
          y="305"
          fill="#355a42"
          fontFamily="monospace"
          fontSize="8"
          className="dt-fade"
        >
          ACT_052
        </text>
      </svg>
    </div>
  );
}
