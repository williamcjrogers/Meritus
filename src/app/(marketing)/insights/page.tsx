import { INSIGHT_ARTICLES } from "@/lib/constants";
import { PublicIntro } from "@/components/ui/PublicIntro";
import { InsightCard } from "@/components/ui/InsightCard";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata({
  title: "Insights",
  description:
    "Briefings on delay, quantum, technical evidence and developments in construction disputes.",
  path: "/insights",
});
export default function InsightsPage() {
  return (
    <>
      <PublicIntro
        title="Thinking through the difficult questions."
        label="Insights"
        description="Practical briefings on the issues that shape construction disputes, with the authorities and evidence behind the analysis."
      />
      <section className="public-section public-insights-index">
        <div className="public-container public-insight-grid">
          {[...INSIGHT_ARTICLES]
            .sort((a, b) => b.isoDate.localeCompare(a.isoDate))
            .map((article) => (
              <InsightCard
                key={article.slug}
                {...article}
                href={`/insights/${article.slug}`}
              />
            ))}
        </div>
      </section>
    </>
  );
}
