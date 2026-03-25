"use client";

/**
 * QuantumOverheadTerminal — Overhead Audit visualization.
 * Fast-scrolling timesheet IDs with red strike-throughs tagging diverted
 * resources. Counter ticks down from £85,000 to £55,200.
 */
export function QuantumOverheadTerminal({ className = "" }: { className?: string }) {
  const timesheets = [
    { id: "TS-4401", name: "J. HARGREAVES", role: "SITE_MANAGER", diverted: false },
    { id: "TS-4402", name: "R. PATEL", role: "QS_SENIOR", diverted: false },
    { id: "TS-4403", name: "D. KOWALSKI", role: "PLANT_OPS", diverted: true },
    { id: "TS-4404", name: "M. CHEN", role: "FOREMAN_A", diverted: false },
    { id: "TS-4405", name: "S. O'BRIEN", role: "SITE_ENGINEER", diverted: true },
    { id: "TS-4406", name: "A. WILLIAMS", role: "SURVEYOR", diverted: false },
    { id: "TS-4407", name: "P. MORRISON", role: "FOREMAN_B", diverted: true },
    { id: "TS-4408", name: "K. AHMED", role: "SAFETY_MGR", diverted: false },
    { id: "TS-4409", name: "T. BROOKS", role: "PLANT_OPS_2", diverted: true },
    { id: "TS-4410", name: "L. MURPHY", role: "CONTRACTS", diverted: false },
    { id: "TS-4411", name: "N. FERNANDEZ", role: "SITE_AGENT", diverted: true },
    { id: "TS-4412", name: "B. WRIGHT", role: "QS_JUNIOR", diverted: false },
  ];

  const baseY = 72;
  const lineHeight = 22;

  return (
    <div
      data-oa-terminal
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes oaFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes oaRowSlide {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes oaStrike {
          from { stroke-dashoffset: 700; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes oaDivertFade {
          from { opacity: 0; }
          to   { opacity: 0.9; }
        }
        @keyframes oaPulse {
          0%, 100% { opacity: 0.4; }
          50%      { opacity: 1; }
        }
        @keyframes oaCountdown {
          0%   { opacity: 0; }
          20%  { opacity: 1; }
          100% { opacity: 1; }
        }
        .terminal-active [data-oa-terminal] .oa-header {
          opacity: 0;
          animation: oaFade 1s ease forwards 0.2s;
        }
        ${timesheets
          .map(
            (_, i) => `
        .terminal-active [data-oa-terminal] .oa-row-${i} {
          opacity: 0;
          animation: oaRowSlide 0.4s ease forwards ${0.4 + i * 0.15}s;
        }`
          )
          .join("")}
        ${timesheets
          .filter((t) => t.diverted)
          .map(
            (t, i) => `
        .terminal-active [data-oa-terminal] .oa-strike-${t.id} {
          stroke-dasharray: 700;
          stroke-dashoffset: 700;
          animation: oaStrike 0.5s ease forwards ${1.2 + timesheets.indexOf(t) * 0.15 + 0.3}s;
        }
        .terminal-active [data-oa-terminal] .oa-divert-${t.id} {
          opacity: 0;
          animation: oaDivertFade 0.4s ease forwards ${1.2 + timesheets.indexOf(t) * 0.15 + 0.5}s;
        }`
          )
          .join("")}
        .terminal-active [data-oa-terminal] .oa-summary {
          opacity: 0;
          animation: oaFade 1.5s ease forwards ${0.4 + timesheets.length * 0.15 + 0.5}s;
        }
        .terminal-active [data-oa-terminal] .oa-counter {
          opacity: 0;
          animation: oaCountdown 1s ease forwards ${0.4 + timesheets.length * 0.15 + 1}s;
        }
        .terminal-active [data-oa-terminal] .oa-pulse {
          animation: oaPulse 2.5s ease-in-out infinite;
        }
        .terminal-inactive [data-oa-terminal] * {
          opacity: 0 !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .terminal-active [data-oa-terminal] .oa-header,
          .terminal-active [data-oa-terminal] .oa-summary,
          .terminal-active [data-oa-terminal] .oa-counter,
          .terminal-active [data-oa-terminal] [class*="oa-row-"],
          .terminal-active [data-oa-terminal] [class*="oa-strike-"],
          .terminal-active [data-oa-terminal] [class*="oa-divert-"] {
            animation: none;
            opacity: 0.5;
            stroke-dashoffset: 0;
            transform: translateY(0);
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
        {/* Header */}
        <text x="40" y="40" fill="#6da57e" fontFamily="monospace" fontSize="10" letterSpacing="1" className="oa-header">
          AUDIT: SITE_OVERHEADS — PROLONGATION_PERIOD
        </text>
        <text x="40" y="56" fill="#355a42" fontFamily="monospace" fontSize="8" letterSpacing="0.5" className="oa-header">
          CLAIMED_WEEKLY: £85,000 — INTERROGATING_TIMESHEETS...
        </text>

        {/* Column headers */}
        <g className="oa-header">
          <text x="40" y={baseY} fill="#355a42" fontFamily="monospace" fontSize="7" letterSpacing="1">ID</text>
          <text x="130" y={baseY} fill="#355a42" fontFamily="monospace" fontSize="7" letterSpacing="1">RESOURCE</text>
          <text x="320" y={baseY} fill="#355a42" fontFamily="monospace" fontSize="7" letterSpacing="1">ROLE</text>
          <text x="500" y={baseY} fill="#355a42" fontFamily="monospace" fontSize="7" letterSpacing="1">STATUS</text>
          <line x1="40" y1={baseY + 4} x2="650" y2={baseY + 4} stroke="#2d563a" strokeWidth="0.5" />
        </g>

        {/* Timesheet rows */}
        {timesheets.map((ts, i) => {
          const y = baseY + 16 + i * lineHeight;
          return (
            <g key={ts.id} className={`oa-row-${i}`}>
              <text x="40" y={y} fill={ts.diverted ? "#6b2020" : "#355a42"} fontFamily="monospace" fontSize="8" letterSpacing="0.5">
                {ts.id}
              </text>
              <text x="130" y={y} fill={ts.diverted ? "#6b2020" : "#355a42"} fontFamily="monospace" fontSize="8" letterSpacing="0.5">
                {ts.name}
              </text>
              <text x="320" y={y} fill={ts.diverted ? "#6b2020" : "#355a42"} fontFamily="monospace" fontSize="8" letterSpacing="0.5">
                {ts.role}
              </text>
              {ts.diverted ? (
                <>
                  {/* Strike-through */}
                  <line
                    x1="35"
                    y1={y - 3}
                    x2="490"
                    y2={y - 3}
                    stroke="#6b2020"
                    strokeWidth="1"
                    className={`oa-strike-${ts.id}`}
                  />
                  {/* Divert tag */}
                  <text
                    x="500"
                    y={y}
                    fill="#6b2020"
                    fontFamily="monospace"
                    fontSize="8"
                    letterSpacing="0.5"
                    className={`oa-divert-${ts.id}`}
                  >
                    [DIVERTED OFF-SITE]
                  </text>
                </>
              ) : (
                <text x="500" y={y} fill="#2d563a" fontFamily="monospace" fontSize="8" letterSpacing="0.5">
                  VERIFIED
                </text>
              )}
            </g>
          );
        })}

        {/* Divider line */}
        <line
          x1="40"
          y1={baseY + 16 + timesheets.length * lineHeight + 4}
          x2="650"
          y2={baseY + 16 + timesheets.length * lineHeight + 4}
          stroke="#2d563a"
          strokeWidth="0.5"
          className="oa-summary"
        />

        {/* Summary */}
        <text
          x="40"
          y={baseY + 16 + timesheets.length * lineHeight + 22}
          fill="#355a42"
          fontFamily="monospace"
          fontSize="9"
          letterSpacing="1"
          className="oa-summary"
        >
          RESOURCES_DIVERTED: 5/12 (35%)
        </text>

        {/* Counter — final values */}
        <g className="oa-counter">
          <text
            x="40"
            y={baseY + 16 + timesheets.length * lineHeight + 44}
            fill="#355a42"
            fontFamily="monospace"
            fontSize="9"
            letterSpacing="1"
          >
            CLAIMED_WEEKLY: £85,000
          </text>
          <line
            x1="35"
            y1={baseY + 16 + timesheets.length * lineHeight + 44}
            x2="280"
            y2={baseY + 16 + timesheets.length * lineHeight + 44}
            stroke="#6b2020"
            strokeWidth="1"
          />
          <text
            x="300"
            y={baseY + 16 + timesheets.length * lineHeight + 44}
            fill="#c1a679"
            fontFamily="monospace"
            fontSize="10"
            letterSpacing="1"
            className="oa-pulse"
          >
            RECALCULATED: £55,200/WK
          </text>
        </g>

        {/* Overstatement */}
        <text
          x="40"
          y={baseY + 16 + timesheets.length * lineHeight + 64}
          fill="#6b2020"
          fontFamily="monospace"
          fontSize="10"
          letterSpacing="1"
          className="oa-counter"
        >
          OVERSTATEMENT_DETECTED: £1.8M
        </text>
      </svg>
    </div>
  );
}
