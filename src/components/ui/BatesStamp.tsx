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
    <div className="fixed bottom-4 right-6 z-50 pointer-events-none mix-blend-difference hidden md:block">
      <div className="flex flex-col items-end opacity-40">
        <span className="font-mono text-[8px] tracking-[0.3em] uppercase text-brass mb-1">
          Evidence Ref
        </span>
        <div className="font-mono text-[12px] tracking-[0.1em] text-brass border border-brass/30 px-2 py-1 bg-green-dark/10 backdrop-blur-sm">
          MV-{formattedNumber}
        </div>
      </div>
    </div>
  );
}
