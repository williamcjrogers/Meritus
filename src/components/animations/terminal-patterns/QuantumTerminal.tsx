"use client";

/**
 * QuantumTerminal — Signal vs noise data filtering visualization.
 * Dense cluster of noisy data filtered down to a clean gold subset.
 * Shows £12.4m claimed being reduced to £7.8m true exposure.
 */
export function QuantumTerminal({ className = "" }: { className?: string }) {
  /* Noise dots — dense cluster representing inflated claim */
  const noiseDots: [number, number][] = [];
  // Deterministic pseudo-random positions for the noise cloud
  const seed = [
    [470, 110], [510, 95], [545, 125], [490, 140], [530, 108],
    [560, 130], [475, 160], [520, 145], [555, 155], [585, 120],
    [500, 170], [540, 165], [570, 175], [495, 100], [535, 90],
    [565, 105], [480, 135], [515, 150], [550, 140], [590, 145],
    [505, 115], [545, 170], [575, 160], [465, 130], [525, 180],
    [560, 95], [490, 175], [530, 130], [570, 110], [600, 135],
    [485, 120], [520, 100], [555, 180], [580, 100], [510, 160],
    [540, 120], [575, 145], [495, 155], [535, 135], [565, 165],
  ];

  /* Signal dots — clean subset representing true exposure */
  const signalDots: [number, number][] = [
    [500, 260], [520, 255], [540, 265], [560, 258], [580, 262],
    [510, 270], [530, 268], [550, 275], [570, 270], [590, 265],
    [505, 280], [525, 278], [545, 282], [565, 277], [585, 280],
  ];

  return (
    <div
      data-quantum-terminal
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes qtDraw {
          from { stroke-dashoffset: 1500; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes qtFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes qtNoiseFade {
          from { opacity: 0; }
          to   { opacity: 0.3; }
        }
        @keyframes qtSignalFade {
          from { opacity: 0; }
          to   { opacity: 0.9; }
        }
        @keyframes qtFilterLine {
          0%   { opacity: 0; transform: scaleX(0); }
          100% { opacity: 1; transform: scaleX(1); }
        }
        @keyframes qtStrike {
          from { stroke-dashoffset: 200; }
          to   { stroke-dashoffset: 0; }
        }
        .terminal-active [data-quantum-terminal] .qt-noise {
          opacity: 0;
          animation: qtNoiseFade 2s ease forwards 0.3s;
        }
        .terminal-active [data-quantum-terminal] .qt-signal {
          opacity: 0;
          animation: qtSignalFade 1.5s ease forwards 2s;
        }
        .terminal-active [data-quantum-terminal] .qt-draw {
          stroke-dasharray: 1500;
          stroke-dashoffset: 1500;
          animation: qtDraw 2.5s cubic-bezier(0.4, 0, 0.2, 1) forwards 1s;
        }
        .terminal-active [data-quantum-terminal] .qt-fade {
          opacity: 0;
          animation: qtFade 1.5s ease forwards 1.5s;
        }
        .terminal-active [data-quantum-terminal] .qt-fade-2 {
          opacity: 0;
          animation: qtFade 1.5s ease forwards 2.5s;
        }
        .terminal-active [data-quantum-terminal] .qt-fade-3 {
          opacity: 0;
          animation: qtFade 1.5s ease forwards 3s;
        }
        .terminal-active [data-quantum-terminal] .qt-strike {
          stroke-dasharray: 200;
          stroke-dashoffset: 200;
          animation: qtStrike 0.8s ease forwards 1.8s;
        }
        .terminal-inactive [data-quantum-terminal] * {
          opacity: 0 !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .terminal-active [data-quantum-terminal] .qt-noise,
          .terminal-active [data-quantum-terminal] .qt-signal,
          .terminal-active [data-quantum-terminal] .qt-draw,
          .terminal-active [data-quantum-terminal] .qt-fade,
          .terminal-active [data-quantum-terminal] .qt-fade-2,
          .terminal-active [data-quantum-terminal] .qt-fade-3,
          .terminal-active [data-quantum-terminal] .qt-strike {
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
        {/* Scanner sweep line */}
        <line
          x1="0"
          y1="0"
          x2="0"
          y2="400"
          stroke="rgba(109, 165, 126, 0.3)"
          strokeWidth="2"
        />

        {/* Claimed bracket and noise lines */}
        <g className="qt-noise">
          {/* Dense faint data lines — representing inflated claim */}
          <g stroke="#2d563a" strokeWidth="1" opacity="0.6">
            <line x1="450" y1="100" x2="700" y2="100" strokeDasharray="2 4" />
            <line x1="420" y1="118" x2="750" y2="118" strokeDasharray="1 3" />
            <line x1="480" y1="136" x2="680" y2="136" />
            <line x1="430" y1="154" x2="720" y2="154" strokeDasharray="4 2" />
            <line x1="460" y1="172" x2="690" y2="172" />
          </g>

          {/* Bracket */}
          <path
            d="M 420 90 L 420 185 L 430 185"
            stroke="#2d563a"
            strokeWidth="1"
            fill="none"
          />
        </g>

        {/* Claimed label */}
        <text
          x="435"
          y="85"
          fill="#355a42"
          fontFamily="monospace"
          fontSize="10"
          letterSpacing="1"
          className="qt-noise"
        >
          CLAIMED (HUDSON): £12.4M
        </text>

        {/* Noise dots cloud */}
        <g className="qt-noise">
          {seed.map(([cx, cy], i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={1.5}
              fill="#2d563a"
              opacity={0.4 + (i % 3) * 0.2}
            />
          ))}
        </g>

        {/* Strike-through on claimed amount */}
        <line
          x1="430"
          y1="85"
          x2="630"
          y2="85"
          stroke="#6da57e"
          strokeWidth="1"
          className="qt-strike"
        />

        {/* Filter divider line */}
        <line
          x1="420"
          y1="215"
          x2="700"
          y2="215"
          stroke="#6da57e"
          strokeWidth="1"
          className="qt-draw"
        />

        {/* Filter arrow pointing down */}
        <path
          d="M 560 200 L 560 230"
          stroke="#6da57e"
          strokeWidth="1"
          strokeDasharray="2 2"
          fill="none"
          className="qt-fade"
        />
        <polygon
          points="556,228 560,236 564,228"
          fill="#6da57e"
          className="qt-fade"
        />

        {/* Filter label */}
        <text
          x="450"
          y="210"
          fill="#6da57e"
          fontFamily="monospace"
          fontSize="9"
          letterSpacing="1"
          className="qt-fade"
        >
          FILTER: UNPROVEN_NEXUS
        </text>

        {/* Signal dots — clean, bright subset */}
        <g className="qt-signal">
          {signalDots.map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={2} fill="#6da57e" />
          ))}
        </g>

        {/* True exposure bracket and line */}
        <path
          d="M 490 250 L 600 250"
          stroke="#c1a679"
          strokeWidth="1.5"
          fill="none"
          className="qt-draw"
        />
        <circle
          cx="490"
          cy="250"
          r="3"
          fill="#c1a679"
          className="qt-fade-2"
        />
        <circle
          cx="600"
          cy="250"
          r="3"
          fill="#c1a679"
          className="qt-fade-2"
        />

        {/* Bottom bracket */}
        <path
          d="M 490 260 L 490 270 L 600 270 L 600 260"
          stroke="#2d563a"
          strokeWidth="1"
          fill="none"
          className="qt-fade-2"
        />

        {/* True exposure label */}
        <text
          x="500"
          y="295"
          fill="#c1a679"
          fontFamily="monospace"
          fontSize="10"
          letterSpacing="1"
          className="qt-fade-3"
        >
          MEASURED_MILE: £7.8M
        </text>

        {/* Reduction indicator */}
        <text
          x="500"
          y="312"
          fill="#355a42"
          fontFamily="monospace"
          fontSize="8"
          letterSpacing="1"
          className="qt-fade-3"
        >
          GLOBAL_CLAIM_VARIANCE: -£4.6M
        </text>

        {/* Subtle grid */}
        <g stroke="#1e3b2b" strokeWidth="0.5" strokeDasharray="2 6" opacity="0.4">
          <line x1="0" y1="200" x2="800" y2="200" />
          <line x1="0" y1="300" x2="800" y2="300" />
        </g>
      </svg>
    </div>
  );
}
