"use client";

/**
 * TechnicalDefectTerminal — Visualizes a CAD-style geometric cross-section
 * of a facade mullion/transom. A zooming bounding box targets a joint, 
 * revealing a flashing dashed line for an omitted seal and a liability tag.
 */
export function TechnicalDefectTerminal({
    className = "",
}: {
    className?: string;
}) {
    return (
        <div
            data-defect-terminal
            className={`absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center ${className}`}
            aria-hidden="true"
        >
            <style
                dangerouslySetInnerHTML={{
                    __html: `
        @keyframes defectFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes defectDraw {
          from { stroke-dashoffset: 1000; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes defectPulse {
          0%, 100% { opacity: 0.3; }
          50%      { opacity: 1; }
        }
        @keyframes defectFlash {
          0%, 100% { opacity: 1; stroke: #c1a679; }
          50%      { opacity: 0; stroke: transparent; }
        }
        @keyframes defectZoomBox {
          0% { stroke-dasharray: 400; stroke-dashoffset: 400; opacity: 0; transform: scale(1.1); transform-origin: 350px 180px; }
          30% { stroke-dasharray: 400; stroke-dashoffset: 0; opacity: 1; transform: scale(1.1); transform-origin: 350px 180px; }
          100% { stroke-dashoffset: 0; opacity: 1; transform: scale(1); transform-origin: 350px 180px; }
        }

        /* 1. Base CAD Lines */
        .terminal-active [data-defect-terminal] .td-cad-line {
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation: defectDraw 2s ease forwards;
          will-change: stroke-dashoffset;
        }

        /* 2. Target Bounding Box */
        .terminal-active [data-defect-terminal] .td-target-box {
          opacity: 0;
          animation: defectZoomBox 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards 1.5s;
          will-change: transform, opacity, stroke-dashoffset;
        }

        /* 3. Missing Seal Flash */
        .terminal-active [data-defect-terminal] .td-missing-seal {
          opacity: 0;
          animation: defectFlash 0.3s step-end infinite 2.5s;
        }
        .terminal-inactive [data-defect-terminal] .td-missing-seal {
          animation: none !important;
        }

        /* 4. Crosshairs & Node pulses */
        .terminal-active [data-defect-terminal] .td-pulse {
          opacity: 0;
          animation: defectFadeIn 0.5s forwards 2.5s, defectPulse 2s infinite ease-in-out 3s;
        }

        /* 5. Readout Tags */
        .terminal-active [data-defect-terminal] .td-fade-tag {
          opacity: 0;
          animation: defectFadeIn 0.5s forwards 2.8s;
        }
        .terminal-active [data-defect-terminal] .td-fade-liability {
          opacity: 0;
          animation: defectFadeIn 0.5s forwards 3.2s;
        }

        .terminal-inactive [data-defect-terminal] * {
          opacity: 0 !important;
        }
        
        @media (prefers-reduced-motion: reduce) {
          .terminal-active [data-defect-terminal] * {
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
                className="w-[120%] h-[120%] lg:w-full lg:h-full transform -translate-x-12 lg:translate-x-0"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="xMidYMid meet"
                viewBox="0 0 800 400"
            >
                {/* Background Grid Pattern (Minimalist CAD feel) */}
                <g stroke="#2d563a" strokeWidth="0.5" strokeOpacity="0.3" fill="none">
                    {Array.from({ length: 20 }).map((_, i) => (
                        <line key={`v-${i}`} x1={i * 40} y1="0" x2={i * 40} y2="400" />
                    ))}
                    {Array.from({ length: 10 }).map((_, i) => (
                        <line key={`h-${i}`} x1="0" y1={i * 40} x2="800" y2={i * 40} />
                    ))}
                </g>

                {/* CAD Facade Cross-Section Geometries */}
                <g stroke="#6da57e" fill="none">
                    {/* Main Mullion Extrusion */}
                    <path className="td-cad-line" strokeWidth="1" d="M 200 50 L 200 350 M 240 50 L 240 350 M 200 50 L 240 50 M 200 350 L 240 350" />
                    <path className="td-cad-line" strokeWidth="0.5" d="M 210 50 L 210 350 M 230 50 L 230 350" />

                    {/* Transom Profile Intersecting */}
                    <path className="td-cad-line" strokeWidth="1.5" d="M 240 160 L 400 160 M 240 200 L 400 200" />

                    {/* Inner Web / Glazing Pocket */}
                    <path className="td-cad-line" strokeWidth="1" d="M 400 140 L 440 140 L 440 220 L 400 220 M 400 160 L 400 200" />

                    {/* Glass Pane (Top and Bottom) */}
                    <path className="td-cad-line" strokeWidth="2" strokeOpacity="0.7" d="M 420 50 L 420 140 M 420 220 L 420 350" />

                    {/* Pressure Plate / Cap */}
                    <path className="td-cad-line" strokeWidth="1" d="M 440 150 L 460 150 L 460 210 L 440 210" />
                    <path className="td-cad-line" strokeWidth="0.5" d="M 460 160 L 480 160 L 480 200 L 460 200" />
                </g>

                {/* The Targeting Mechanism & Defect Identification */}
                <g>
                    {/* Zooming Target Box around the primary structural joint (Transom to Mullion connection) */}
                    <rect
                        x="380"
                        y="130"
                        width="110"
                        height="100"
                        fill="none"
                        stroke="#c1a679"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                        className="td-target-box"
                    />

                    {/* Crosshair at center of joint */}
                    <circle cx="430" cy="180" r="3" fill="#c1a679" className="td-pulse" />
                    <path d="M 420 180 L 440 180 M 430 170 L 430 190" stroke="#c1a679" strokeWidth="0.5" className="td-pulse" />

                    {/* Missing Secondary Seal (Flashing Element between glazing pocket and glass) */}
                    <line
                        x1="418" y1="140" x2="418" y2="150"
                        stroke="#c1a679" strokeWidth="3" strokeDasharray="2 2"
                        className="td-missing-seal"
                    />
                    <line
                        x1="418" y1="210" x2="418" y2="220"
                        stroke="#c1a679" strokeWidth="3" strokeDasharray="2 2"
                        className="td-missing-seal"
                    />

                    {/* Callout Line */}
                    <path d="M 425 145 L 480 100 L 520 100" fill="none" stroke="#c1a679" strokeWidth="1" className="td-fade-tag" />

                    {/* Readout Text Tags */}
                    <g className="td-fade-tag">
                        <rect x="525" y="85" width="220" height="20" fill="rgba(193, 166, 121, 0.1)" stroke="#c1a679" strokeWidth="0.5" />
                        <text x="535" y="99" fill="#c1a679" fontFamily="monospace" fontSize="10" letterSpacing="1">[SECONDARY_SEAL_OMITTED]</text>
                    </g>

                    <g className="td-fade-liability">
                        <text x="535" y="125" fill="#6da57e" fontFamily="monospace" fontSize="11" letterSpacing="1" fontWeight="bold">
                            -&gt; LIABILITY: DESIGN
                        </text>
                    </g>
                </g>
            </svg>
        </div>
    );
}
