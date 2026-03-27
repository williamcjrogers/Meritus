"use client";

import { useEffect, useState } from "react";

export function BatesStamp() {
  const [pageNumber, setPageNumber] = useState(1);

  useEffect(() => {
    const handleScroll = () => {
      // Calculate how far down the page we are
      const scrollPosition = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.body.scrollHeight;
      
      // Prevent division by zero
      if (documentHeight === windowHeight) return;

      // Calculate percentage scrolled (0 to 1)
      const scrollPercentage = scrollPosition / (documentHeight - windowHeight);
      
      // Determine how many "pages" we want the site to represent
      // Let's say every 800px of scrolling equals one "document page"
      const totalEstimatedPages = Math.max(1, Math.ceil(documentHeight / 800));
      
      // Map the scroll percentage to a page number (1 to total pages)
      const currentPage = Math.floor(scrollPercentage * (totalEstimatedPages - 1)) + 1;
      
      setPageNumber(currentPage);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    
    // Initial calculation
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Format number to be 6 digits, e.g., 000001
  const formattedNumber = pageNumber.toString().padStart(6, "0");

  return (
    <div className="fixed bottom-6 right-6 z-50 pointer-events-none hidden md:block transition-all duration-300 mix-blend-multiply opacity-80">
      <div className="flex flex-col items-center justify-center transform rotate-[-3deg] relative">
        {/* Outer stamped border */}
        <div className="absolute inset-0 border-2 border-stone-800 rounded-sm opacity-90" 
             style={{ 
               filter: 'url(#rough-edge)',
               boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4), 0 1px 1px rgba(255,255,255,0.4)' 
             }}>
        </div>
        
        {/* The "ink" content */}
        <div className="px-3 py-2 flex flex-col items-center justify-center bg-transparent z-10"
             style={{ 
               filter: 'url(#ink-bleed)',
               textShadow: '0px 1px 1px rgba(255,255,255,0.3)' 
             }}>
          <span className="block font-mono text-[9px] font-bold tracking-[0.3em] uppercase text-stone-800 mb-0.5 opacity-90">
            EVIDENCE REF
          </span>
          <div className="font-mono text-[16px] font-black tracking-[0.1em] text-stone-800">
            MV-{formattedNumber}
          </div>
        </div>

        {/* SVG Filters to make the CSS look like real stamped ink */}
        <svg className="hidden">
          <defs>
            {/* Creates the rough edges of a rubber stamp border */}
            <filter id="rough-edge">
              <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="3" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G" />
            </filter>
            {/* Creates the slightly bleeding/uneven look of wet ink pressed into paper */}
            <filter id="ink-bleed">
              <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5" xChannelSelector="R" yChannelSelector="G" />
              <feGaussianBlur stdDeviation="0.2" />
            </filter>
          </defs>
        </svg>
      </div>
    </div>
  );
}
