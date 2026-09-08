import Link from "next/link";
import { FadeIn, ProjectPulse, StaggerChildren, StaggerItem } from "@/components/animations";
import { InsightCard } from "@/components/ui";
import { INSIGHT_ARTICLES } from "@/lib/constants";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Insights",
  description: "Analysis and commentary on construction disputes, delay analysis, quantum, adjudication, and the Building Safety Act.",
  path: "/insights",
  keywords: [
    "construction disputes insights",
    "delay analysis adjudication",
    "Building Safety Act remediation",
    "AI in construction disputes",
    "construction law commentary",
  ],
});

export default function InsightsPage() {
  // Feature the most recent briefing; list the rest below.
  const featured = INSIGHT_ARTICLES[INSIGHT_ARTICLES.length - 1];
  const rest = INSIGHT_ARTICLES.slice(0, -1);

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
              <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-brass/80">
                Insights & Analysis
              </div>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
            <div className="lg:col-span-12 max-w-4xl">
              <FadeIn delay={0.2}>
                <h1 className="font-serif text-4xl lg:text-[56px] text-cream leading-[1.1] mb-8">
                  Current <span className="text-cream/70 italic">thinking.</span>
                </h1>
              </FadeIn>

              <FadeIn delay={0.3}>
                <div className="flex gap-6">
                  <div className="w-[1px] bg-brass/30 shrink-0 mt-2" />
                  <p className="text-[15px] lg:text-[16px] text-cream/70 leading-[1.8] font-light tracking-[0.02em]">
                    Our perspective on the evolving landscape of construction disputes.
                    Analysis of recent case law, statutory changes, and the commercial realities of modern adjudication.
                  </p>
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

          {/* Featured briefing */}
          <FadeIn delay={0.1}>
            <Link href={featured.href} className="group block relative mb-12 lg:mb-16">
              {/* Outer structural frame, visible on hover */}
              <div className="absolute -inset-2 lg:-inset-3 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-0">
                <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-brass/40" />
                <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-brass/40" />
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-brass/40" />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-brass/40" />
              </div>

              <article className="relative z-10 grid grid-cols-1 lg:grid-cols-12 bg-parchment border border-green/5 transition-all duration-500 group-hover:bg-green group-hover:border-brass/20 overflow-hidden">
                {/* Copy */}
                <div className="lg:col-span-8 p-6 lg:p-10 flex flex-col">
                  <div className="flex items-center gap-4 mb-6">
                    <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-brass">
                      Latest briefing
                    </span>
                    <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-slate/40 group-hover:text-cream/40 transition-colors duration-500">
                      {featured.category}
                    </span>
                  </div>

                  <h2 className="font-serif text-2xl lg:text-[34px] text-green group-hover:text-cream transition-colors duration-500 leading-snug mb-5 max-w-2xl">
                    {featured.title}
                  </h2>

                  <p className="text-[15px] lg:text-base text-slate/70 group-hover:text-cream/60 transition-colors duration-500 leading-relaxed max-w-2xl mb-8">
                    {featured.excerpt}
                  </p>

                  <div className="mt-auto pt-5 border-t border-green/10 group-hover:border-cream/10 transition-colors duration-500 flex items-center gap-3 font-mono text-[10px] tracking-widest text-slate/40 group-hover:text-cream/40">
                    <span>{featured.date}</span>
                    <span className="text-slate/20 group-hover:text-cream/20 transition-colors duration-500">|</span>
                    <span>{featured.readTime}</span>
                    <span className="ml-auto inline-flex items-center gap-2 text-brass opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500">
                      Read briefing <span aria-hidden="true">→</span>
                    </span>
                  </div>
                </div>

                {/* Index panel */}
                <div className="hidden lg:flex lg:col-span-4 border-l border-green/10 group-hover:border-cream/10 transition-colors duration-500 items-center justify-center relative p-10">
                  <div className="absolute top-4 right-4 font-mono text-[8px] tracking-[0.2em] text-slate/30 group-hover:text-cream/30 transition-colors duration-500">
                    IN.{String(INSIGHT_ARTICLES.length).padStart(2, "0")}
                  </div>
                  <div className="text-center">
                    <div className="font-serif text-[110px] leading-none text-green/10 group-hover:text-cream/10 transition-colors duration-500 select-none" aria-hidden="true">
                      {String(INSIGHT_ARTICLES.length).padStart(2, "0")}
                    </div>
                    <div className="mt-4 font-mono text-[9px] tracking-[0.25em] uppercase text-brass/60 group-hover:text-brass transition-colors duration-500">
                      Featured
                    </div>
                  </div>
                </div>
              </article>
            </Link>
          </FadeIn>

          {/* Earlier briefings */}
          <div className="flex items-center gap-4 mb-8">
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-slate/50">
              Earlier briefings
            </div>
            <div className="h-[1px] flex-1 bg-green/10" />
          </div>

          <StaggerChildren className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12" staggerDelay={0.15}>
            {rest.map((article) => (
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
