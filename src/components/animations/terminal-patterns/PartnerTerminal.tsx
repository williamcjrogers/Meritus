"use client";

/**
 * PartnerTerminal,A personable, partner-led visual.
 * Represents human judgment, CPR Part 35 sign-off, and expert testimony.
 */
export function PartnerTerminal({
    className = "",
}: {
    className?: string;
}) {
    return (
        <div
            data-ptr-terminal
            className={`absolute inset-0 overflow-hidden pointer-events-none flex flex-col h-full bg-green ${className}`}
            aria-hidden="true"
        >
            <style
                dangerouslySetInnerHTML={{
                    __html: `
        @keyframes ptrFade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ptrDraw { to { stroke-dashoffset: 0; } }
        @keyframes ptrStamp { 
            0% { opacity: 0; transform: scale(1.5) rotate(-25deg); } 
            70% { opacity: 1; transform: scale(0.9) rotate(-15deg); } 
            100% { opacity: 1; transform: scale(1) rotate(-15deg); } 
        }

        .terminal-active [data-ptr-terminal] .pt-fade-1 {
          opacity: 0; animation: ptrFade 0.8s ease forwards 0.3s;
        }
        .terminal-active [data-ptr-terminal] .pt-fade-2 {
          opacity: 0; animation: ptrFade 0.8s ease forwards 0.8s;
        }
        .terminal-active [data-ptr-terminal] .pt-fade-3 {
          opacity: 0; animation: ptrFade 0.8s ease forwards 1.3s;
        }
        .terminal-active [data-ptr-terminal] .pt-draw-sig {
          stroke-dasharray: 600;
          stroke-dashoffset: 600;
          animation: ptrDraw 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards 1.5s;
        }
        .terminal-active [data-ptr-terminal] .pt-stamp {
          opacity: 0;
          transform-origin: center;
          animation: ptrStamp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards 2.5s;
        }

        .terminal-inactive [data-ptr-terminal] * {
          opacity: 0 !important;
        }
        
        @media (prefers-reduced-motion: reduce) {
          .terminal-active [data-ptr-terminal] * {
            animation: none !important;
            opacity: 1 !important;
            stroke-dashoffset: 0 !important;
            transform: none !important;
          }
        }
      `,
                }}
            />

            <svg viewBox="0 0 800 400" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
                
                {/* Background grid / document lines */}
                <g stroke="#1e3b2b" strokeWidth="0.5" strokeDasharray="2 6">
                    <line x1="80" y1="120" x2="720" y2="120" />
                    <line x1="80" y1="160" x2="720" y2="160" />
                    <line x1="80" y1="200" x2="720" y2="200" />
                    <line x1="80" y1="240" x2="720" y2="240" />
                    <line x1="80" y1="280" x2="720" y2="280" />
                </g>

                {/* Submitting Party / Authorisation Block */}
                <g className="pt-fade-1">
                    <text x="100" y="80" fill="#355a42" fontFamily="monospace" fontSize="10" letterSpacing="2">FINAL_DELIVERABLE //</text>
                    <text x="100" y="115" fill="#6da57e" fontFamily="monospace" fontSize="11" letterSpacing="1">OPINION_AND_TESTIMONY</text>
                </g>

                <g className="pt-fade-2">
                    <rect x="100" y="140" width="4" height="40" fill="#c1a679" />
                    <text x="120" y="155" fill="#c1a679" fontFamily="monospace" fontSize="13" letterSpacing="2">LIABILITY_APPORTIONMENT</text>
                    <text x="120" y="175" fill="#c1a679" fontFamily="monospace" fontSize="13" letterSpacing="2">QUANTUM_VALUATION_AGREED</text>
                </g>

                <g className="pt-fade-3">
                    <text x="100" y="235" fill="#355a42" fontFamily="monospace" fontSize="9" letterSpacing="1">AUTHORISED_BY:</text>
                    <text x="100" y="275" fill="#6da57e" fontFamily="monospace" fontSize="9" letterSpacing="1">CPR_PART_35_COMPLIANT</text>
                </g>

                {/* Abstract "Signature" path drawn sequentially */}
                <path 
                    d="M 100,250 C 130,240 140,260 160,250 C 180,240 190,210 210,250 C 230,290 250,230 270,250 C 290,270 310,250 330,240" 
                    fill="none" 
                    stroke="#c1a679" 
                    strokeWidth="2" 
                    className="pt-draw-sig"
                />
                
                {/* The "Stamp" */}
                <g className="pt-stamp text-center" style={{ transformOrigin: '550px 200px' }}>
                    <circle cx="550" cy="200" r="50" stroke="#c1a679" strokeWidth="2" fill="none" />
                    <circle cx="550" cy="200" r="42" stroke="#c1a679" strokeWidth="0.5" fill="none" />
                    
                    <path id="curve" d="M 510 200 A 40 40 0 1 1 590 200" fill="transparent" />
                    <text fill="#c1a679" fontFamily="monospace" fontSize="8" letterSpacing="2">
                        <textPath href="#curve" startOffset="50%" textAnchor="middle">MERITUS VIA</textPath>
                    </text>

                    <path id="curve_bottom" d="M 590 200 A 40 40 0 0 1 510 200" fill="transparent" />
                    <text fill="#c1a679" fontFamily="monospace" fontSize="8" letterSpacing="1">
                        <textPath href="#curve_bottom" startOffset="50%" textAnchor="middle" dominantBaseline="hanging">TESTIFYING PARTNER</textPath>
                    </text>

                    <text x="550" y="204" fill="#c1a679" fontFamily="serif" fontSize="14" fontStyle="italic" letterSpacing="1" textAnchor="middle">
                        Verified
                    </text>
                </g>

            </svg>
        </div>
    );
}
