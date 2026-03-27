"use client";

/**
 * DelayPattern,animated Gantt-chart background for the Delay Analysis pillar card.
 * Horizontal programme bars with finish-to-start links and a pulsing data-date line.
 */
export function DelayPattern({ className = "" }: { className?: string }) {
  return (
    <div
      data-delay-pattern
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes delayDrift {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-40px); }
        }
        @keyframes delayDatePulse {
          0%, 100% { opacity: 0.06; }
          50%      { opacity: 0.18; }
        }
        [data-delay-pattern] .delay-drift {
          animation: delayDrift 20s linear infinite;
          will-change: transform;
        }
        [data-delay-pattern] .delay-date {
          animation: delayDatePulse 4s ease-in-out infinite;
          will-change: opacity;
        }
        @media (prefers-reduced-motion: reduce) {
          [data-delay-pattern] .delay-drift,
          [data-delay-pattern] .delay-date { animation: none; }
        }
      `}} />

      <svg
        className="absolute inset-0 w-full h-full delay-drift"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 480 320"
      >
        {/* Vertical grid lines,monthly columns */}
        <g stroke="#B5975A" strokeWidth="0.4" opacity="0.06">
          {[60, 120, 180, 240, 300, 360, 420].map(x => (
            <line key={x} x1={x} y1={0} x2={x} y2={320} />
          ))}
        </g>

        {/* Horizontal row separators */}
        <g stroke="#B5975A" strokeWidth="0.3" opacity="0.04">
          {[40, 65, 90, 115, 140, 165, 190, 215, 240, 265].map(y => (
            <line key={y} x1={0} y1={y} x2={480} y2={y} />
          ))}
        </g>

        {/* WBS header */}
        <text x="14" y="30" fill="#B5975A" opacity="0.08" fontFamily="monospace" fontSize="4" fontWeight="bold">
          1.0  PROGRAMME &amp; DELAY
        </text>

        {/* Programme bars,staggered Gantt activities */}
        <g fill="#B5975A" opacity="0.09">
          <rect x="50"  y="44"  width="140" height="4" rx="0.5" />
          <rect x="90"  y="69"  width="100" height="4" rx="0.5" />
          <rect x="120" y="94"  width="180" height="4" rx="0.5" />
          <rect x="70"  y="119" width="120" height="4" rx="0.5" />
          <rect x="160" y="144" width="90"  height="4" rx="0.5" />
          <rect x="130" y="169" width="200" height="4" rx="0.5" />
          <rect x="100" y="194" width="80"  height="4" rx="0.5" />
          <rect x="200" y="219" width="130" height="4" rx="0.5" />
          <rect x="150" y="244" width="160" height="4" rx="0.5" />
          <rect x="80"  y="269" width="110" height="4" rx="0.5" />
        </g>

        {/* Delay extensions */}
        <g fill="#F5F0E8" opacity="0.06">
          <rect x="190" y="44"  width="30" height="4" rx="0.5" />
          <rect x="190" y="69"  width="20" height="4" rx="0.5" />
          <rect x="300" y="94"  width="45" height="4" rx="0.5" />
          <rect x="250" y="144" width="18" height="4" rx="0.5" />
          <rect x="330" y="169" width="50" height="4" rx="0.5" />
          <rect x="330" y="219" width="25" height="4" rx="0.5" />
          <rect x="310" y="244" width="30" height="4" rx="0.5" />
        </g>

        {/* Finish-to-start link lines */}
        <g stroke="#B5975A" strokeWidth="0.5" opacity="0.06" fill="none">
          <path d="M190,46 H196 V71 H90" />
          <path d="M190,71 H196 V96 H120" />
          <path d="M300,96 H306 V121 H70" />
          <path d="M190,121 H196 V146 H160" />
          <path d="M250,146 H256 V171 H130" />
          <path d="M180,196 H186 V221 H200" />
          <path d="M330,221 H336 V246 H150" />
        </g>

        {/* Milestone diamonds */}
        <g fill="#B5975A" opacity="0.10">
          <polygon points="220,46 224,50 220,54 216,50" />
          <polygon points="345,96 349,100 345,104 341,100" />
          <polygon points="380,171 384,175 380,179 376,175" />
          <polygon points="340,246 344,250 340,254 336,250" />
        </g>

        {/* Activity labels */}
        <g fill="#B5975A" opacity="0.06" fontFamily="monospace" fontSize="3.2">
          <text x="48"  y="47" textAnchor="end">Baseline Review</text>
          <text x="88"  y="72" textAnchor="end">As-Planned v As-Built</text>
          <text x="118" y="97" textAnchor="end">TIA,CE-047</text>
          <text x="68"  y="122" textAnchor="end">Critical Path</text>
          <text x="158" y="147" textAnchor="end">Float Analysis</text>
          <text x="128" y="172" textAnchor="end">Concurrent Delay</text>
          <text x="98"  y="197" textAnchor="end">Delay Narrative</text>
          <text x="198" y="222" textAnchor="end">Logic Audit</text>
          <text x="148" y="247" textAnchor="end">EoT Claim,P3</text>
          <text x="78"  y="272" textAnchor="end">Recovery Analysis</text>
        </g>

        {/* Data date line,pulsing vertical */}
        <line
          x1={280} y1={0} x2={280} y2={320}
          stroke="#B5975A" strokeWidth="0.8"
          strokeDasharray="3 5"
          className="delay-date"
        />
      </svg>
    </div>
  );
}
