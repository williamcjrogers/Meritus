"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { INSIGHT_ARTICLES } from "@/lib/constants";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
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

export function InsightsSection() {
  const [featured, ...rest] = INSIGHT_ARTICLES;

  return (
    <section className="bg-green-dark grain py-12 lg:py-16">
      <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%]">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="section-stamp mb-4 text-brass/60 border-brass/20">
              Insights
            </div>
            <h2 className="font-serif text-3xl lg:text-4xl text-cream leading-tight">
              Current analysis
            </h2>
          </div>
          <Link
            href="/insights"
            className="hidden md:inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-brass hover:text-brass-dark transition-colors duration-200"
          >
            View all
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M1 6h10M7 2l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-10%" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {featured && (
            <motion.div variants={itemVariants} className="h-full">
              <Link href={featured.href} className="group block h-full">
                <article className="h-full bg-green p-8 flex flex-col justify-end min-h-[320px] shadow-sm transition-transform duration-500 hover:-translate-y-1">
                  <div className="relative z-10 mt-auto">
                    <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-brass mb-4">
                      {featured.category}
                    </div>
                    <h3 className="font-serif text-xl lg:text-2xl text-cream leading-snug group-hover:text-brass transition-colors duration-400 mb-3">
                      {featured.title}
                    </h3>
                    <p className="text-[14px] text-cream/60 leading-relaxed mb-6">
                      {featured.excerpt}
                    </p>
                    <div className="mt-auto flex items-center gap-3 font-mono text-[10px] text-cream/40 pt-5 border-t border-cream/10">
                      <span>{featured.date}</span>
                      <span className="text-cream/15">|</span>
                      <span>{featured.readTime}</span>
                    </div>
                  </div>
                </article>
              </Link>
            </motion.div>
          )}

          {rest.map((article) => (
            <motion.div key={article.title} variants={itemVariants} className="h-full">
              <Link href={article.href} className="group block h-full">
                <article className="p-8 bg-green border border-cream/5 shadow-sm transition-all duration-400 hover:border-brass/30 hover:shadow-md hover:-translate-y-1 h-full flex flex-col justify-between">
                  <div>
                    <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-brass mb-4">
                      {article.category}
                    </div>
                    <h3 className="font-serif text-xl lg:text-2xl text-cream leading-snug group-hover:text-brass transition-colors duration-400 mb-3">
                      {article.title}
                    </h3>
                    <p className="text-[14px] text-cream/50 leading-relaxed">
                      {article.excerpt}
                    </p>
                  </div>
                  <div className="mt-6 pt-5 border-t border-cream/5 flex items-center gap-3 font-mono text-[10px] text-cream/40">
                    <span>{article.date}</span>
                    <span className="text-cream/10">|</span>
                    <span>{article.readTime}</span>
                  </div>
                </article>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
