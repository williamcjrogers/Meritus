"use client";

/**
 * QuantumPattern,animated ledger / spreadsheet background for the Quantum pillar card.
 * Grid lines, currency values, and bar-chart fragments that shimmer gently.
 */
export function QuantumPattern({ className = "" }: { className?: string }) {
  const cells = [
    { x: 95,  y: 72,  text: "1,247,830" },
    { x: 195, y: 72,  text: "892,445" },
    { x: 295, y: 72,  text: "355,385" },
    { x: 95,  y: 102, text: "3,614,200" },
    { x: 195, y: 102, text: "2,170,000" },
    { x: 295, y: 102, text: "1,444,200" },
    { x: 95,  y: 132, text: "764,500" },
    { x: 195, y: 132, text: "510,300" },
    { x: 295, y: 132, text: "254,200" },
    { x: 95,  y: 162, text: "2,891,000" },
    { x: 195, y: 162, text: "1,935,600" },
    { x: 295, y: 162, text: "955,400" },
    { x: 95,  y: 192, text: "445,750" },
    { x: 195, y: 192, text: "298,400" },
    { x: 295, y: 192, text: "147,350" },
    { x: 95,  y: 222, text: "1,128,600" },
    { x: 195, y: 222, text: "780,200" },
    { x: 295, y: 222, text: "348,400" },
  ];

  // Bar chart values (heights) for the right column
  const bars = [
    { x: 370, h: 40 },
    { x: 385, h: 62 },
    { x: 400, h: 28 },
    { x: 415, h: 55 },
    { x: 430, h: 35 },
    { x: 445, h: 48 },
  ];

  return (
    <div
      data-quantum-pattern
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes quantumShimmer {
          0%, 100% { opacity: 0.05; }
          50%      { opacity: 0.12; }
        }
        @keyframes quantumSweep {
          0%   { transform: translateX(-60px); }
          100% { transform: translateX(480px); }
        }
        ${cells.map((_, i) => `
          [data-quantum-pattern] .qcell-${i} {
            animation: quantumShimmer ${6 + (i % 4) * 0.8}s ease-in-out infinite;
            animation-delay: ${(i * 0.6) % 5}s;
            will-change: opacity;
          }
        `).join("")}
        [data-quantum-pattern] .quantum-sweep {
          animation: quantumSweep 14s ease-in-out infinite;
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          ${cells.map((_, i) => `[data-quantum-pattern] .qcell-${i},`).join("\n          ")}
          [data-quantum-pattern] .quantum-sweep { animation: none; }
        }
      `}} />

      <svg
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 480 320"
      >
        {/* Column headers */}
        <g fill="#B5975A" opacity="0.08" fontFamily="monospace" fontSize="3.5" fontWeight="bold">
          <text x="14" y="48">Item</text>
          <text x="95" y="48">Claimed (£)</text>
          <text x="195" y="48">Assessed (£)</text>
          <text x="295" y="48">Difference</text>
          <text x="380" y="48">Quantum</text>
        </g>

        {/* Row labels */}
        <g fill="#B5975A" opacity="0.06" fontFamily="monospace" fontSize="3.2">
          <text x="14" y="72">Prelims</text>
          <text x="14" y="102">Measured Wks</text>
          <text x="14" y="132">Variations</text>
          <text x="14" y="162">Prolongation</text>
          <text x="14" y="192">Loss &amp; Expense</text>
          <text x="14" y="222">Final Account</text>
        </g>

        {/* Grid lines,horizontal */}
        <g stroke="#B5975A" strokeWidth="0.3" opacity="0.06">
          <line x1={10} y1={55} x2={470} y2={55} strokeWidth="0.6" />
          {[85, 115, 145, 175, 205, 235].map(y => (
            <line key={y} x1={10} y1={y} x2={355} y2={y} />
          ))}
          {/* Totals row,thicker */}
          <line x1={10} y1={245} x2={355} y2={245} strokeWidth="0.6" />
        </g>

        {/* Grid lines,vertical */}
        <g stroke="#B5975A" strokeWidth="0.3" opacity="0.05">
          {[80, 180, 280, 355].map(x => (
            <line key={x} x1={x} y1={40} x2={x} y2={250} />
          ))}
        </g>

        {/* Currency values,each shimmers independently */}
        {cells.map((cell, i) => (
          <text
            key={i}
            className={`qcell-${i}`}
            x={cell.x}
            y={cell.y}
            fill="#B5975A"
            fontFamily="monospace"
            fontSize="3.5"
            textAnchor="start"
          >
            {cell.text}
          </text>
        ))}

        {/* Totals row */}
        <g fill="#B5975A" opacity="0.10" fontFamily="monospace" fontSize="3.5" fontWeight="bold">
          <text x="14"  y="258">TOTAL</text>
          <text x="95"  y="258">10,091,880</text>
          <text x="195" y="258">6,586,945</text>
          <text x="295" y="258">3,504,935</text>
        </g>

        {/* Pound symbol watermark */}
        <text x="240" y="290" fill="#B5975A" opacity="0.03" fontFamily="serif" fontSize="60" textAnchor="middle">£</text>

        {/* Bar chart fragment */}
        <g fill="#B5975A" opacity="0.07">
          {bars.map((bar, i) => (
            <rect
              key={i}
              x={bar.x}
              y={250 - bar.h}
              width="10"
              height={bar.h}
              rx="0.5"
            />
          ))}
        </g>
        {/* Bar chart baseline */}
        <line x1={365} y1={250} x2={460} y2={250} stroke="#B5975A" strokeWidth="0.4" opacity="0.06" />

        {/* Sweep highlight,faint column scanner */}
        <rect
          className="quantum-sweep"
          x={0} y={40}
          width="30" height="215"
          fill="#B5975A" opacity="0.02"
          rx="2"
        />
      </svg>
    </div>
  );
}
