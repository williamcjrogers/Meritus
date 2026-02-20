"use client";

/**
 * ProjectPulse — decorative animated SVG background evoking construction
 * programme timelines, Gantt bars, S-curves, and cost analysis.
 * Sits behind content on green sections at very low opacity.
 *
 * Pure CSS animations — no JS runtime cost.
 */
export function ProjectPulse({ className = "" }: { className?: string }) {
  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <svg
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        viewBox="0 0 1200 600"
      >
        {/* ── Gantt-style programme bars ── */}
        <g className="programme-bars">
          {/* Baseline bars (planned) */}
          <rect x="80" y="80" width="320" height="6" rx="1" fill="#B5975A" opacity="0.06" className="bar-grow bar-1" />
          <rect x="180" y="120" width="260" height="6" rx="1" fill="#B5975A" opacity="0.05" className="bar-grow bar-2" />
          <rect x="120" y="160" width="400" height="6" rx="1" fill="#B5975A" opacity="0.04" className="bar-grow bar-3" />
          <rect x="300" y="200" width="280" height="6" rx="1" fill="#B5975A" opacity="0.05" className="bar-grow bar-4" />
          <rect x="200" y="240" width="350" height="6" rx="1" fill="#B5975A" opacity="0.04" className="bar-grow bar-5" />
          <rect x="400" y="280" width="220" height="6" rx="1" fill="#B5975A" opacity="0.06" className="bar-grow bar-6" />
          <rect x="150" y="320" width="300" height="6" rx="1" fill="#B5975A" opacity="0.04" className="bar-grow bar-7" />

          {/* Delay extension bars (overrun — slightly brighter to hint at slippage) */}
          <rect x="400" y="80" width="80" height="6" rx="1" fill="#F5F0E8" opacity="0.03" className="delay-grow delay-1" />
          <rect x="440" y="120" width="60" height="6" rx="1" fill="#F5F0E8" opacity="0.025" className="delay-grow delay-2" />
          <rect x="520" y="160" width="100" height="6" rx="1" fill="#F5F0E8" opacity="0.03" className="delay-grow delay-3" />
          <rect x="580" y="200" width="50" height="6" rx="1" fill="#F5F0E8" opacity="0.025" className="delay-grow delay-4" />
        </g>

        {/* ── Timeline grid lines ── */}
        <g className="timeline-grid" stroke="#B5975A" strokeWidth="0.5" opacity="0.04">
          <line x1="200" y1="50" x2="200" y2="380" strokeDasharray="4 8" />
          <line x1="400" y1="50" x2="400" y2="380" strokeDasharray="4 8" />
          <line x1="600" y1="50" x2="600" y2="380" strokeDasharray="4 8" />
          <line x1="800" y1="50" x2="800" y2="380" strokeDasharray="4 8" />
        </g>

        {/* ── Data date line (vertical, pulsing) ── */}
        <line
          x1="520" y1="40" x2="520" y2="390"
          stroke="#B5975A" strokeWidth="1" opacity="0.06"
          className="data-date-pulse"
        />

        {/* ── S-Curve — earned value / cost flow ── */}
        <g className="s-curve-group">
          {/* BCWS — Planned value (baseline S-curve) */}
          <path
            d="M 80 480 C 200 478, 320 460, 440 420 C 560 380, 680 320, 800 260 C 880 230, 960 210, 1080 200"
            fill="none"
            stroke="#B5975A"
            strokeWidth="1.5"
            opacity="0.05"
            className="s-curve-draw s-curve-planned"
          />

          {/* ACWP — Actual cost (lagging, implying delay) */}
          <path
            d="M 80 480 C 220 476, 360 465, 480 440 C 600 415, 700 370, 780 320 C 840 290, 920 265, 1000 250"
            fill="none"
            stroke="#F5F0E8"
            strokeWidth="1"
            opacity="0.035"
            className="s-curve-draw s-curve-actual"
            strokeDasharray="6 4"
          />
        </g>

        {/* ── Critical path nodes ── */}
        <g className="critical-nodes">
          <circle cx="80" cy="80" r="2.5" fill="#B5975A" opacity="0.07" className="node-pulse node-1" />
          <circle cx="400" cy="80" r="2.5" fill="#B5975A" opacity="0.06" className="node-pulse node-2" />
          <circle cx="520" cy="160" r="2.5" fill="#B5975A" opacity="0.07" className="node-pulse node-3" />
          <circle cx="580" cy="200" r="2" fill="#B5975A" opacity="0.06" className="node-pulse node-4" />
          <circle cx="620" cy="280" r="2.5" fill="#B5975A" opacity="0.07" className="node-pulse node-5" />
          <circle cx="800" cy="260" r="2" fill="#B5975A" opacity="0.06" className="node-pulse node-6" />
        </g>

        {/* ── Right-side cost breakdown area ── */}
        <g className="cost-bars">
          {/* Stacked horizontal cost bars — far right */}
          <rect x="850" y="400" width="160" height="4" rx="1" fill="#B5975A" opacity="0.05" className="cost-fill cost-1" />
          <rect x="850" y="420" width="120" height="4" rx="1" fill="#B5975A" opacity="0.04" className="cost-fill cost-2" />
          <rect x="850" y="440" width="200" height="4" rx="1" fill="#B5975A" opacity="0.05" className="cost-fill cost-3" />
          <rect x="850" y="460" width="90" height="4" rx="1" fill="#B5975A" opacity="0.04" className="cost-fill cost-4" />
          <rect x="850" y="480" width="140" height="4" rx="1" fill="#F5F0E8" opacity="0.025" className="cost-fill cost-5" />
        </g>

        {/* ── Float consumption indicator (small triangle markers) ── */}
        <g fill="#B5975A" opacity="0.04" className="float-markers">
          <polygon points="398,75 402,75 400,70" className="float-tick tick-1" />
          <polygon points="598,75 602,75 600,70" className="float-tick tick-2" />
          <polygon points="798,75 802,75 800,70" className="float-tick tick-3" />
        </g>
      </svg>
    </div>
  );
}
