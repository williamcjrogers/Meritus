"use client";

/**
 * ProjectPulse — decorative P6-style programme background.
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

  // Row definitions: x-start, width, and optional delay-extension width
  // Modelled on a real P6 layout — staggered starts, varying durations
  const rows = [
    // ── Delay analysis activities ──
    { x: 60,  w: 280, delay: 45 },
    { x: 100, w: 180, delay: 30 },
    { x: 140, w: 320, delay: 60 },
    { x: 80,  w: 220, delay: 0 },
    { x: 200, w: 160, delay: 25 },
    { x: 160, w: 400, delay: 80 },
    { x: 120, w: 140, delay: 0 },
    { x: 260, w: 200, delay: 35 },
    // ── Quantum / cost activities ──
    { x: 340, w: 180, delay: 0 },
    { x: 300, w: 260, delay: 0 },
    { x: 380, w: 120, delay: 0 },
    { x: 320, w: 300, delay: 0 },
    { x: 400, w: 160, delay: 0 },
    { x: 360, w: 220, delay: 0 },
    // ── Technical / investigation ──
    { x: 500, w: 240, delay: 0 },
    { x: 540, w: 160, delay: 0 },
    { x: 480, w: 320, delay: 0 },
    { x: 560, w: 200, delay: 0 },
    { x: 520, w: 140, delay: 0 },
    { x: 580, w: 260, delay: 0 },
    // ── Advisory / short activities ──
    { x: 700, w: 80,  delay: 0 },
    { x: 740, w: 60,  delay: 0 },
    { x: 680, w: 100, delay: 0 },
    { x: 760, w: 70,  delay: 0 },
    { x: 720, w: 90,  delay: 0 },
    { x: 750, w: 50,  delay: 0 },
    { x: 690, w: 110, delay: 0 },
    { x: 780, w: 60,  delay: 0 },
    // ── More delay/programme rows to fill density ──
    { x: 180, w: 240, delay: 40 },
    { x: 220, w: 300, delay: 55 },
    { x: 100, w: 200, delay: 20 },
    { x: 300, w: 180, delay: 0 },
    { x: 140, w: 260, delay: 35 },
    { x: 240, w: 340, delay: 70 },
    { x: 160, w: 150, delay: 0 },
    { x: 280, w: 200, delay: 25 },
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
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <svg
        className="absolute inset-0 w-full h-full programme-drift"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        viewBox={`0 0 1200 ${totalH}`}
      >
        {/* Vertical grid — faint monthly columns */}
        <g stroke="#B5975A" strokeWidth="0.5" opacity="0.025">
          {gridLines.map((x) => (
            <line key={x} x1={x} y1={0} x2={x} y2={totalH} />
          ))}
        </g>

        {/* Horizontal row lines — like P6 row separators */}
        <g stroke="#B5975A" strokeWidth="0.3" opacity="0.015">
          {rows.map((_, i) => {
            const y = startY + i * rowH;
            return <line key={i} x1={0} y1={y} x2={1200} y2={y} />;
          })}
        </g>

        {/* Programme bars */}
        <g>
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
                  opacity="0.035"
                />
                {/* Delay extension — slightly different tone */}
                {row.delay > 0 && (
                  <rect
                    x={row.x + row.w}
                    y={y}
                    width={row.delay}
                    height={barH}
                    fill="#F5F0E8"
                    opacity="0.02"
                  />
                )}
              </g>
            );
          })}
        </g>

        {/* Milestone diamonds */}
        <g fill="#B5975A" opacity="0.04">
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

        {/* Link lines — finish-to-start connections */}
        <g stroke="#B5975A" strokeWidth="0.5" opacity="0.02" fill="none">
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

        {/* Data date line — single vertical */}
        <line
          x1={620} y1={0} x2={620} y2={totalH}
          stroke="#B5975A" strokeWidth="0.8" opacity="0.03"
          strokeDasharray="3 6"
          className="data-date-pulse"
        />
      </svg>
    </div>
  );
}
