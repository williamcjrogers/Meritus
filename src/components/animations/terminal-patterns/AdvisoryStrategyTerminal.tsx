"use client";

/**
 * AdvisoryStrategyTerminal — "Chaos-to-order" data-filtering schematic.
 * Demonstrates ingesting thousands of unstructured records, sweeping them
 * to strike out procedurally barred claims, and extracting a clean,
 * single targeted claim geometry (Strategy: Offensive Adjudication).
 */
export function AdvisoryStrategyTerminal({
    className = "",
}: {
    className?: string;
}) {
    // Deterministic "chaos" nodes to avoid hydration mismatch
    const chaosNodes = [
        { x: 80, y: 150, w: 12 }, { x: 95, y: 180, w: 20 }, { x: 70, y: 210, w: 15 }, { x: 110, y: 140, w: 8 },
        { x: 130, y: 190, w: 25 }, { x: 120, y: 230, w: 10 }, { x: 150, y: 160, w: 18 }, { x: 165, y: 200, w: 14 },
        { x: 180, y: 130, w: 12 }, { x: 190, y: 175, w: 22 }, { x: 185, y: 220, w: 16 }, { x: 210, y: 150, w: 20 },
        { x: 225, y: 195, w: 10 }, { x: 240, y: 240, w: 18 }, { x: 250, y: 140, w: 15 }, { x: 265, y: 180, w: 12 },
        { x: 280, y: 220, w: 25 }, { x: 295, y: 160, w: 8 }, { x: 310, y: 200, w: 18 }, { x: 330, y: 230, w: 14 },
        { x: 345, y: 140, w: 12 }, { x: 360, y: 185, w: 20 }, { x: 375, y: 220, w: 15 }, { x: 385, y: 160, w: 10 },
    ];

    return (
        <div
            data-advisory-terminal
            className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
            aria-hidden="true"
        >
            <style
                dangerouslySetInnerHTML={{
                    __html: `
        @keyframes advFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes advScanSweep {
          0%   { transform: translateX(0); opacity: 0; }
          5%   { opacity: 1; }
          80%  { transform: translateX(450px); opacity: 1; }
          90%  { transform: translateX(450px); opacity: 0; }
          100% { transform: translateX(450px); opacity: 0; }
        }
        @keyframes advStrike {
          0%   { opacity: 0.6; fill: #355a42; }
          100% { opacity: 0.1; fill: #0b1510; }
        }
        @keyframes advTimeBarred {
          0%   { opacity: 0; transform: translateY(4px); }
          20%  { opacity: 0.8; transform: translateY(0); }
          80%  { opacity: 0.8; }
          100% { opacity: 0; }
        }
        @keyframes advSnap {
          0%   { stroke-dashoffset: 400; opacity: 0; }
          1%   { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes advBracket {
          0%   { stroke-dashoffset: 100; opacity: 0; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes advFlash {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0; }
        }
        @keyframes advGlow {
          0%, 100% { opacity: 0.1; filter: blur(2px); }
          50%      { opacity: 0.4; filter: blur(4px); }
        }

        .terminal-active [data-advisory-terminal] .adv-grid {
          opacity: 0;
          animation: advFadeIn 1s ease forwards 0.2s;
        }
        .terminal-active [data-advisory-terminal] .adv-chaos {
          opacity: 0;
          animation: advFadeIn 1s ease forwards 0.5s;
        }
        .terminal-active [data-advisory-terminal] .adv-scanner {
          opacity: 0;
          animation: advScanSweep 2.5s linear forwards 1.2s;
          will-change: transform;
        }
        
        /* Staggered strikeout effects based on approximate X position */
        .terminal-active [data-advisory-terminal] .adv-chaos.col-1 { animation: advFadeIn 0.1s forwards, advStrike 0.1s forwards 1.4s; }
        .terminal-active [data-advisory-terminal] .adv-chaos.col-2 { animation: advFadeIn 0.1s forwards, advStrike 0.1s forwards 1.6s; }
        .terminal-active [data-advisory-terminal] .adv-chaos.col-3 { animation: advFadeIn 0.1s forwards, advStrike 0.1s forwards 1.9s; }
        .terminal-active [data-advisory-terminal] .adv-chaos.col-4 { animation: advFadeIn 0.1s forwards, advStrike 0.1s forwards 2.3s; }
        .terminal-active [data-advisory-terminal] .adv-chaos.col-5 { animation: advFadeIn 0.1s forwards, advStrike 0.1s forwards 2.6s; }
        
        /* Time-barred tags pop up behind scanner */
        .terminal-active [data-advisory-terminal] .adv-tag-1 { opacity: 0; animation: advTimeBarred 2s forwards 1.5s; }
        .terminal-active [data-advisory-terminal] .adv-tag-2 { opacity: 0; animation: advTimeBarred 2s forwards 1.8s; }
        .terminal-active [data-advisory-terminal] .adv-tag-3 { opacity: 0; animation: advTimeBarred 2s forwards 2.2s; }
        .terminal-active [data-advisory-terminal] .adv-tag-4 { opacity: 0; animation: advTimeBarred 2s forwards 2.7s; }

        /* Gold targeted line snaps in after sweep */
        .terminal-active [data-advisory-terminal] .adv-gold {
          stroke-dasharray: 400;
          stroke-dashoffset: 400;
          opacity: 0;
          animation: advSnap 0.8s cubic-bezier(0.1, 0.8, 0.2, 1) forwards 3.3s;
        }
        .terminal-active [data-advisory-terminal] .adv-gold-glow {
          opacity: 0;
          animation: advFadeIn 1s forwards 3.8s, advGlow 3s infinite 4s;
        }
        .terminal-active [data-advisory-terminal] .adv-bracket {
          stroke-dasharray: 100;
          stroke-dashoffset: 100;
          opacity: 0;
          animation: advBracket 0.5s ease forwards 3.8s;
        }
        .terminal-active [data-advisory-terminal] .adv-strategy-text {
          opacity: 0;
          animation: advFadeIn 0.1s forwards 4.2s, advFlash 2s infinite 4.5s;
        }
        .terminal-active [data-advisory-terminal] .adv-final-fade {
          opacity: 0;
          animation: advFadeIn 1s forwards 4.3s;
        }

        .terminal-inactive [data-advisory-terminal] * {
          opacity: 0 !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .terminal-active [data-advisory-terminal] * { animation: none !important; opacity: 1 !important; stroke-dashoffset: 0 !important; }
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
                {/* Background Grid */}
                <g className="adv-grid" stroke="#1e3b2b" strokeWidth="0.5" strokeDasharray="2 6" opacity="0.4">
                    <line x1="0" y1="100" x2="800" y2="100" />
                    <line x1="0" y1="200" x2="800" y2="200" />
                    <line x1="0" y1="300" x2="800" y2="300" />
                    <line x1="450" y1="0" x2="450" y2="400" />
                </g>

                {/* The Chaos Field: Unstructured Records */}
                <g opacity="0.6">
                    {chaosNodes.map((n, i) => {
                        let col = 1;
                        if (n.x > 140) col = 2;
                        if (n.x > 210) col = 3;
                        if (n.x > 280) col = 4;
                        if (n.x > 340) col = 5;

                        return (
                            <g key={i}>
                                <rect
                                    x={n.x}
                                    y={n.y}
                                    width={n.w}
                                    height="4"
                                    rx="1"
                                    fill="#6da57e"
                                    className={`adv-chaos col-${col}`}
                                />
                                {/* Randomly add some link lines to create "network" chaos */}
                                {i % 3 === 0 && i < chaosNodes.length - 1 && (
                                    <line
                                        x1={n.x + n.w}
                                        y1={n.y + 2}
                                        x2={chaosNodes[i + 1].x}
                                        y2={chaosNodes[i + 1].y + 2}
                                        stroke="#355a42"
                                        strokeWidth="0.5"
                                        className={`adv-chaos col-${col}`}
                                    />
                                )}
                            </g>
                        );
                    })}
                </g>

                {/* Time-Barred Tags popping up behind scanner */}
                <text x="70" y="140" fill="#6b2020" fontFamily="monospace" fontSize="8" letterSpacing="0.5" className="adv-tag-1">[TIME-BARRED]</text>
                <text x="140" y="240" fill="#6b2020" fontFamily="monospace" fontSize="8" letterSpacing="0.5" className="adv-tag-2">[DEFECTIVE_NOTICE]</text>
                <text x="230" y="160" fill="#6b2020" fontFamily="monospace" fontSize="8" letterSpacing="0.5" className="adv-tag-3">[BARRED: CL_61.3]</text>
                <text x="320" y="210" fill="#6b2020" fontFamily="monospace" fontSize="8" letterSpacing="0.5" className="adv-tag-4">[PROCEDURALLY_BARRED]</text>

                {/* The Scanner */}
                <g className="adv-scanner" transform="translate(40, 0)">
                    <line x1="0" y1="50" x2="0" y2="350" stroke="#6da57e" strokeWidth="2" />
                    {/* Scanner glow */}
                    <rect x="-24" y="50" width="24" height="300" fill="url(#adv-scan-grad)" />
                    {/* Scanner text */}
                    <text x="5" y="65" fill="#6da57e" fontFamily="monospace" fontSize="10" letterSpacing="1">[MERITS_ASSESSMENT]</text>
                </g>

                {/* Golden Thread: Surviving claim nodes snapping to a targeted attack */}
                <g>
                    {/* Golden glow */}
                    <line x1="480" y1="200" x2="720" y2="200" stroke="#c1a679" strokeWidth="8" strokeLinecap="round" className="adv-gold-glow" />
                    {/* Main golden line */}
                    <line x1="480" y1="200" x2="720" y2="200" stroke="#c1a679" strokeWidth="2" strokeLinecap="round" className="adv-gold" />
                    {/* Surviving nodes that formed the thread */}
                    <circle cx="480" cy="200" r="4" fill="#c1a679" className="adv-gold" />
                    <circle cx="560" cy="200" r="3" fill="#0b1510" stroke="#c1a679" strokeWidth="1.5" className="adv-gold" />
                    <circle cx="640" cy="200" r="3" fill="#0b1510" stroke="#c1a679" strokeWidth="1.5" className="adv-gold" />
                    <circle cx="720" cy="200" r="4" fill="#c1a679" className="adv-gold" />
                </g>

                {/* Target Brackets around the gold string */}
                <g className="adv-bracket" stroke="#6da57e" strokeWidth="1.5" fill="none">
                    {/* Left bracket */}
                    <path d="M 470 185 L 460 185 L 460 215 L 470 215" />
                    {/* Right bracket */}
                    <path d="M 730 185 L 740 185 L 740 215 L 730 215" />
                </g>

                {/* Flashing Strategy Text */}
                <text x="600" y="180" fill="#c1a679" fontFamily="monospace" fontSize="10" letterSpacing="1" textAnchor="middle" className="adv-strategy-text">
                    [STRATEGY: OFFENSIVE_ADJUDICATION]
                </text>
                <text x="600" y="235" fill="#6da57e" fontFamily="monospace" fontSize="8" letterSpacing="1" textAnchor="middle" className="adv-final-fade">
                    MERITS_SURVIVAL: 18% &mdash; LETHAL_THREAD_ACQUIRED
                </text>

                {/* Global info texts */}
                <text x="60" y="340" fill="#355a42" fontFamily="monospace" fontSize="9" letterSpacing="1" className="adv-grid">
                    INPUT: 12,000_RECORDS — CLAIM_VAL: £14.2M
                </text>
                <text x="60" y="358" fill="#c1a679" fontFamily="monospace" fontSize="9" letterSpacing="1" className="adv-final-fade">
                    PIVOT: REJECT_SETTLEMENT &mdash; INITIATE_STRIKE_OUT
                </text>

                {/* Define Gradient for Scanner */}
                <defs>
                    <linearGradient id="adv-scan-grad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#6da57e" stopOpacity="0" />
                        <stop offset="100%" stopColor="#6da57e" stopOpacity="0.3" />
                    </linearGradient>
                </defs>
            </svg>
        </div>
    );
}
