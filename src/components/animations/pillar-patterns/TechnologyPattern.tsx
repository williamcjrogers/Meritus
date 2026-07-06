"use client";

/**
 * TechnologyPattern,animated engine/console background for the Technology pillar card.
 * A processing terminal,ingest, classify, link, chronology, flag,with source-linked
 * chips, a blinking cursor, and a scanning bar. Evokes the in-house platform that turns
 * 100GB of raw records into structured, source-linked evidence in hours.
 */
export function TechnologyPattern({ className = "" }: { className?: string }) {
  const logs = [
    { y: 100, label: "ingest", detail: "104.2 GB", stat: "ok" },
    { y: 122, label: "classify", detail: "12,480 docs", stat: "ok" },
    { y: 144, label: "link", detail: "source refs", stat: "ok" },
    { y: 166, label: "chronology", detail: "8,412 events", stat: "ok" },
    { y: 188, label: "flag", detail: "anomalies", stat: "37" },
  ];

  const chips = [
    { y: 112, text: "[SRC·4471]" },
    { y: 148, text: "[SRC·1180]" },
    { y: 184, text: "[SRC·9002]" },
  ];

  return (
    <div
      data-technology-pattern
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes techLineFade {
          0%, 100% { opacity: 0.025; }
          50%      { opacity: 0.065; }
        }
        @keyframes techChipFade {
          0%, 100% { opacity: 0.03; }
          50%      { opacity: 0.06; }
        }
        @keyframes techCursor {
          0%, 45%  { opacity: 0.09; }
          50%, 95% { opacity: 0; }
          100%     { opacity: 0.09; }
        }
        @keyframes techScan {
          0%   { transform: translateY(-24px); opacity: 0; }
          12%  { opacity: 0.05; }
          88%  { opacity: 0.05; }
          100% { transform: translateY(210px); opacity: 0; }
        }
        ${logs.map((_, i) => `
          [data-technology-pattern] .techline-${i} {
            animation: techLineFade ${5.5 + (i % 3) * 0.9}s ease-in-out infinite;
            animation-delay: ${(i * 0.7) % 4}s;
            will-change: opacity;
          }
        `).join("")}
        ${chips.map((_, i) => `
          [data-technology-pattern] .techchip-${i} {
            animation: techChipFade ${6 + i}s ease-in-out infinite;
            animation-delay: ${i * 0.9}s;
            will-change: opacity;
          }
        `).join("")}
        [data-technology-pattern] .tech-cursor { animation: techCursor 1.1s step-end infinite; }
        [data-technology-pattern] .tech-scan { animation: techScan 11s ease-in-out infinite; will-change: transform, opacity; }
        @media (prefers-reduced-motion: reduce) {
          ${logs.map((_, i) => `[data-technology-pattern] .techline-${i},`).join("\n          ")}
          ${chips.map((_, i) => `[data-technology-pattern] .techchip-${i},`).join("\n          ")}
          [data-technology-pattern] .tech-cursor,
          [data-technology-pattern] .tech-scan { animation: none; }
        }
      `}} />

      <svg
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 480 320"
      >
        <g opacity="0.4">
        {/* Console frame */}
        <rect x={24} y={58} width={432} height={204} rx={4} fill="none" stroke="#B5975A" strokeWidth="0.4" opacity="0.08" />
        <line x1={24} y1={78} x2={456} y2={78} stroke="#B5975A" strokeWidth="0.4" opacity="0.07" />

        {/* Title bar */}
        <text x={34} y={72} fill="#B5975A" opacity="0.05" fontFamily="monospace" fontSize="4">
          meritus://engine/matter-2847
        </text>
        <g fill="#B5975A" opacity="0.10">
          <circle cx={430} cy={69} r={1.4} />
          <circle cx={436} cy={69} r={1.4} />
          <circle cx={442} cy={69} r={1.4} />
        </g>

        {/* Log lines,each fades independently */}
        <g fontFamily="monospace" fontSize="4">
          {logs.map((log, i) => (
            <g key={i} className={`techline-${i}`} fill="#B5975A">
              <text x={36} y={log.y} opacity="0.9">&gt;</text>
              <text x={46} y={log.y}>{log.label}</text>
              <text x={118} y={log.y} opacity="0.7">{log.detail}</text>
              <line x1={196} y1={log.y - 1.4} x2={296} y2={log.y - 1.4} stroke="#B5975A" strokeWidth="0.5" strokeDasharray="1 2.5" opacity="0.4" />
              <text x={302} y={log.y} opacity="0.85">{log.stat}</text>
            </g>
          ))}
        </g>

        {/* Blinking cursor on the next prompt line */}
        <rect className="tech-cursor" x={36} y={203} width={5} height={6} fill="#B5975A" />

        {/* Source-linked chips,the audit trail that resolves every figure to a document */}
        <g fontFamily="monospace" fontSize="3.6">
          {chips.map((chip, i) => (
            <text key={i} className={`techchip-${i}`} x={352} y={chip.y} fill="#B5975A">
              {chip.text}
            </text>
          ))}
        </g>

        {/* Scanning band sweeping the console */}
        <rect className="tech-scan" x={26} y={80} width={428} height={16} fill="#B5975A" opacity="0.03" rx={2} />

        {/* Code glyph watermark */}
        <text x={240} y={252} fill="#B5975A" opacity="0.03" fontFamily="monospace" fontSize="52" textAnchor="middle" fontWeight="bold">
          {"</>"}
        </text>
        </g>
      </svg>
    </div>
  );
}
