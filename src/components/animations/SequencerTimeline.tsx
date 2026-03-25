"use client";

import "@/styles/sequencer-timeline.css";

export function SequencerTimeline() {
    return (
        <div className="w-full h-[80px] overflow-visible mb-6 relative z-10">
            <svg className="w-full h-full" viewBox="0 0 1000 80" preserveAspectRatio="xMidYMid slice" aria-hidden="true">

                <g className="tick-mark">
                    <line x1="250" y1="36" x2="250" y2="44" />
                    <line x1="500" y1="36" x2="500" y2="44" />
                    <line x1="750" y1="36" x2="750" y2="44" />
                    <line x1="187.5" y1="38" x2="187.5" y2="42" />
                    <line x1="312.5" y1="38" x2="312.5" y2="42" />
                    <line x1="437.5" y1="38" x2="437.5" y2="42" />
                    <line x1="562.5" y1="38" x2="562.5" y2="42" />
                    <line x1="687.5" y1="38" x2="687.5" y2="42" />
                    <line x1="812.5" y1="38" x2="812.5" y2="42" />
                </g>

                <line x1="125" y1="40" x2="875" y2="40" className="track-faint" />
                <line x1="125" y1="40" x2="875" y2="40" className="track-gold" />

                <g className="t-1" transform="translate(125, 40)">
                    <path d="M -14 0 L -8 0 M 8 0 L 14 0 M 0 -14 L 0 -8 M 0 8 L 0 14" className="crosshair" />
                    <circle cx="0" cy="0" r="8" className="node-ring" />
                    <circle cx="0" cy="0" r="5" className="node-dot" />
                    <circle cx="0" cy="0" r="2.5" className="node-fill" />
                </g>

                <g className="t-2" transform="translate(375, 40)">
                    <path d="M -14 0 L -8 0 M 8 0 L 14 0 M 0 -14 L 0 -8 M 0 8 L 0 14" className="crosshair" />
                    <circle cx="0" cy="0" r="8" className="node-ring" />
                    <circle cx="0" cy="0" r="5" className="node-dot" />
                    <circle cx="0" cy="0" r="2.5" className="node-fill" />
                </g>

                <g className="t-3" transform="translate(625, 40)">
                    <path d="M -14 0 L -8 0 M 8 0 L 14 0 M 0 -14 L 0 -8 M 0 8 L 0 14" className="crosshair" />
                    <circle cx="0" cy="0" r="8" className="node-ring" />
                    <circle cx="0" cy="0" r="5" className="node-dot" />
                    <circle cx="0" cy="0" r="2.5" className="node-fill" />
                </g>

                <g className="t-4" transform="translate(875, 40)">
                    <path d="M -14 0 L -8 0 M 8 0 L 14 0 M 0 -14 L 0 -8 M 0 8 L 0 14" className="crosshair" />
                    <circle cx="0" cy="0" r="8" className="node-ring" />
                    <circle cx="0" cy="0" r="5" className="node-dot" />
                    <circle cx="0" cy="0" r="2.5" className="node-fill" />
                </g>
            </svg>
        </div>
    );
}
