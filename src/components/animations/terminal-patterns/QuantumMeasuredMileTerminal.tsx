"use client";

/**
 * QuantumMeasuredMileTerminal — Measured Mile productivity analysis.
 * A line graph with flat baseline (0.85 hrs/unit), a disruptive event,
 * and an erratic productivity spike. £4.2m claimed reduced to £1.1m.
 */
export function QuantumMeasuredMileTerminal({ className = "" }: { className?: string }) {
  /* Baseline path — flat stable productivity */
  const baselinePath = "M 80 220 L 350 220";

  /* Disrupted productivity — erratic spike after event */
  const disruptedPath =
    "M 370 220 L 395 185 L 420 200 L 440 140 L 460 170 L 480 110 L 500 155 L 520 95 L 540 130 L 560 105 L 580 145 L 600 120 L 620 150 L 650 160 L 680 180 L 710 195";

  /* Area fill under disrupted line (for highlighting wasted hours) */
  const disruptedArea =
    "M 370 220 L 395 185 L 420 200 L 440 140 L 460 170 L 480 110 L 500 155 L 520 95 L 540 130 L 560 105 L 580 145 L 600 120 L 620 150 L 650 160 L 680 180 L 710 195 L 710 220 Z";

  return (
    <div
      data-mm-terminal
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes mmDraw {
          from { stroke-dashoffset: 1500; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes mmFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes mmAreaFade {
          from { opacity: 0; }
          to   { opacity: 0.12; }
        }
        @keyframes mmPulse {
          0%, 100% { opacity: 0.3; }
          50%      { opacity: 0.8; }
        }
        @keyframes mmEventLine {
          from { stroke-dashoffset: 400; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes mmStrike {
          from { stroke-dashoffset: 200; }
          to   { stroke-dashoffset: 0; }
        }
        .terminal-active [data-mm-terminal] .mm-grid {
          opacity: 0;
          animation: mmFade 1.5s ease forwards 0.2s;
        }
        .terminal-active [data-mm-terminal] .mm-baseline {
          stroke-dasharray: 1500;
          stroke-dashoffset: 1500;
          animation: mmDraw 2s cubic-bezier(0.4, 0, 0.2, 1) forwards 0.5s;
          will-change: stroke-dashoffset;
        }
        .terminal-active [data-mm-terminal] .mm-event {
          stroke-dasharray: 400;
          stroke-dashoffset: 400;
          animation: mmEventLine 1s ease forwards 1.8s;
        }
        .terminal-active [data-mm-terminal] .mm-event-fade {
          opacity: 0;
          animation: mmFade 1s ease forwards 2s;
        }
        .terminal-active [data-mm-terminal] .mm-disrupted {
          stroke-dasharray: 1500;
          stroke-dashoffset: 1500;
          animation: mmDraw 2.5s cubic-bezier(0.4, 0, 0.2, 1) forwards 2.2s;
          will-change: stroke-dashoffset;
        }
        .terminal-active [data-mm-terminal] .mm-area {
          opacity: 0;
          animation: mmAreaFade 1.5s ease forwards 3s;
        }
        .terminal-active [data-mm-terminal] .mm-fade {
          opacity: 0;
          animation: mmFade 1.5s ease forwards 3.5s;
        }
        .terminal-active [data-mm-terminal] .mm-fade-2 {
          opacity: 0;
          animation: mmFade 1.2s ease forwards 4s;
        }
        .terminal-active [data-mm-terminal] .mm-strike {
          stroke-dasharray: 200;
          stroke-dashoffset: 200;
          animation: mmStrike 0.8s ease forwards 4.2s;
        }
        .terminal-active [data-mm-terminal] .mm-pulse {
          animation: mmPulse 2.5s ease-in-out infinite;
        }
        .terminal-inactive [data-mm-terminal] * {
          opacity: 0 !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .terminal-active [data-mm-terminal] .mm-grid,
          .terminal-active [data-mm-terminal] .mm-baseline,
          .terminal-active [data-mm-terminal] .mm-event,
          .terminal-active [data-mm-terminal] .mm-event-fade,
          .terminal-active [data-mm-terminal] .mm-disrupted,
          .terminal-active [data-mm-terminal] .mm-area,
          .terminal-active [data-mm-terminal] .mm-fade,
          .terminal-active [data-mm-terminal] .mm-fade-2,
          .terminal-active [data-mm-terminal] .mm-strike,
          .terminal-active [data-mm-terminal] .mm-pulse {
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
        <g className="mm-grid" stroke="#1e3b2b" strokeWidth="0.5" strokeDasharray="2 6" opacity="0.5">
          <line x1="80" y1="80" x2="80" y2="320" />
          <line x1="80" y1="320" x2="730" y2="320" />
          <line x1="80" y1="220" x2="730" y2="220" />
          <line x1="80" y1="140" x2="730" y2="140" />
        </g>

        {/* Y-axis labels */}
        <g className="mm-grid">
          <text x="20" y="224" fill="#355a42" fontFamily="monospace" fontSize="7" letterSpacing="0.5">0.85</text>
          <text x="20" y="144" fill="#355a42" fontFamily="monospace" fontSize="7" letterSpacing="0.5">1.80</text>
          <text x="20" y="84" fill="#355a42" fontFamily="monospace" fontSize="7" letterSpacing="0.5">2.50</text>
          <text x="20" y="324" fill="#355a42" fontFamily="monospace" fontSize="7" letterSpacing="0.5">0.00</text>
          <text x="15" y="60" fill="#355a42" fontFamily="monospace" fontSize="7" letterSpacing="0.5">HRS/UNIT</text>
        </g>

        {/* Axis labels */}
        <g className="mm-grid">
          <text x="380" y="345" fill="#355a42" fontFamily="monospace" fontSize="7" letterSpacing="1">PROGRAMME_WEEKS →</text>
        </g>

        {/* Baseline — flat stable measured mile */}
        <path
          d={baselinePath}
          stroke="#c1a679"
          strokeWidth="1.5"
          fill="none"
          className="mm-baseline"
        />

        {/* Baseline label */}
        <text x="140" y="210" fill="#c1a679" fontFamily="monospace" fontSize="9" letterSpacing="0.5" className="mm-grid">
          MEASURED_MILE: 0.85_HRS/UNIT
        </text>

        {/* Dashed baseline extension (showing where productivity should have continued) */}
        <line
          x1="350"
          y1="220"
          x2="710"
          y2="220"
          stroke="#c1a679"
          strokeWidth="0.8"
          strokeDasharray="4 4"
          opacity="0.3"
          className="mm-event-fade"
        />

        {/* Vertical event marker */}
        <line
          x1="360"
          y1="60"
          x2="360"
          y2="320"
          stroke="#6b2020"
          strokeWidth="1"
          strokeDasharray="4 3"
          className="mm-event"
        />

        {/* Event label */}
        <text x="370" y="72" fill="#6b2020" fontFamily="monospace" fontSize="9" letterSpacing="1" className="mm-event-fade">
          DISRUPTION_EVENT
        </text>

        {/* Disrupted productivity line — erratic spikes */}
        <path
          d={disruptedPath}
          stroke="#6da57e"
          strokeWidth="1.2"
          fill="none"
          className="mm-disrupted"
        />

        {/* Highlighted area under disrupted curve — wasted man-hours */}
        <path
          d={disruptedArea}
          fill="#6b2020"
          className="mm-area"
        />

        {/* Area label */}
        <text x="470" y="250" fill="#6b2020" fontFamily="monospace" fontSize="8" letterSpacing="0.5" className="mm-fade" opacity="0.8">
          WASTED_MAN-HOURS
        </text>

        {/* Turnstile data dots along baseline */}
        <g className="mm-grid" opacity="0.6">
          {[100, 140, 180, 220, 260, 300, 340].map((x, i) => (
            <circle key={i} cx={x} cy={220 + (i % 2 === 0 ? -2 : 2)} r="1.5" fill="#c1a679" />
          ))}
        </g>

        {/* Status readout — bottom */}
        <text x="80" y="360" fill="#355a42" fontFamily="monospace" fontSize="9" letterSpacing="1" className="mm-fade">
          SOURCE: TURNSTILE_DATA + DAILY_ALLOCATION_SHEETS
        </text>

        {/* Claimed amount with strike-through */}
        <text x="80" y="382" fill="#355a42" fontFamily="monospace" fontSize="10" letterSpacing="1" className="mm-fade-2">
          CLAIMED: £4.2M
        </text>
        <line
          x1="75"
          y1="382"
          x2="230"
          y2="382"
          stroke="#6b2020"
          strokeWidth="1"
          className="mm-strike"
        />

        {/* Substantiated amount */}
        <text x="260" y="382" fill="#c1a679" fontFamily="monospace" fontSize="10" letterSpacing="1" className="mm-fade-2 mm-pulse">
          SUBSTANTIATED: £1.1M
        </text>
      </svg>
    </div>
  );
}
