"use client";

import { FadeIn } from "@/components/animations";

export function SplitComparison() {
  return (
    <section className="bg-stone py-[clamp(4rem,8vw,8rem)] relative">
      <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%] relative z-10">
        <FadeIn delay={0.1}>
          <div className="flex items-center gap-4 mb-6">
            <div className="font-mono text-[11px] tracking-[0.25em] text-brass/80 uppercase">
              The Difference
            </div>
            <div className="h-[1px] w-12 bg-brass/30"></div>
          </div>
          <h2 className="font-serif text-3xl lg:text-4xl text-green leading-tight mb-12">
            The traditional approach <span className="text-green/40 italic font-light">vs.</span> The Meritus standard.
          </h2>
        </FadeIn>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-green/10 border border-green/10">
          <FadeIn delay={0.2} className="h-full">
            <div className="p-8 lg:p-14 bg-stone-dark h-full relative group transition-colors duration-500">
              <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-ink/35 mb-10">
                Traditional approach
              </div>
              <ul className="space-y-8">
                {["Manual document review. Weeks of analyst time.", "Junior staff produce first drafts. Partners review at the end.", "Evidence gaps discovered under cross-examination."].map((item, i) => (
                  <li key={i} className="flex items-start gap-4 text-[15px] text-ink/50 leading-[1.8] font-sans font-light tracking-[0.01em]">
                    <span className="font-mono text-[10px] text-ink/20 mt-1.5 shrink-0">0{i + 1}</span>
                    <span className="relative">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-50 group-hover:opacity-100 transition-opacity duration-700" aria-hidden="true">
                <div className="w-[80%] h-px bg-ink/10 rotate-[-2deg]" />
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.3} className="h-full">
            <div className="p-8 lg:p-14 bg-green grain h-full relative overflow-hidden group">
              {/* Abstract Technical Background Grid */}
              <div className="absolute inset-0 pointer-events-none opacity-20">
                <div className="absolute top-0 right-[20%] w-[1px] h-full bg-gradient-to-b from-transparent via-brass/20 to-transparent" />
                <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-brass/10 to-transparent" />
              </div>
              
              {/* Decorative corner markers */}
              <div className="absolute top-4 left-4 w-2 h-2 border-t border-l border-brass/0 group-hover:border-brass/40 transition-colors duration-500" />
              <div className="absolute bottom-4 right-4 w-2 h-2 border-b border-r border-brass/0 group-hover:border-brass/40 transition-colors duration-500" />

              <div className="relative z-10 font-mono text-[10px] tracking-[0.25em] uppercase text-brass mb-10 flex items-center justify-between">
                <span>The Meritus method</span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-500 text-brass">→</span>
              </div>
              
              <ul className="relative z-10 space-y-8">
                {["100,000 documents ingested and analysed before the first meeting.", "Partners lead the analysis. From instruction to testimony.", "Every conclusion traceable to source. Every method disclosable."].map((item, i) => (
                  <li key={i} className="flex items-start gap-4 text-[15px] lg:text-[16px] text-cream/85 leading-[1.8] font-sans font-light tracking-[0.01em]">
                    <span className="font-mono text-[10px] text-brass/70 mt-1.5 shrink-0">0{i + 1}</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
