"use client";

/**
 * AdvisoryPattern,animated legal document background for the Advisory pillar card.
 * Document outline with clause numbers, paragraph lines, seal/stamp, and a scanning highlight.
 */
export function AdvisoryPattern({ className = "" }: { className?: string }) {
  // Paragraph lines,varying lengths for natural document feel
  const paragraphs = [
    // Clause 4.1
    { y: 68, lines: [280, 280, 280, 210] },
    // Clause 4.2
    { y: 110, lines: [280, 280, 180] },
    // Clause 4.3
    { y: 145, lines: [280, 280, 280, 280, 240] },
    // Clause 4.4
    { y: 195, lines: [280, 280, 160] },
    // Clause 4.5
    { y: 230, lines: [280, 280, 280, 200] },
  ];

  const clauses = ["4.1", "4.2", "4.3", "4.4", "4.5"];

  return (
    <div
      data-advisory-pattern
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes sealPulse {
          0%, 100% { opacity: 0.05; transform: rotate(0deg); }
          50%      { opacity: 0.12; transform: rotate(3deg); }
        }
        @keyframes advisoryScan {
          0%   { transform: translateY(-10px); opacity: 0; }
          10%  { opacity: 0.03; }
          90%  { opacity: 0.03; }
          100% { transform: translateY(260px); opacity: 0; }
        }
        @keyframes clauseFade {
          0%, 100% { opacity: 0.05; }
          50%      { opacity: 0.10; }
        }
        [data-advisory-pattern] .seal-mark {
          animation: sealPulse 6s ease-in-out infinite;
          transform-origin: center;
          will-change: opacity, transform;
        }
        [data-advisory-pattern] .scan-bar {
          animation: advisoryScan 12s ease-in-out infinite;
          will-change: transform, opacity;
        }
        ${clauses.map((_, i) => `
          [data-advisory-pattern] .clause-${i} {
            animation: clauseFade 8s ease-in-out infinite;
            animation-delay: ${i * 1.2}s;
            will-change: opacity;
          }
        `).join("")}
        @media (prefers-reduced-motion: reduce) {
          [data-advisory-pattern] .seal-mark,
          [data-advisory-pattern] .scan-bar,
          ${clauses.map((_, i) => `[data-advisory-pattern] .clause-${i}${i < clauses.length - 1 ? "," : ""}`).join("\n          ")}
          { animation: none; }
        }
      `}} />

      <svg
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 480 320"
      >
        {/* Document outline,main page */}
        <rect x={70} y={20} width={320} height={280} rx="1"
          stroke="#B5975A" strokeWidth="0.6" fill="none" opacity="0.06" />

        {/* Page fold corner */}
        <path d="M370,20 L390,20 L390,40 Z" stroke="#B5975A" strokeWidth="0.4" fill="none" opacity="0.05" />
        <line x1={370} y1={20} x2={370} y2={40} stroke="#B5975A" strokeWidth="0.4" opacity="0.05" />
        <line x1={370} y1={40} x2={390} y2={40} stroke="#B5975A" strokeWidth="0.4" opacity="0.05" />

        {/* Document title area */}
        <g fill="#B5975A" opacity="0.07" fontFamily="monospace" fontSize="4" fontWeight="bold">
          <text x={230} y={42} textAnchor="middle">ADJUDICATOR&apos;S REFERRAL</text>
        </g>
        <line x1={130} y1={48} x2={330} y2={48} stroke="#B5975A" strokeWidth="0.4" opacity="0.06" />

        {/* Clause numbers,stagger-fade */}
        {clauses.map((clause, i) => (
          <text
            key={i}
            className={`clause-${i}`}
            x={85}
            y={paragraphs[i].y}
            fill="#B5975A"
            fontFamily="monospace"
            fontSize="3.5"
            fontWeight="bold"
          >
            {clause}
          </text>
        ))}

        {/* Paragraph lines */}
        <g stroke="#B5975A" strokeWidth="0.3" opacity="0.05">
          {paragraphs.map((para, pi) =>
            para.lines.map((w, li) => {
              const y = para.y + li * 8;
              return (
                <line key={`${pi}-${li}`} x1={110} y1={y} x2={110 + w} y2={y} />
              );
            })
          )}
        </g>

        {/* Signature line */}
        <g stroke="#B5975A" opacity="0.06">
          <line x1={250} y1={272} x2={370} y2={272} strokeWidth="0.5" />
          {/* Squiggle signature */}
          <path
            d="M260,268 Q270,260 280,266 Q290,272 300,264 Q310,256 320,265 Q325,268 330,266"
            strokeWidth="0.4" fill="none" opacity="0.8"
          />
        </g>
        <text x={310} y={282} textAnchor="middle" fill="#B5975A" opacity="0.05" fontFamily="monospace" fontSize="2.8">
          Authorised Signatory
        </text>

        {/* Seal / stamp mark,pulses and rotates */}
        <g className="seal-mark">
          <circle cx={370} cy={250} r="22" stroke="#B5975A" strokeWidth="0.6" fill="none" />
          <circle cx={370} cy={250} r="18" stroke="#B5975A" strokeWidth="0.3" fill="none" />
          <text x={370} y={248} textAnchor="middle" fill="#B5975A" fontFamily="serif" fontSize="5" fontWeight="bold">
            MERITUS VIA
          </text>
          <text x={370} y={256} textAnchor="middle" fill="#B5975A" fontFamily="monospace" fontSize="2.5">
            LLP
          </text>
          {/* Star in centre */}
          <polygon
            points="370,236 371.5,240 376,240 372.5,243 374,247 370,244.5 366,247 367.5,243 364,240 368.5,240"
            fill="#B5975A" opacity="0.6"
          />
        </g>

        {/* Date stamp */}
        <text x={120} y={282} fill="#B5975A" opacity="0.05" fontFamily="monospace" fontSize="3">
          Date: _______________
        </text>

        {/* Scanning highlight bar */}
        <rect
          className="scan-bar"
          x={75} y={30}
          width="310" height="6"
          fill="#B5975A" rx="1"
        />

        {/* Second document peeking behind,depth effect */}
        <rect x={78} y={25} width={320} height={280} rx="1"
          stroke="#B5975A" strokeWidth="0.3" fill="none" opacity="0.03" />
      </svg>
    </div>
  );
}
