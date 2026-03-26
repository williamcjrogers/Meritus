"use client";

/**
 * GovernanceTerminal — Visualizes absolute security, traceability, and human control.
 * Pure abstraction: No paragraph text, just faint geometric paths representing
 * data isolation and a 1:1 trace line culminating in an expert gate.
 */
export function GovernanceTerminal({
    className = "",
}: {
    className?: string;
}) {
    return (
        <div
            data-gov-terminal
            className={`absolute inset-0 overflow-hidden pointer-events-none flex flex-col h-full bg-[#112a1d] shadow-[0_20px_40px_rgba(0,0,0,0.1)] ${className}`}
            aria-hidden="true"
        >
            <style
                dangerouslySetInnerHTML={{
                    __html: `
        @keyframes gtSlowFade { to { opacity: 1; } }
        @keyframes gtSlowDraw { to { stroke-dashoffset: 0; } }

        .terminal-active [data-gov-terminal] .gt-fade-in {
          opacity: 0;
          animation: gtSlowFade 2s ease forwards;
        }
        
        .terminal-active [data-gov-terminal] .gt-draw-trace {
          stroke-dasharray: 300;
          stroke-dashoffset: 300;
          animation: gtSlowDraw 2s ease forwards;
        }
        
        .terminal-active [data-gov-terminal] .gt-draw-gold {
          stroke-dasharray: 200;
          stroke-dashoffset: 200;
          animation: gtSlowDraw 1.5s ease forwards;
        }

        .terminal-inactive [data-gov-terminal] * {
          opacity: 0 !important;
        }
        
        @media (prefers-reduced-motion: reduce) {
          .terminal-active [data-gov-terminal] * {
            animation: none !important;
            opacity: 1 !important;
            stroke-dashoffset: 0 !important;
          }
        }
      `,
                }}
            />

            <svg viewBox="0 0 600 500" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
                
                <g className="gt-fade-in" style={{ animationDelay: '0.5s' }}>
                    <line x1="150" y1="0" x2="150" y2="500" stroke="rgba(109, 165, 126, 0.25)" strokeWidth="1" strokeDasharray="2 6" fill="none" />
                    <line x1="450" y1="0" x2="450" y2="500" stroke="rgba(109, 165, 126, 0.25)" strokeWidth="1" strokeDasharray="2 6" fill="none" />
                    <line x1="0" y1="150" x2="600" y2="150" stroke="rgba(109, 165, 126, 0.15)" strokeWidth="1" fill="none" />
                    <line x1="0" y1="350" x2="600" y2="350" stroke="rgba(109, 165, 126, 0.15)" strokeWidth="1" fill="none" />

                    <rect x="180" y="120" width="240" height="260" stroke="rgba(109, 165, 126, 0.25)" strokeWidth="1" strokeDasharray="2 6" fill="none" />
                    <text x="190" y="110" fill="rgba(109, 165, 126, 0.4)" fontFamily="'Courier New', Courier, monospace" fontSize="10" letterSpacing="2">ISO_27001_ISOLATION // AIRGAPPED</text>
                    <text x="190" y="400" fill="rgba(109, 165, 126, 0.4)" fontFamily="'Courier New', Courier, monospace" fontSize="10" letterSpacing="2">PRIVILEGE_PROTECTED // NO_LLM_TRAINING</text>
                </g>

                <circle cx="80" cy="250" r="2" fill="rgba(109, 165, 126, 0.5)" className="gt-fade-in" style={{ animationDelay: '1s' }} />
                <text x="50" y="240" fill="rgba(109, 165, 126, 0.8)" fontFamily="'Courier New', Courier, monospace" fontSize="10" letterSpacing="2" className="gt-fade-in" style={{ animationDelay: '1s' }}>SRC:8092</text>
                
                <line x1="80" y1="250" x2="300" y2="250" stroke="rgba(109, 165, 126, 0.5)" strokeWidth="1" fill="none" className="gt-draw-trace" style={{ animationDelay: '1.5s' }} />
                <text x="190" y="240" fill="rgba(109, 165, 126, 0.8)" fontFamily="'Courier New', Courier, monospace" fontSize="10" letterSpacing="2" className="gt-fade-in" style={{ animationDelay: '2s' }}>1:1 TRACE</text>
                
                <circle cx="300" cy="250" r="4" fill="#112a1d" stroke="rgba(109, 165, 126, 0.8)" className="gt-fade-in" style={{ animationDelay: '2.5s' }} />
                <circle cx="300" cy="250" r="1.5" fill="rgba(109, 165, 126, 0.8)" className="gt-fade-in" style={{ animationDelay: '2.5s' }} />
                <text x="270" y="275" fill="rgba(109, 165, 126, 0.4)" fontFamily="'Courier New', Courier, monospace" fontSize="10" letterSpacing="2" className="gt-fade-in" style={{ animationDelay: '2.5s' }}>ALGORITHM</text>

                <line x1="300" y1="250" x2="400" y2="250" stroke="rgba(109, 165, 126, 0.5)" strokeWidth="1" fill="none" strokeDasharray="2 2" className="gt-fade-in" style={{ animationDelay: '2.5s' }} />
                
                <line x1="400" y1="230" x2="400" y2="270" stroke="#c1a679" strokeWidth="1.5" fill="none" className="gt-fade-in" style={{ animationDelay: '3s' }} />
                <text x="360" y="215" fill="#c1a679" fontFamily="'Courier New', Courier, monospace" fontSize="10" letterSpacing="2" className="gt-fade-in" style={{ animationDelay: '3s' }}>EXPERT_GATE</text>

                <line x1="400" y1="250" x2="520" y2="250" stroke="#c1a679" strokeWidth="1" fill="none" className="gt-draw-gold" style={{ animationDelay: '3.5s' }} />
                <circle cx="520" cy="250" r="2.5" fill="#c1a679" className="gt-fade-in" style={{ animationDelay: '4.5s' }} />
                <text x="430" y="240" fill="#c1a679" fontFamily="'Courier New', Courier, monospace" fontSize="10" letterSpacing="2" className="gt-fade-in" style={{ animationDelay: '4s' }}>VERIFIED</text>

            </svg>
        </div>
    );
}
