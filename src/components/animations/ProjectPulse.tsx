"use client";

/**
 * ProjectPulse,decorative P6-style programme background.
 * Dense rows of thin bars with vertical grid lines, milestone diamonds,
 * and link lines. Barely visible watermark behind green sections.
 *
 * Four activity groups mirror the four service disciplines:
 *   - Delay (programme bars with extensions)
 *   - Quantum (cost-weighted bars)
 *   - Technical (investigation bars)
 *   - Advisory (short advisory/meeting bars)
 */
export function ProjectPulse({ className = "" }: { className?: string }) {
  const rowH = 14;
  const barH = 3;
  const startY = 20;

  // Row definitions: x-start, width, optional delay-extension width, and activity label
  // Modelled on a real P6 layout,staggered starts, varying durations
  const rows = [
    // ── Delay analysis activities ──
    { x: 60,  w: 280, delay: 45, label: "Baseline Programme Review" },
    { x: 100, w: 180, delay: 30, label: "As-Planned vs As-Built" },
    { x: 140, w: 320, delay: 60, label: "TIA \u2014 CE-047" },
    { x: 80,  w: 220, delay: 0,  label: "Critical Path Interrogation" },
    { x: 200, w: 160, delay: 25, label: "Float Consumption Analysis" },
    { x: 160, w: 400, delay: 80, label: "Concurrent Delay Assessment" },
    { x: 120, w: 140, delay: 0,  label: "Delay Narrative \u2014 Draft" },
    { x: 260, w: 200, delay: 35, label: "Programme Logic Audit" },
    // ── Quantum / cost activities ──
    { x: 340, w: 180, delay: 0, label: "Measured Works Valuation" },
    { x: 300, w: 260, delay: 0, label: "Head Office Overheads (Emden)" },
    { x: 380, w: 120, delay: 0, label: "Prolongation Cost Model" },
    { x: 320, w: 300, delay: 0, label: "Final Account Reconciliation" },
    { x: 400, w: 160, delay: 0, label: "Variation Assessment \u2014 Batch 3" },
    { x: 360, w: 220, delay: 0, label: "Loss of Productivity Analysis" },
    // ── Technical / investigation ──
    { x: 500, w: 240, delay: 0, label: "Fire Strategy Compliance \u2014 L08" },
    { x: 540, w: 160, delay: 0, label: "Curtain Wall Detail \u2014 Rev C" },
    { x: 480, w: 320, delay: 0, label: "Cladding Remediation Scope" },
    { x: 560, w: 200, delay: 0, label: "M&E Performance Testing" },
    { x: 520, w: 140, delay: 0, label: "Specification Review \u2014 Cl. 4.3.2" },
    { x: 580, w: 260, delay: 0, label: "Building Envelope Assessment" },
    // ── Advisory / short activities ──
    { x: 700, w: 80,  delay: 0, label: "Merits Assessment \u2014 Draft" },
    { x: 740, w: 60,  delay: 0, label: "Position Paper \u2014 Quantum" },
    { x: 680, w: 100, delay: 0, label: "Evidence Architecture" },
    { x: 760, w: 70,  delay: 0, label: "Mediation Preparation" },
    { x: 720, w: 90,  delay: 0, label: "Jurisdictional Analysis" },
    { x: 750, w: 50,  delay: 0, label: "Referral Strategy \u2014 Day 3" },
    { x: 690, w: 110, delay: 0, label: "Adj. Response \u2014 Day 14" },
    { x: 780, w: 60,  delay: 0, label: "Enforcement Proceedings" },
    // ── More delay/programme rows to fill density ──
    { x: 180, w: 240, delay: 40, label: "EoT Claim \u2014 Period 3" },
    { x: 220, w: 300, delay: 55, label: "As-Built Logic Review" },
    { x: 100, w: 200, delay: 20, label: "Delay Recovery Analysis" },
    { x: 300, w: 180, delay: 0,  label: "Resource Histogram Review" },
    { x: 140, w: 260, delay: 35, label: "Planned vs Actual \u2014 Pkg 7" },
    { x: 240, w: 340, delay: 70, label: "Programme Re-Baseline" },
    { x: 160, w: 150, delay: 0,  label: "Fragnet Analysis" },
    { x: 280, w: 200, delay: 25, label: "Data Date Progression" },
  ];

  // WBS section headers,positioned above each activity group
  const wbsHeaders = [
    { label: "1.0  PROGRAMME & DELAY", row: 0 },
    { label: "2.0  QUANTUM & VALUATION", row: 8 },
    { label: "3.0  TECHNICAL INVESTIGATION", row: 14 },
    { label: "4.0  DISPUTE ADVISORY", row: 20 },
    { label: "1.1  PROGRAMME & DELAY (CONT.)", row: 28 },
  ];

  // Milestone diamonds at key positions
  const milestones = [
    { x: 340, row: 3 },
    { x: 560, row: 8 },
    { x: 740, row: 13 },
    { x: 460, row: 18 },
    { x: 620, row: 23 },
    { x: 300, row: 28 },
    { x: 800, row: 33 },
  ];

  // Vertical grid lines (monthly columns)
  const gridLines = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100];

  const totalH = startY + rows.length * rowH + 20;

  return (
    <div
      data-project-pulse
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      {/* Injected so animations always run (Tailwind v4 can purge global keyframes) */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes programmeDrift {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-120px); }
        }
        @keyframes dateDatePulse {
          0%, 100% { opacity: 0.08; }
          50%      { opacity: 0.22; }
        }
        @keyframes programmeGlow {
          0%, 100% { opacity: 0.85; }
          50%      { opacity: 1; }
        }
        [data-project-pulse] .programme-drift {
          animation: programmeDrift 22s linear infinite;
          will-change: transform;
        }
        [data-project-pulse] .programme-layer {
          animation: programmeGlow 8s ease-in-out infinite;
          will-change: opacity;
        }
        [data-project-pulse] .data-date-pulse {
          animation: dateDatePulse 3.2s ease-in-out infinite;
          will-change: opacity;
        }
        @media (prefers-reduced-motion: reduce) {
          [data-project-pulse] .programme-drift,
          [data-project-pulse] .programme-layer,
          [data-project-pulse] .data-date-pulse { animation: none; }
        }
      `}} />
      <svg
        className="absolute inset-0 w-full h-full programme-drift"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        viewBox={`0 0 1200 ${totalH}`}
      >
        {/* Vertical grid,faint monthly columns */}
        <g stroke="#B5975A" strokeWidth="0.5" opacity="0.04">
          {gridLines.map((x) => (
            <line key={x} x1={x} y1={0} x2={x} y2={totalH} />
          ))}
        </g>

        {/* Horizontal row lines - like P6 row separators */}
        <g stroke="#B5975A" strokeWidth="0.3" opacity="0.02">
          {rows.map((_, i) => {
            const y = startY + i * rowH;
            return <line key={i} x1={0} y1={y} x2={1200} y2={y} />;
          })}
        </g>

        {/* Programme bars */}
        <g className="programme-layer">
          {rows.map((row, i) => {
            const y = startY + i * rowH + (rowH - barH) / 2;
            return (
              <g key={i}>
                {/* Main activity bar */}
                <rect
                  x={row.x}
                  y={y}
                  width={row.w}
                  height={barH}
                  fill="#B5975A"
                  opacity="0.06"
                />
                {/* Delay extension - slightly different tone */}
                {row.delay > 0 && (
                  <rect
                    x={row.x + row.w}
                    y={y}
                    width={row.delay}
                    height={barH}
                    fill="#F5F0E8"
                    opacity="0.04"
                  />
                )}
              </g>
            );
          })}
        </g>

        {/* Milestone diamonds */}
        <g fill="#B5975A" opacity="0.08">
          {milestones.map((m, i) => {
            const cy = startY + m.row * rowH + rowH / 2;
            return (
              <polygon
                key={i}
                points={`${m.x},${cy - 3.5} ${m.x + 3.5},${cy} ${m.x},${cy + 3.5} ${m.x - 3.5},${cy}`}
              />
            );
          })}
        </g>

        {/* Link lines - finish-to-start connections */}
        <g stroke="#B5975A" strokeWidth="0.5" opacity="0.03" fill="none">
          {[
            [0, 1], [1, 2], [2, 4], [4, 5], [5, 7],
            [8, 9], [9, 11], [11, 13],
            [14, 15], [15, 17], [17, 19],
            [20, 21], [21, 23], [24, 25],
            [28, 29], [30, 32], [33, 35],
          ].map(([from, to], i) => {
            if (!rows[from] || !rows[to]) return null;
            const fromY = startY + from * rowH + rowH / 2;
            const toY = startY + to * rowH + rowH / 2;
            const fromX = rows[from].x + rows[from].w;
            const toX = rows[to].x;
            const midX = fromX + 6;
            return (
              <path
                key={i}
                d={`M${fromX},${fromY} H${midX} V${toY} H${toX}`}
              />
            );
          })}
        </g>

        {/* WBS section headers - like P6 summary rows */}
        <g fill="#B5975A" opacity="0.055" fontFamily="monospace" fontSize="3.5" fontWeight="bold">
          {wbsHeaders.map((h, i) => {
            const y = startY + h.row * rowH - 3;
            return (
              <text key={i} x={12} y={y}>{h.label}</text>
            );
          })}
        </g>

        {/* Activity labels - like P6 activity descriptions */}
        <g fill="#B5975A" opacity="0.05" fontFamily="monospace" fontSize="3">
          {rows.map((row, i) => {
            const y = startY + i * rowH + rowH / 2 + 1;
            return (
              <text key={i} x={row.x - 2} y={y} textAnchor="end">{row.label}</text>
            );
          })}
        </g>

        {/* Data date line,single vertical */}
        <line
          x1={620} y1={0} x2={620} y2={totalH}
          stroke="#B5975A" strokeWidth="1" opacity="0.09"
          strokeDasharray="3 6"
          className="data-date-pulse"
        />
      </svg>
    </div>
  );
}
