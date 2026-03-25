"use client";

import "@/styles/hero-engine.css";

export function HeroEnginePattern() {
    return (
        <div className="absolute inset-0 z-0 pointer-events-none w-full h-full overflow-hidden flex justify-center">
            <svg viewBox="0 0 2000 480" preserveAspectRatio="xMidYMid slice" className="w-full h-full absolute top-0 left-0 z-[1]" aria-hidden="true">
                <defs>
                    <linearGradient id="edge-fade" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="white" stopOpacity="0" />
                        <stop offset="15%" stopColor="white" stopOpacity="1" />
                        <stop offset="85%" stopColor="white" stopOpacity="1" />
                        <stop offset="100%" stopColor="white" stopOpacity="0" />
                    </linearGradient>
                </defs>

                <g mask="url(#edge-fade)">
                    <line x1="0" y1="120" x2="2000" y2="120" stroke="rgba(109,165,126,0.06)" strokeWidth="1" />
                    <line x1="0" y1="360" x2="2000" y2="360" stroke="rgba(109,165,126,0.06)" strokeWidth="1" />

                    <g className="pulse-1">
                        <line x1="10%" y1="180" x2="35%" y2="180" stroke="rgba(193,166,121,0.12)" strokeWidth="1" />
                        <line x1="65%" y1="300" x2="90%" y2="300" stroke="rgba(109,165,126,0.08)" strokeWidth="1" />
                    </g>

                    <g className="pulse-2">
                        <line x1="20%" y1="300" x2="45%" y2="300" stroke="rgba(109,165,126,0.08)" strokeWidth="1" />
                        <line x1="55%" y1="180" x2="80%" y2="180" stroke="rgba(193,166,121,0.12)" strokeWidth="1" />
                    </g>
                </g>
            </svg>
        </div>
    );
}
