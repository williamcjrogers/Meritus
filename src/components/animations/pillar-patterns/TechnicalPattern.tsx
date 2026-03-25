"use client";

/**
 * TechnicalPattern — animated construction section drawing for the Technical pillar card.
 * Wall section with cross-hatching, dimension lines, annotation callouts, and ground line.
 */
export function TechnicalPattern({ className = "" }: { className?: string }) {
  // Hatching lines between the wall faces (45-degree cross-section fill)
  const hatchLines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  for (let i = 0; i < 22; i++) {
    const y = 30 + i * 14;
    hatchLines.push({ x1: 142, y1: y, x2: 198, y2: y + 10 });
  }

  return (
    <div
      data-technical-pattern
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes hatchDrift {
          0%   { transform: translate(0, 0); }
          100% { transform: translate(5px, 5px); }
        }
        @keyframes dimensionPulse {
          0%, 100% { opacity: 0.06; }
          50%      { opacity: 0.14; }
        }
        @keyframes annotationPing {
          0%, 100% { transform: scale(1); opacity: 0.07; }
          50%      { transform: scale(1.08); opacity: 0.12; }
        }
        [data-technical-pattern] .hatch-group {
          animation: hatchDrift 12s ease-in-out infinite alternate;
          will-change: transform;
        }
        [data-technical-pattern] .dim-line {
          animation: dimensionPulse 5s ease-in-out infinite;
          will-change: opacity;
        }
        [data-technical-pattern] .anno-0 {
          animation: annotationPing 7s ease-in-out infinite;
          animation-delay: 0s;
        }
        [data-technical-pattern] .anno-1 {
          animation: annotationPing 7s ease-in-out infinite;
          animation-delay: 2.3s;
        }
        [data-technical-pattern] .anno-2 {
          animation: annotationPing 7s ease-in-out infinite;
          animation-delay: 4.6s;
        }
        @media (prefers-reduced-motion: reduce) {
          [data-technical-pattern] .hatch-group,
          [data-technical-pattern] .dim-line,
          [data-technical-pattern] .anno-0,
          [data-technical-pattern] .anno-1,
          [data-technical-pattern] .anno-2 { animation: none; }
        }
      `}} />

      <svg
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 480 320"
      >
        {/* Ground line */}
        <line x1={0} y1={275} x2={480} y2={275} stroke="#B5975A" strokeWidth="0.8" opacity="0.08" />

        {/* Ground hatching below ground line */}
        <g stroke="#B5975A" strokeWidth="0.3" opacity="0.04">
          {Array.from({ length: 30 }, (_, i) => {
            const x = 10 + i * 16;
            return <line key={i} x1={x} y1={275} x2={x - 8} y2={290} />;
          })}
        </g>

        {/* Wall face — left */}
        <line x1={140} y1={25} x2={140} y2={275} stroke="#B5975A" strokeWidth="1.2" opacity="0.09" />
        {/* Wall face — right */}
        <line x1={200} y1={25} x2={200} y2={275} stroke="#B5975A" strokeWidth="1.2" opacity="0.09" />

        {/* Wall top cap */}
        <line x1={135} y1={25} x2={205} y2={25} stroke="#B5975A" strokeWidth="0.6" opacity="0.07" />

        {/* Cross-hatching between walls — drifts */}
        <g className="hatch-group" stroke="#B5975A" strokeWidth="0.35" opacity="0.06">
          {hatchLines.map((l, i) => (
            <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
          ))}
        </g>

        {/* Internal detail — rebar dots */}
        <g fill="#B5975A" opacity="0.06">
          <circle cx={155} cy={60} r="2" />
          <circle cx={185} cy={60} r="2" />
          <circle cx={155} cy={150} r="2" />
          <circle cx={185} cy={150} r="2" />
          <circle cx={155} cy={240} r="2" />
          <circle cx={185} cy={240} r="2" />
        </g>

        {/* Dimension line — right side, pulsing */}
        <g className="dim-line" stroke="#B5975A" strokeWidth="0.4" fill="#B5975A">
          {/* Vertical dimension line */}
          <line x1={230} y1={50} x2={230} y2={250} />
          {/* Top tick */}
          <line x1={225} y1={50} x2={235} y2={50} />
          {/* Bottom tick */}
          <line x1={225} y1={250} x2={235} y2={250} />
          {/* Label */}
          <text x={238} y={152} fontFamily="monospace" fontSize="4" opacity="0.10">450mm</text>
        </g>

        {/* Horizontal dimension — wall thickness */}
        <g className="dim-line" stroke="#B5975A" strokeWidth="0.3" fill="#B5975A">
          <line x1={140} y1={15} x2={200} y2={15} />
          <line x1={140} y1={12} x2={140} y2={18} />
          <line x1={200} y1={12} x2={200} y2={18} />
          <text x={160} y={12} fontFamily="monospace" fontSize="3" opacity="0.08">200</text>
        </g>

        {/* Annotation callouts */}
        <g fill="none" stroke="#B5975A" strokeWidth="0.5">
          {/* Callout 1 — wall construction */}
          <g className="anno-0">
            <circle cx={290} cy={80} r="6" />
            <line x1={284} y1={80} x2={205} y2={80} strokeDasharray="2 3" />
            <text x={290} y={82} textAnchor="middle" fill="#B5975A" fontFamily="monospace" fontSize="4">A</text>
          </g>
          {/* Callout 2 — foundation detail */}
          <g className="anno-1">
            <circle cx={310} cy={180} r="6" />
            <line x1={304} y1={180} x2={205} y2={180} strokeDasharray="2 3" />
            <text x={310} y={182} textAnchor="middle" fill="#B5975A" fontFamily="monospace" fontSize="4">B</text>
          </g>
          {/* Callout 3 — damp-proof course */}
          <g className="anno-2">
            <circle cx={80} cy={260} r="6" />
            <line x1={86} y1={260} x2={135} y2={260} strokeDasharray="2 3" />
            <text x={80} y={262} textAnchor="middle" fill="#B5975A" fontFamily="monospace" fontSize="4">C</text>
          </g>
        </g>

        {/* DPC layer line */}
        <line x1={135} y1={260} x2={205} y2={260} stroke="#B5975A" strokeWidth="0.6" opacity="0.06" strokeDasharray="4 2" />

        {/* Second wall section — right side, smaller */}
        <line x1={340} y1={80} x2={340} y2={275} stroke="#B5975A" strokeWidth="0.8" opacity="0.06" />
        <line x1={380} y1={80} x2={380} y2={275} stroke="#B5975A" strokeWidth="0.8" opacity="0.06" />
        <line x1={335} y1={80} x2={385} y2={80} stroke="#B5975A" strokeWidth="0.4" opacity="0.05" />

        {/* Hatching for second wall */}
        <g stroke="#B5975A" strokeWidth="0.25" opacity="0.04">
          {Array.from({ length: 14 }, (_, i) => {
            const y = 85 + i * 14;
            return <line key={i} x1={342} y1={y} x2={378} y2={y + 8} />;
          })}
        </g>

        {/* Section title */}
        <text x={170} y={305} textAnchor="middle" fill="#B5975A" opacity="0.06" fontFamily="monospace" fontSize="3.5">
          SECTION A-A  1:20
        </text>
      </svg>
    </div>
  );
}
