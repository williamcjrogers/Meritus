import type { Metadata } from "next";
import { FadeIn } from "@/components/animations";
import { InsightCard } from "@/components/ui";
import { INSIGHT_ARTICLES } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Insights",
  description: "Analysis and commentary on construction disputes, delay analysis, quantum, adjudication, and the Building Safety Act.",
};

export default function InsightsPage() {
  return (
    <>
      <section className="bg-green pt-32 pb-20 lg:pt-40 lg:pb-28">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-[8%]">
          <FadeIn>
            <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-brass/70 mb-6">Insights</div>
            <h1 className="font-serif text-4xl lg:text-[56px] text-cream leading-[1.1] italic">Current analysis</h1>
          </FadeIn>
        </div>
      </section>

      <section className="bg-stone py-16 lg:py-20">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-[8%]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            {INSIGHT_ARTICLES.map((article) => (
              <FadeIn key={article.title}><InsightCard {...article} /></FadeIn>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
