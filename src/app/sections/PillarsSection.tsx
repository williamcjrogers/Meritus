"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { SERVICE_PILLARS } from "@/lib/constants";
import { PillarPattern } from "@/components/animations/pillar-patterns/PillarPattern";
import { FadeIn } from "@/components/animations";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

export function PillarsSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-10%" });

  const [activePillar, setActivePillar] = useState<number | null>(null);
  const [hoveredPillar, setHoveredPillar] = useState<number | null>(null);

  // Auto-sequencer effect
  useEffect(() => {
    if (!isInView) return;

    const sequence = [0, 1, 2, 3];
    const duration = 600; // ms per flash
    let timeoutId: NodeJS.Timeout;

    const runSequence = (index: number) => {
      if (index >= sequence.length) {
        setActivePillar(null); // Turn off after finishing sequence
        return;
      }
      setActivePillar(sequence[index]);
      timeoutId = setTimeout(() => runSequence(index + 1), duration);
    };

    // Give the container animation time to finish before starting flash
    const initialDelay = setTimeout(() => runSequence(0), 600);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(initialDelay);
    };
  }, [isInView]);

  return (
    <section className="bg-stone grain relative overflow-hidden py-[clamp(4rem,8vw,8rem)] border-t border-green/5">
      <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%]">
        
        <FadeIn delay={0.1}>
          <div className="flex items-center gap-4 mb-6">
            <div className="font-mono text-[11px] tracking-[0.25em] text-brass/80 uppercase">
              Four disciplines. One team.
            </div>
            <div className="h-[1px] w-12 bg-brass/30"></div>
          </div>
          <h2 className="font-serif text-3xl lg:text-4xl text-green leading-tight mb-12">
            What we do
          </h2>
        </FadeIn>

        {/* CAD-style grid background for the entire section */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.05] z-0" aria-hidden="true">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="pillars-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#0B3B24" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#pillars-grid)" />
          </svg>
        </div>

        <motion.div
          ref={containerRef}
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-10%" }}
          className="grid grid-cols-1 md:grid-cols-2 relative z-10 border border-[#6da57e]/30 bg-transparent"
        >
          {SERVICE_PILLARS.map((pillar, index) => {
            const isActive = activePillar === index || hoveredPillar === index;

            return (
              <motion.div key={pillar.title} variants={itemVariants}>
                <Link
                  href={pillar.href}
                  className="block h-full"
                  onMouseEnter={() => setHoveredPillar(index)}
                  onMouseLeave={() => setHoveredPillar(null)}
                >
                  <div className={`pillar-card relative overflow-hidden h-full p-8 lg:p-10 border-t border-[#6da57e]/30 transition-all duration-300 ease-out ${isActive ? "bg-[#112a1d]" : "bg-transparent"} ${index % 2 === 0 ? "md:border-r md:border-r-[#6da57e]/30" : ""} ${index < 2 ? "md:border-t-0" : ""}`}>

                    <PillarPattern index={index} className={`transition-opacity duration-300 ${isActive ? "opacity-100" : "opacity-10"}`} />

                    <div className={`relative z-10 font-serif text-[48px] lg:text-[56px] leading-none mb-1 transition-colors duration-300 ${isActive ? "text-cream/10" : "text-green/10"}`}>
                      0{index + 1}
                    </div>

                    <h3 className={`relative z-10 font-serif text-2xl mb-3 leading-tight transition-colors duration-300 ${isActive ? "text-cream" : "text-green"}`}>
                      {pillar.title}
                    </h3>

                    <p className={`relative z-10 text-[14px] font-sans font-light tracking-[0.01em] leading-[1.8] transition-colors duration-300 ${isActive ? "text-cream/85" : "text-ink/70"}`}>
                      {pillar.output}
                    </p>

                    <div className="relative z-10 mt-4 flex items-center gap-2">
                      <span className={`font-mono text-[10px] tracking-[0.15em] uppercase text-brass transition-all duration-300 ${isActive ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"}`}>
                        View detail
                      </span>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`text-brass transition-all duration-300 ${isActive ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"}`} aria-hidden="true">
                        <path d="M1 6h10M7 2l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>

                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
