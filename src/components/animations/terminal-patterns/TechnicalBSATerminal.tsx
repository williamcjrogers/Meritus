"use client";

/**
 * TechnicalBSATerminal — Visualizes an ultra-thin architectural wireframe 
 * of a high-rise building. A horizontal scanner moves up the elevation. 
 * As it hits Floor 06, panels illuminate in "warning gold" generating a 
 * non-compliant material substitution tag.
 */
export function TechnicalBSATerminal({
    className = "",
}: {
    className?: string;
}) {
    return (
        <div
            data-bsa-terminal
            className={`absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center ${className}`}
            aria-hidden="true"
        >
            <style
                dangerouslySetInnerHTML={{
                    __html: `
        @keyframes bsaFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes bsaDrawWireframe {
          from { stroke-dashoffset: 1500; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes bsaScanUp {
          0% { transform: translateY(280px); opacity: 0; }
          5% { opacity: 1; }
          95% { opacity: 1; }
          100% { transform: translateY(40px); opacity: 0; }
        }
        @keyframes bsaAlertGlow {
          0%, 100% { fill: rgba(193, 166, 121, 0.4); stroke: #c1a679; }
          50%      { fill: rgba(193, 166, 121, 0.8); stroke: #d4b886; }
        }
        @keyframes bsaTagPop {
          0% { opacity: 0; transform: translateX(-10px); }
          100% { opacity: 1; transform: translateX(0); }
        }

        /* 1. Wireframe Building */
        .terminal-active [data-bsa-terminal] .tb-wireframe {
          stroke-dasharray: 1500;
          stroke-dashoffset: 1500;
          animation: bsaDrawWireframe 2.5s ease forwards;
          will-change: stroke-dashoffset;
        }

        /* 2. Scanner Beam */
        .terminal-active [data-bsa-terminal] .tb-scanner {
          opacity: 0;
          /* Scanner takes 4 seconds to travel from bottom to top. 
             It starts at 2.5s (after wireframe draws) */
          animation: bsaScanUp 4s cubic-bezier(0.4, 0, 0.2, 1) forwards 2.5s;
          will-change: transform, opacity;
        }

        /* 3. Non-Compliant Panels Illuminating */
        .terminal-active [data-bsa-terminal] .tb-hazard-panel {
          opacity: 0;
          /* Scanner hits Floor 06 roughly halfway through its ascent (at ~4.5s overall time) */
          animation: bsaFadeIn 0.2s forwards 4.5s, bsaAlertGlow 1.5s infinite 4.7s;
        }

        /* 4. Tags and Callouts */
        .terminal-active [data-bsa-terminal] .tb-callout-line {
          opacity: 0;
          animation: bsaFadeIn 0.4s forwards 4.8s;
        }
        .terminal-active [data-bsa-terminal] .tb-alert-tag {
          opacity: 0;
          animation: bsaTagPop 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards 5s;
        }
        .terminal-active [data-bsa-terminal] .tb-alert-severity {
          opacity: 0;
          animation: bsaFadeIn 0.5s forwards 5.5s;
        }

        .terminal-inactive [data-bsa-terminal] * {
          opacity: 0 !important;
        }

        @media (prefers-reduced-motion: reduce) {
          .terminal-active [data-bsa-terminal] * {
            animation: none !important;
            opacity: 1 !important;
            stroke-dashoffset: 0 !important;
            transform: none !important;
          }
        }
      `,
                }}
            />

            <svg
                className="w-[120%] h-[120%] lg:w-full lg:h-full transform -translate-x-4 lg:translate-x-0"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="xMidYMid meet"
                viewBox="0 0 800 400"
            >
                {/* Geometric High-Rise Wireframe (Very thin, structural lines) */}
                <g stroke="#2d563a" strokeWidth="0.5" fill="none" className="tb-wireframe">
                    {/* Main Tower Outline */}
                    <rect x="250" y="40" width="160" height="320" />

                    {/* Floor Slabs (Every 20px) */}
                    {Array.from({ length: 16 }).map((_, i) => (
                        <line key={`floor-${i}`} x1="250" y1={40 + i * 20} x2="410" y2={40 + i * 20} />
                    ))}

                    {/* Vertical Mullions / Structural Columns */}
                    {Array.from({ length: 9 }).map((_, i) => (
                        <line key={`col-${i}`} x1={250 + i * 20} y1="40" x2={250 + i * 20} y2="360" />
                    ))}

                    {/* Faint context buildings in background */}
                    <rect x="180" y="180" width="60" height="180" strokeOpacity="0.3" />
                    <rect x="420" y="140" width="80" height="220" strokeOpacity="0.3" />
                    {Array.from({ length: 9 }).map((_, i) => (
                        <line key={`bg1-${i}`} x1="180" y1={180 + i * 20} x2="240" y2={180 + i * 20} strokeOpacity="0.3" />
                    ))}
                    {Array.from({ length: 11 }).map((_, i) => (
                        <line key={`bg2-${i}`} x1="420" y1={140 + i * 20} x2="500" y2={140 + i * 20} strokeOpacity="0.3" />
                    ))}
                </g>

                {/* The Scanning Beam */}
                <g className="tb-scanner">
                    {/* The beam line itself */}
                    <line x1="230" y1="0" x2="430" y2="0" stroke="#6da57e" strokeWidth="2" />

                    {/* Faint gradient wash below the scanner to simulate passing light */}
                    <rect x="250" y="0" width="160" height="40" fill="url(#scannerGradient)" />

                    <defs>
                        <linearGradient id="scannerGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="rgba(109, 165, 126, 0.4)" />
                            <stop offset="100%" stopColor="rgba(109, 165, 126, 0)" />
                        </linearGradient>
                    </defs>

                    {/* Scanner readout text tracking the beam */}
                    <text x="440" y="4" fill="#6da57e" fontFamily="monospace" fontSize="8" letterSpacing="2">SCANNING_ELEVATION_WEST</text>
                </g>

                {/* Hazard Panels (Combustible PIR board discovered on Floors 06-12) 
            Floors count from bottom. 40 (top) to 360 (bottom).
            16 total floors (320px / 20px). Bottom floor is 340-360.
            Floor 06 (from bottom) is roughly y=220 to y=240.
            Floor 12 is roughly y=100 to y=120.
            The hazard zone: y="120" height="120" (which covers Floors 6 thru 11 visually) 
        */}
                <g>
                    {/* We'll highlight specific cladding panels within this zone */}
                    <g className="tb-hazard-panel">
                        <rect x="250" y="120" width="40" height="120" />
                        <rect x="330" y="120" width="40" height="120" />
                        <rect x="390" y="120" width="20" height="120" />
                        {/* Adding stroke definition visually overrides standard wireframe */}
                        <rect x="250" y="120" width="160" height="120" fill="rgba(193, 166, 121, 0.1)" stroke="#c1a679" strokeWidth="1" strokeDasharray="2 2" />
                    </g>

                    {/* Callout Line extending from the hazard zone */}
                    <polyline
                        points="410,180 460,180 490,150"
                        fill="none"
                        stroke="#c1a679"
                        strokeWidth="1"
                        className="tb-callout-line"
                    />
                    <circle cx="410" cy="180" r="3" fill="#c1a679" className="tb-callout-line" />
                    <circle cx="490" cy="150" r="2" fill="#c1a679" className="tb-callout-line" />

                    {/* Readout Tags */}
                    <g className="tb-alert-tag">
                        <rect x="500" y="138" width="270" height="24" fill="rgba(193, 166, 121, 0.15)" stroke="#c1a679" strokeWidth="1" />
                        <text x="510" y="154" fill="#c1a679" fontFamily="monospace" fontSize="11" letterSpacing="1" fontWeight="bold">
                            [MATERIAL_SUBSTITUTION: NON-COMPLIANT]
                        </text>
                    </g>

                    <g className="tb-alert-severity">
                        <text x="500" y="180" fill="#6da57e" fontFamily="monospace" fontSize="10" letterSpacing="1">
                            &gt; LOCATION: FLOORS 06 - 12
                        </text>
                        <text x="500" y="195" fill="#6da57e" fontFamily="monospace" fontSize="10" letterSpacing="1">
                            &gt; AS-BUILT: COMBUSTIBLE PIR BOARD
                        </text>
                        <text x="500" y="215" fill="#c1a679" fontFamily="monospace" fontSize="10" letterSpacing="1" fontWeight="bold">
                            &gt; LIABILITY: D&amp;B CONTRACTOR
                        </text>
                    </g>
                </g>
            </svg>
        </div>
    );
}
