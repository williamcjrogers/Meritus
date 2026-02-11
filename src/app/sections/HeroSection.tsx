"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const lineVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, delay: 0.3 + i * 0.15, ease: [0.16, 1, 0.3, 1] },
  }),
};

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center bg-green grain overflow-hidden">
      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 25% 50%, rgba(181,151,90,0.07) 0%, transparent 70%), radial-gradient(ellipse 40% 40% at 80% 80%, rgba(11,59,36,0.4) 0%, transparent 70%)",
        }}
      />

      {/* Main content */}
      <div className="relative z-10 max-w-[1200px] mx-auto px-6 lg:px-[8%] w-full py-28 lg:py-0">
        <div className="max-w-3xl">
          <motion.div
            className="font-mono text-[10px] tracking-[0.4em] uppercase text-brass/80 mb-10"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Construction Disputes Advisory
          </motion.div>

          <div className="overflow-hidden">
            <motion.div
              className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-[84px] xl:text-[96px] text-cream leading-[1.0] tracking-tight italic"
              custom={0}
              variants={lineVariants}
              initial="hidden"
              animate="visible"
            >
              Expertise.
            </motion.div>
          </div>
          <div className="overflow-hidden">
            <motion.div
              className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-[84px] xl:text-[96px] text-cream leading-[1.0] tracking-tight italic"
              custom={1}
              variants={lineVariants}
              initial="hidden"
              animate="visible"
            >
              Evolved.
            </motion.div>
          </div>

          <motion.span
            className="brass-rule-wide mt-10 block"
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: "left" }}
          />

          <motion.p
            className="mt-8 font-serif text-xl lg:text-2xl text-cream/65 max-w-xl leading-[1.5]"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.9 }}
          >
            Forensic intelligence for high-value construction
            disputes — driven by proprietary analytical tools
            and partner-led from first instruction through to testimony.
          </motion.p>

          <motion.div
            className="mt-12 flex items-center gap-6"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.1 }}
          >
            <Link href="/contact" className="btn-brass">
              Discuss Your Matter
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <Link href="/method" className="btn-outline">
              Our Method
            </Link>
          </motion.div>
        </div>
      </div>

      {/* ── Festina Lente — anchored bottom-right like a seal ── */}
      <motion.div
        className="absolute bottom-12 right-8 lg:right-[8%] z-10 text-right hidden md:block"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.6 }}
      >
        <div className="font-mono text-[12px] tracking-[0.4em] uppercase text-brass">
          Festina Lente
        </div>
        <div className="mt-1 font-serif text-[14px] text-cream/40 italic">
          Make haste slowly
        </div>
      </motion.div>

      {/* Scroll indicator — bottom centre */}
      <motion.div
        className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 scroll-indicator hidden md:block"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
      >
        <svg width="20" height="30" viewBox="0 0 20 30" fill="none" aria-hidden="true">
          <rect x="1" y="1" width="18" height="28" rx="9" stroke="#B5975A" strokeWidth="1" opacity="0.4" />
          <circle cx="10" cy="10" r="2" fill="#B5975A" opacity="0.5" />
        </svg>
      </motion.div>
    </section>
  );
}
