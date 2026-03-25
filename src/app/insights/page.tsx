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
      <section className="bg-green pt-[clamp(7rem,14vh,9rem)] pb-[clamp(3rem,8vh,5rem)] relative overflow-hidden">
        <ProjectPulse className="z-0 opacity-30" />
        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%] relative z-10">
          <FadeIn>
            <div className="section-stamp section-stamp-on-dark mb-7">Insights</div>
            <h1 className="font-serif text-4xl lg:text-[56px] text-cream leading-[1.1] italic">Current analysis</h1>
          </FadeIn>
        </div>
      </section>

      <section className="bg-stone py-16 lg:py-20">
        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%]">
          <StaggerChildren className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12" staggerDelay={0.12}>
            {INSIGHT_ARTICLES.map((article) => (
              <StaggerItem key={article.title}><InsightCard {...article} /></StaggerItem>
            ))}
          </StaggerChildren>
        </div>
      </section>
    </>
  );
}
