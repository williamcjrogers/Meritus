"use client";

/**
 * PlatformTerminal,Schematic of the firm's in-house platform layer.
 * Raw matter data flows through the platform core and emerges as
 * structured, source-linked work product. Nodes appear on scroll.
 */
export function PlatformTerminal({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      data-plat-terminal
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes ptDraw {
          from { stroke-dashoffset: 800; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes ptFade {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ptPulse {
          0%, 100% { opacity: 0.3; }
          50%      { opacity: 1; }
        }
        @keyframes ptGlow {
          0%, 100% { opacity: 0; }
          50%      { opacity: 0.3; }
        }
        @keyframes ptScan {
          0%   { transform: translateY(0); opacity: 0; }
          15%  { opacity: 0.5; }
          85%  { opacity: 0.5; }
          100% { transform: translateY(96px); opacity: 0; }
        }
        .terminal-active [data-plat-terminal] .pt-line {
          stroke-dasharray: 800;
          stroke-dashoffset: 800;
          animation: ptDraw 2s cubic-bezier(0.4, 0, 0.2, 1) forwards 0.3s;
          will-change: stroke-dashoffset;
        }
        .terminal-active [data-plat-terminal] .pt-node-0 {
          opacity: 0; animation: ptFade 0.6s ease forwards 0.8s;
        }
        .terminal-active [data-plat-terminal] .pt-node-1 {
          opacity: 0; animation: ptFade 0.6s ease forwards 1.3s;
        }
        .terminal-active [data-plat-terminal] .pt-node-2 {
          opacity: 0; animation: ptFade 0.6s ease forwards 1.8s;
        }
        .terminal-active [data-plat-terminal] .pt-node-3 {
          opacity: 0; animation: ptFade 0.6s ease forwards 2.3s;
        }
        .terminal-active [data-plat-terminal] .pt-pulse {
          animation: ptPulse 2s ease-in-out infinite;
        }
        .terminal-active [data-plat-terminal] .pt-glow {
          animation: ptGlow 3s ease-in-out infinite;
        }
        .terminal-active [data-plat-terminal] .pt-scan {
          animation: ptScan 4s ease-in-out infinite 2.5s;
          will-change: transform;
        }
        .terminal-active [data-plat-terminal] .pt-grid {
          opacity: 0; animation: ptFade 2s ease forwards 0.2s;
        }
        .terminal-inactive [data-plat-terminal] * {
          opacity: 0 !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .terminal-active [data-plat-terminal] .pt-line,
          .terminal-active [data-plat-terminal] .pt-node-0,
          .terminal-active [data-plat-terminal] .pt-node-1,
          .terminal-active [data-plat-terminal] .pt-node-2,
          .terminal-active [data-plat-terminal] .pt-node-3,
          .terminal-active [data-plat-terminal] .pt-pulse,
          .terminal-active [data-plat-terminal] .pt-glow,
          .terminal-active [data-plat-terminal] .pt-scan,
          .terminal-active [data-plat-terminal] .pt-grid {
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
        <g className="pt-grid">
          <circle cx="200" cy="130" r="1.5" fill="#355a42" />
          <circle cx="620" cy="130" r="1.5" fill="#355a42" />
          <circle cx="200" cy="290" r="1.5" fill="#355a42" />
          <circle cx="620" cy="290" r="1.5" fill="#355a42" />

          <line x1="200" y1="130" x2="620" y2="130" stroke="#355a42" strokeWidth="0.5" strokeDasharray="2 4" />
          <line x1="200" y1="290" x2="620" y2="290" stroke="#355a42" strokeWidth="0.5" strokeDasharray="2 4" />
        </g>

        {/* Input sources (raw matter data) */}
        <g className="pt-node-0 text-[8px] font-mono tracking-widest" fill="#6da57e">
          <text x="90" y="155">MAILBOX_SYNC</text>
          <text x="90" y="205">SITE_RECORDS</text>
          <text x="90" y="255">PROGRAMME_FILES</text>
        </g>

        {/* Ingest lines converging on the platform core */}
        <g className="pt-line">
          <path d="M 100,165 L 200,165 L 300,185" fill="none" stroke="#6da57e" strokeWidth="1" strokeDasharray="1000" />
          <path d="M 100,215 L 300,215" fill="none" stroke="#6da57e" strokeWidth="1" strokeDasharray="1000" />
          <path d="M 100,265 L 200,265 L 300,240" fill="none" stroke="#6da57e" strokeWidth="1" strokeDasharray="1000" />
        </g>

        {/* Platform core */}
        <g className="pt-node-1">
          <rect x="310" y="150" width="180" height="120" fill="none" stroke="#c1a679" strokeWidth="1.5" />
          <rect x="310" y="150" width="180" height="120" fill="#c1a679" opacity="0.04" />

          {/* corner ticks */}
          <path d="M 305,145 L 305,155 M 305,145 L 315,145" stroke="#c1a679" strokeWidth="1" fill="none" />
          <path d="M 495,275 L 495,265 M 495,275 L 485,275" stroke="#c1a679" strokeWidth="1" fill="none" />

          <text x="400" y="138" fill="#c1a679" fontFamily="monospace" fontSize="10" letterSpacing="2" textAnchor="middle">
            PLATFORM_CORE
          </text>

          <text x="326" y="176" fill="#6da57e" fontFamily="monospace" fontSize="8" letterSpacing="1.5">INGEST + INDEX</text>
          <text x="326" y="198" fill="#6da57e" fontFamily="monospace" fontSize="8" letterSpacing="1.5">CLASSIFY</text>
          <text x="326" y="220" fill="#6da57e" fontFamily="monospace" fontSize="8" letterSpacing="1.5">LINK_TO_SOURCE</text>
          <text x="326" y="242" fill="#6da57e" fontFamily="monospace" fontSize="8" letterSpacing="1.5">FLAG + DEADLINE</text>

          <circle cx="470" cy="171" r="3" fill="#c1a679" className="pt-pulse" />
          <circle cx="470" cy="171" r="10" fill="#c1a679" opacity="0.1" className="pt-glow" />

          {/* scan line sweeping the core */}
          <line x1="316" y1="160" x2="484" y2="160" stroke="#c1a679" strokeWidth="0.75" opacity="0" className="pt-scan" />
        </g>

        {/* Output lines radiating to work product */}
        <g className="pt-line" style={{ animationDelay: "1s" }}>
          <path d="M 490,185 L 580,185 L 640,160" fill="none" stroke="#c1a679" strokeWidth="1" strokeDasharray="1000" />
          <path d="M 490,210 L 640,210" fill="none" stroke="#c1a679" strokeWidth="1.5" strokeDasharray="1000" />
          <path d="M 490,235 L 580,235 L 640,260" fill="none" stroke="#c1a679" strokeWidth="1" strokeDasharray="1000" />
          <line x1="640" y1="206" x2="640" y2="214" stroke="#c1a679" strokeWidth="2" />
        </g>

        {/* Output labels (structured work product) */}
        <g className="pt-node-2 text-[8px] font-mono tracking-widest" fill="#c1a679">
          <text x="648" y="163">SOURCED_CHRONOLOGY</text>
          <text x="648" y="213">LIVE_DEADLINES</text>
          <text x="648" y="263">DRAFT_FOR_REVIEW</text>
        </g>

        {/* Deadline engine detail beneath the core */}
        <g className="pt-node-3">
          <text x="310" y="305" fill="#6da57e" fontFamily="monospace" fontSize="8" letterSpacing="1">
            NOTICE_01 :: 14_DAYS_REMAINING
          </text>
          <text x="310" y="320" fill="#6da57e" fontFamily="monospace" fontSize="8" letterSpacing="1" opacity="0.6">
            NOTICE_02 :: 06_DAYS_REMAINING
          </text>
        </g>

        {/* Status lines at top */}
        <text
          x="80"
          y="60"
          fill="#355a42"
          fontFamily="monospace"
          fontSize="9"
          letterSpacing="1"
          className="pt-grid"
        >
          BUILT: IN_HOUSE // ENV: PRODUCTION
        </text>
        <text
          x="80"
          y="75"
          fill="#355a42"
          fontFamily="monospace"
          fontSize="8"
          letterSpacing="1"
          className="pt-grid"
        >
          SECURITY: TENANT_ISOLATION + AUDIT_TRAIL
        </text>
      </svg>
    </div>
  );
}
