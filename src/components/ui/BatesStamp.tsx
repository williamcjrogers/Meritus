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
    <div className="fixed bottom-8 right-8 z-50 pointer-events-none hidden md:block transition-all duration-300 opacity-90">
      <div className="flex flex-col items-end transform rotate-[-2deg]">
        <div className="bg-stone/95 backdrop-blur-md p-3 border border-ink/15 shadow-[3px_4px_10px_rgba(0,0,0,0.1),_inset_1px_1px_0px_rgba(255,255,255,0.8)] rounded-sm">
          <span className="block font-mono text-[8px] tracking-[0.3em] uppercase text-ink/50 mb-1">
            Evidence Ref
          </span>
          <div className="font-mono text-[14px] font-bold tracking-[0.2em] text-ink/80" style={{ textShadow: '0px 1px 0px rgba(255,255,255,0.5)' }}>
            MV-{formattedNumber}
          </div>
        </div>
      </div>
    </div>
  );
}
