"use client";

import { FadeIn } from "@/components/animations";

export function FestinaLenteBand() {
  return (
    <section className="relative bg-green grain py-24 lg:py-32 overflow-hidden">
      {/* Top / bottom hairlines */}
      <div
        className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brass/20 to-transparent"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brass/20 to-transparent"
        aria-hidden="true"
      />

      {/* Background Watermark */}
      <div className="absolute inset-0 pointer-events-none z-0 flex items-center justify-center">
        <div className="font-serif text-[20vw] leading-none text-cream/[0.015] select-none italic">
          FL.
        </div>
      </div>

      <div className="relative z-10 max-w-[860px] 2xl:max-w-[1000px] 3xl:max-w-[1100px] mx-auto px-6 lg:px-[8%] text-center">
        {/* Subtle Framing Brackets */}
        <div className="absolute -inset-y-12 -inset-x-4 lg:-inset-x-12 pointer-events-none z-20 hidden md:block">
          <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-brass/30" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-brass/30" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-brass/30" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-brass/30" />
        </div>

        {/* Latin motto */}
        <FadeIn direction="none">
          <div className="font-mono text-[11px] sm:text-[12px] tracking-[0.5em] uppercase text-brass/60 mb-4">
            Our Maxim
          </div>
        </FadeIn>

        <FadeIn direction="up" delay={0.1}>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-[56px] text-brass leading-[1.05] tracking-tight italic">
            Festina Lente
          </h2>
        </FadeIn>

        <FadeIn direction="up" delay={0.2}>
          <p className="mt-3 font-serif text-lg sm:text-xl md:text-2xl text-cream/50 italic leading-snug">
            Make haste slowly
          </p>
        </FadeIn>

        {/* Brass divider */}
        <FadeIn direction="none" delay={0.35}>
          <span className="block w-16 h-px bg-brass/40 mx-auto mt-6 mb-6" />
        </FadeIn>

        {/* Philosophy copy */}
        <FadeIn direction="up" delay={0.4}>
          <div className="space-y-6 max-w-2xl mx-auto text-left md:text-center">
            <p className="text-[15px] lg:text-[16px] text-cream/70 leading-[1.8] font-light tracking-[0.02em]">
              Technology has given our industry extraordinary capability — and
              extraordinary risk. We see it every day: outputs accepted without
              question, analysis delegated wholesale, judgment deferred to
              machines.
            </p>
            <p className="text-[15px] lg:text-[16px] text-cream/70 leading-[1.8] font-light tracking-[0.02em]">
              We take a different view. We harness every tool at our
              disposal — proprietary systems that structure vast datasets in
              hours, not weeks. But we never let the tool do the thinking.
              Every conclusion is partner-led. Every opinion is earned.
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
