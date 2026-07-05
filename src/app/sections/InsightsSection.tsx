"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { INSIGHT_ARTICLES } from "@/lib/constants";
import { FadeIn } from "@/components/animations";

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
    <section className="bg-green-dark py-[clamp(4rem,8vw,8rem)] relative overflow-hidden border-t border-brass/5">
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay pointer-events-none" />
      
      <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%] relative z-10">
        <FadeIn delay={0.1}>
          <div className="flex items-end justify-between mb-12 lg:mb-16">
            <div>
              <div className="flex items-center gap-4 mb-6">
                <div className="font-mono text-[11px] tracking-[0.25em] text-brass/80 uppercase">
                  Insights
                </div>
              </div>
              <h2 className="font-serif text-3xl lg:text-4xl text-cream leading-tight">
                Current analysis
              </h2>
            </div>
            <Link
              href="/insights"
              className="hidden md:inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-brass hover:text-brass/70 transition-colors duration-200 mb-2 group"
            >
              <span>View all</span>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-500 translate-x-[-4px] group-hover:translate-x-0">→</span>
            </Link>
          </div>
        </FadeIn>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-10%" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-cream/10 border border-cream/10"
        >
          {INSIGHT_ARTICLES.map((article, index) => (
            <motion.div key={article.title} variants={itemVariants} className="h-full">
              <Link href={article.href} className="group block h-full">
                <article className="p-8 lg:p-10 bg-green h-full flex flex-col justify-between relative transition-colors duration-500 hover:bg-[#0B2516]">
                  {/* Hover brackets */}
                  <div className="absolute inset-3 border border-brass/0 group-hover:border-brass/20 transition-colors duration-500 pointer-events-none" />
                  
                  {/* Decorative corner markers */}
                  <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-brass/0 group-hover:border-brass/40 transition-colors duration-500" />
                  <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-brass/0 group-hover:border-brass/40 transition-colors duration-500" />

                  <div className="relative z-10">
                    <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-brass/80 mb-5">
                      {article.category}
                    </div>
                    <h3 className="font-serif text-xl lg:text-2xl text-cream leading-snug group-hover:text-brass transition-colors duration-500 mb-4">
                      {article.title}
                    </h3>
                    <p className="text-[15px] lg:text-[16px] font-sans font-light tracking-[0.01em] text-cream/60 leading-[1.8]">
                      {article.excerpt}
                    </p>
                  </div>
                  
                  <div className="mt-8 pt-6 border-t border-cream/10 flex items-center gap-3 font-mono text-[10px] text-cream/40 relative z-10">
                    <span>{article.date}</span>
                    <span className="text-cream/10">|</span>
                    <span>{article.readTime}</span>
                  </div>
                </article>
              </Link>
            </motion.div>
          ))}
        </motion.div>
        
        <div className="mt-10 flex justify-center md:hidden">
          <Link
            href="/insights"
            className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-brass group"
          >
            <span>View all</span>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-500 translate-x-[-4px] group-hover:translate-x-0">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
