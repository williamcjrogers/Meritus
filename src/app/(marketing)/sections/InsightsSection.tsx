import Link from "next/link";
import { INSIGHT_ARTICLES } from "@/lib/constants";
import { InsightCard } from "@/components/ui/InsightCard";
export function InsightsSection() {
  return (
    <section className="public-section">
      <div className="public-container">
        <div className="public-section-topline">
          <h2>Current thinking</h2>
          <Link href="/insights" className="public-text-link">
            All insights
          </Link>
        </div>
        <div className="public-insight-grid">
          {[...INSIGHT_ARTICLES]
            .sort((a, b) => b.isoDate.localeCompare(a.isoDate))
            .slice(0, 3)
            .map((article) => (
              <InsightCard
                key={article.slug}
                {...article}
                href={`/insights/${article.slug}`}
              />
            ))}
        </div>
      </div>
    </section>
  );
}
