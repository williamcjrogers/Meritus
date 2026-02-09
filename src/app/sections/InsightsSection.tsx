import Link from "next/link";
import { INSIGHT_ARTICLES } from "@/lib/constants";

export function InsightsSection() {
  const [featured, ...rest] = INSIGHT_ARTICLES;

  return (
    <section className="bg-parchment py-16 lg:py-20">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-[8%]">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-slate mb-4">
              Insights
            </div>
            <h2 className="font-serif text-3xl lg:text-4xl text-green leading-tight">
              Current analysis
            </h2>
          </div>
          <Link
            href="/insights"
            className="hidden md:inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-brass hover:text-brass-dark transition-colors duration-200"
          >
            View all
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M1 6h10M7 2l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {featured && (
            <div className="lg:col-span-7">
              <Link href={featured.href} className="group block h-full">
                <article className="h-full bg-green grain p-8 lg:p-12 flex flex-col justify-end min-h-[300px]">
                  <div className="relative z-10">
                    <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-brass mb-3">
                      {featured.category}
                    </div>
                    <h3 className="font-serif text-2xl lg:text-3xl text-cream leading-snug group-hover:text-brass transition-colors duration-300 mb-3">
                      {featured.title}
                    </h3>
                    <p className="text-[15px] text-cream/55 leading-relaxed max-w-lg">
                      {featured.excerpt}
                    </p>
                    <div className="mt-4 flex items-center gap-3 font-mono text-[10px] text-cream/35">
                      <span>{featured.date}</span>
                      <span className="text-cream/15">|</span>
                      <span>{featured.readTime}</span>
                    </div>
                  </div>
                </article>
              </Link>
            </div>
          )}

          <div className="lg:col-span-5 flex flex-col gap-6">
            {rest.map((article) => (
              <Link key={article.title} href={article.href} className="group block">
                <article className="p-6 bg-stone border border-green/8 transition-all duration-300 group-hover:border-brass/25 group-hover:shadow-sm h-full">
                  <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-brass">
                    {article.category}
                  </div>
                  <h3 className="mt-2 font-serif text-lg text-green leading-snug group-hover:text-brass transition-colors duration-300">
                    {article.title}
                  </h3>
                  <p className="mt-2 text-[14px] text-ink/50 leading-relaxed">
                    {article.excerpt}
                  </p>
                  <div className="mt-3 pt-3 border-t border-green/5 flex items-center gap-3 font-mono text-[10px] text-slate/50">
                    <span>{article.date}</span>
                    <span className="text-green/10">|</span>
                    <span>{article.readTime}</span>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
