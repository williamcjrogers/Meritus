import type { Metadata } from "next";
import { FadeIn, ProjectPulse, StaggerChildren, StaggerItem } from "@/components/animations";
import { InsightCard } from "@/components/ui";
import { INSIGHT_ARTICLES } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Insights",
  description: "Analysis and commentary on construction disputes, delay analysis, quantum, adjudication, and the Building Safety Act.",
};

export default function InsightsPage() {
  return (
    <>
      <section className="bg-green pt-[clamp(8rem,16vh,12rem)] pb-[clamp(4rem,10vh,6rem)] relative overflow-hidden border-b border-brass/10">
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay pointer-events-none" />
        <ProjectPulse className="z-0 opacity-20" />
        
        {/* Abstract Technical Background Grid */}
        <div className="absolute inset-0 pointer-events-none opacity-30">
          <div className="absolute top-0 left-[15%] w-[1px] h-full bg-gradient-to-b from-transparent via-brass/20 to-transparent" />
          <div className="absolute top-0 right-[15%] w-[1px] h-full bg-gradient-to-b from-transparent via-brass/20 to-transparent" />
          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-brass/10 to-transparent" />
        </div>

        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%] relative z-10">
          <FadeIn delay={0.1}>
            <div className="flex items-center gap-4 mb-8">
              <div className="h-[1px] w-8 bg-brass/50" />
              <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-brass/80">
                Insights & Analysis
              </div>
              <div className="h-[1px] flex-1 max-w-[100px] bg-gradient-to-r from-brass/50 to-transparent" />
            </div>
          </FadeIn>
            
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
            <div className="lg:col-span-8">
              <FadeIn delay={0.2}>
                <h1 className="font-serif text-4xl lg:text-[56px] text-cream leading-[1.1] mb-8">
                  Current <span className="text-cream/70 italic">thinking.</span>
                </h1>
              </FadeIn>
              
              <FadeIn delay={0.3}>
                <div className="flex gap-6 max-w-2xl">
                  <div className="w-[1px] bg-brass/30 shrink-0 mt-2" />
                  <p className="text-[14px] lg:text-[15px] text-cream/70 leading-[1.8] font-light tracking-[0.02em]">
                    Our perspective on the evolving landscape of construction disputes. 
                    Analysis of recent case law, statutory changes, and the commercial realities of modern adjudication.
                  </p>
                </div>
              </FadeIn>
            </div>
            
            <div className="lg:col-span-4 hidden lg:flex flex-col items-end text-right pt-4">
              <FadeIn delay={0.4}>
                <div className="inline-flex flex-col gap-3 p-6 border border-brass/10 bg-black/10 backdrop-blur-md rounded-sm relative">
                  {/* Decorative corner markers */}
                  <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-brass/40" />
                  <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-brass/40" />
                  
                  <div className="font-mono text-[9px] tracking-[0.2em] text-cream/40 uppercase mb-2">Subject Matter</div>
                  <div className="font-mono text-[11px] tracking-[0.15em] text-brass/80">CASE_LAW_UPDATE</div>
                  <div className="font-mono text-[11px] tracking-[0.15em] text-brass/80">STATUTORY_COMPLIANCE</div>
                  <div className="font-mono text-[11px] tracking-[0.15em] text-brass/80">PROCEDURAL_STRATEGY</div>
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-stone py-16 lg:py-28 relative">
        {/* Subtle background watermark */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[30vw] font-serif leading-none text-green/[0.02] select-none">
            IN.
          </div>
        </div>

        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%] relative z-10">
          <StaggerChildren className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12" staggerDelay={0.15}>
            {INSIGHT_ARTICLES.map((article) => (
              <StaggerItem key={article.title} className="h-full">
                <InsightCard {...article} />
              </StaggerItem>
            ))}
          </StaggerChildren>
        </div>
      </section>
    </>
  );
}
