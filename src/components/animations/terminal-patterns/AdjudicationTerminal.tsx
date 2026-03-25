"use client";

/**
 * AdjudicationTerminal — Minimalist horizontal timeline showing the
 * 28-day adjudication sprint. Nodes appear sequentially on scroll.
 */
export function AdjudicationTerminal({
  className = "",
}: {
  className?: string;
}) {
  const milestones = [
    { x: 100, day: "DAY_01", label: "INSTRUCT", gold: false },
    { x: 200, day: "DAY_03", label: "INGEST_CLASSIFY", gold: false },
    { x: 340, day: "DAY_07", label: "EXPERT_PAPER", gold: false },
    { x: 520, day: "DAY_21", label: "SUBMISSION", gold: false },
    { x: 700, day: "DAY_28", label: "DECISION_FAVOUR", gold: true },
  ];

  return (
    <div
      data-adj-terminal
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes atDraw {
          from { stroke-dashoffset: 800; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes atFade {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes atPulse {
          0%, 100% { opacity: 0.3; }
          50%      { opacity: 1; }
        }
        @keyframes atGlow {
          0%, 100% { opacity: 0; }
          50%      { opacity: 0.3; }
        }
        .terminal-active [data-adj-terminal] .at-line {
          stroke-dasharray: 800;
          stroke-dashoffset: 800;
          animation: atDraw 2s cubic-bezier(0.4, 0, 0.2, 1) forwards 0.3s;
          will-change: stroke-dashoffset;
        }
        .terminal-active [data-adj-terminal] .at-node-0 {
          opacity: 0; animation: atFade 0.6s ease forwards 1s;
        }
        .terminal-active [data-adj-terminal] .at-node-1 {
          opacity: 0; animation: atFade 0.6s ease forwards 1.4s;
        }
        .terminal-active [data-adj-terminal] .at-node-2 {
          opacity: 0; animation: atFade 0.6s ease forwards 1.8s;
        }
        .terminal-active [data-adj-terminal] .at-node-3 {
          opacity: 0; animation: atFade 0.6s ease forwards 2.2s;
        }
        .terminal-active [data-adj-terminal] .at-node-4 {
          opacity: 0; animation: atFade 0.6s ease forwards 2.6s;
        }
        .terminal-active [data-adj-terminal] .at-pulse {
          animation: atPulse 2s ease-in-out infinite;
        }
        .terminal-active [data-adj-terminal] .at-glow {
          animation: atGlow 3s ease-in-out infinite;
        }
        .terminal-active [data-adj-terminal] .at-grid {
          opacity: 0; animation: atFade 2s ease forwards 0.2s;
        }
        .terminal-inactive [data-adj-terminal] * {
          opacity: 0 !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .terminal-active [data-adj-terminal] .at-line,
          .terminal-active [data-adj-terminal] .at-node-0,
          .terminal-active [data-adj-terminal] .at-node-1,
          .terminal-active [data-adj-terminal] .at-node-2,
          .terminal-active [data-adj-terminal] .at-node-3,
          .terminal-active [data-adj-terminal] .at-node-4,
          .terminal-active [data-adj-terminal] .at-pulse,
          .terminal-active [data-adj-terminal] .at-glow,
          .terminal-active [data-adj-terminal] .at-grid {
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
        <g className="at-grid">
          {/* subtle dots */}
          <circle cx="200" cy="150" r="1.5" fill="#355a42" />
          <circle cx="600" cy="150" r="1.5" fill="#355a42" />
          <circle cx="200" cy="250" r="1.5" fill="#355a42" />
          <circle cx="600" cy="250" r="1.5" fill="#355a42" />
          
          <line x1="200" y1="150" x2="600" y2="150" stroke="#355a42" strokeWidth="0.5" strokeDasharray="2 4" />
          <line x1="200" y1="250" x2="600" y2="250" stroke="#355a42" strokeWidth="0.5" strokeDasharray="2 4" />
        </g>

        {/* Central Hexagon symbolising the Partner / Expert */}
        <g className="at-node-2" transform="translate(400, 200)">
          <polygon 
            points="0,-40 34.6,-20 34.6,20 0,40 -34.6,20 -34.6,-20" 
            fill="none" 
            stroke="#c1a679" 
            strokeWidth="1.5" 
          />
          <circle cx="0" cy="0" r="4" fill="#c1a679" className="at-pulse" />
          <circle cx="0" cy="0" r="15" fill="#c1a679" opacity="0.1" className="at-glow" />
          
          <text y="-55" fill="#c1a679" fontFamily="monospace" fontSize="10" letterSpacing="2" textAnchor="middle">
            TESTIFYING_EXPERT
          </text>
        </g>

        {/* Input lines (Tech / Data) converging on the Expert */}
        <g className="at-line">
          <path d="M 120,120 L 250,120 L 360,180" fill="none" stroke="#6da57e" strokeWidth="1" strokeDasharray="1000" />
          <path d="M 120,200 L 350,200" fill="none" stroke="#6da57e" strokeWidth="1" strokeDasharray="1000" />
          <path d="M 120,280 L 250,280 L 360,220" fill="none" stroke="#6da57e" strokeWidth="1" strokeDasharray="1000" />
        </g>

        {/* Input Labels (Data Sources) */}
        <g className="at-node-0 text-[8px] font-mono tracking-widest" fill="#6da57e">
          <text x="120" y="115">STRUCTURED_EVIDENCE</text>
          <text x="120" y="195">SCHEDULE_ANOMALIES</text>
          <text x="120" y="275">QUANTUM_VALUATION</text>
        </g>

        {/* Output lines (Human output / Testimony) radiating from Expert */}
        <g className="at-line" style={{ animationDelay: '1s' }}>
          <path d="M 440,200 L 680,200" fill="none" stroke="#c1a679" strokeWidth="1.5" strokeDasharray="1000" />
          <line x1="680" y1="196" x2="680" y2="204" stroke="#c1a679" strokeWidth="2" />
        </g>

        {/* Output Label (The Deliverable) */}
        <g className="at-node-3 text-[9px] font-mono tracking-widest" fill="#c1a679">
          <text x="560" y="190" textAnchor="middle">CPR_PART_35_REPORT</text>
          <text x="560" y="215" textAnchor="middle" fontSize="7" fill="#c1a679" opacity="0.6">LIABILITY_APPORTIONMENT</text>
        </g>

        {/* Status line at top */}
        <text
          x="80"
          y="60"
          fill="#355a42"
          fontFamily="monospace"
          fontSize="9"
          letterSpacing="1"
          className="at-grid"
        >
          OUTPUT: DISCLOSABLE_EVIDENCE
        </text>
        <text
          x="80"
          y="75"
          fill="#355a42"
          fontFamily="monospace"
          fontSize="8"
          letterSpacing="1"
          className="at-grid"
        >
          STATUS: PARTNER_REVIEW_COMPLETE
        </text>
      </svg>
    </div>
  );
}
