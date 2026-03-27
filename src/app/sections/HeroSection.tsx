"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";

const lineVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, delay: 0.3 + i * 0.15, ease: [0.16, 1, 0.3, 1] },
  }),
};

export function HeroSection() {
  // 3D Tilt Effect Logic for the Book
  const bookRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 200, damping: 20 });
  const mouseYSpring = useSpring(y, { stiffness: 200, damping: 20 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["12deg", "-12deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-12deg", "12deg"]);
  const shineOpacity = useTransform(mouseYSpring, [-0.5, 0.5], [0, 0.25]);
  const shineY = useTransform(mouseYSpring, [-0.5, 0.5], ["-100%", "100%"]);
  const scale = useTransform(
    mouseXSpring,
    [-0.5, 0, 0.5],
    [1.02, 1, 1.02]
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!bookRef.current) return;
    const rect = bookRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

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
      <div className="relative z-10 max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%] w-full py-28 lg:py-0">
        <div className="grid items-start gap-14 lg:items-center lg:gap-12 xl:gap-16 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="max-w-3xl 2xl:max-w-4xl">
            <motion.div
              className="font-mono text-[10px] 2xl:text-[11px] tracking-[0.4em] uppercase text-brass/80 mb-12"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Construction Disputes Advisory
            </motion.div>

            <div className="overflow-hidden">
              <motion.div
                className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-[84px] xl:text-[96px] 2xl:text-[112px] 3xl:text-[128px] text-cream leading-[1.0] tracking-tight italic"
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
                className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-[84px] xl:text-[96px] 2xl:text-[112px] 3xl:text-[128px] text-cream leading-[1.0] tracking-tight italic"
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
              className="mt-10 font-serif text-xl lg:text-2xl 2xl:text-[26px] text-cream/70 max-w-2xl leading-[1.6]"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.9 }}
            >
              Forensic intelligence for high-value construction disputes, partner-led from first instruction through to testimony.
            </motion.p>

            <motion.div
              className="mt-14 flex flex-wrap items-center gap-5 sm:gap-6"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.1 }}
            >
              <Link href="/contact" className="btn-brass group/btn">
                Discuss Your Matter
                <svg 
                  width="14" 
                  height="14" 
                  viewBox="0 0 14 14" 
                  fill="none" 
                  aria-hidden="true"
                  className="transition-transform duration-300 group-hover/btn:translate-x-1"
                >
                  <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link href="/method" className="btn-outline group/btn2">
                Our Method
              </Link>
            </motion.div>

            <motion.div
              className="mt-8 flex items-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.3 }}
            >
              <Link href="/claims-intelligence" className="group flex items-center gap-2 text-[11px] font-mono tracking-[0.15em] uppercase text-brass/60 hover:text-brass transition-colors">
                <span className="border-b border-transparent hover:border-brass/40 pb-0.5 transition-colors">
                  Claims Intelligence
                </span>
                <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
              </Link>
            </motion.div>
          </div>

          {/* ── Meritus Via,Premium Etymology Glass Plate (Book Styling with 3D effect) ── */}
          <motion.aside
            className="relative w-full max-w-[420px] lg:max-w-none group ml-auto lg:translate-x-4 xl:translate-x-12 2xl:translate-x-16 perspective-[1000px]"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.2, delay: 1.05, ease: [0.16, 1, 0.3, 1] }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {/* Ambient glow behind the book */}
            <div className="absolute -inset-4 bg-brass/8 blur-3xl rounded-lg opacity-60 group-hover:opacity-100 group-hover:bg-brass/15 transition-all duration-700 pointer-events-none" />

            {/* Book Container with 3D transforms */}
            <motion.div
              ref={bookRef}
              style={{
                rotateX,
                rotateY,
                scale,
                transformStyle: "preserve-3d",
              }}
              whileHover={{ transition: { duration: 0.3 } }}
              className="relative h-full flex shadow-[0_8px_30px_rgba(0,0,0,0.4),0_0_20px_rgba(181,151,90,0.08)] group-hover:shadow-[0_20px_60px_rgba(0,0,0,0.5),0_0_40px_rgba(181,151,90,0.15)] transition-shadow duration-500 overflow-hidden rounded-r-md"
            >
              {/* Animated Shine Overlay */}
              <motion.div
                className="absolute inset-0 z-20 pointer-events-none bg-gradient-to-b from-transparent via-white/15 to-transparent"
                style={{
                  opacity: shineOpacity,
                  y: shineY,
                  scale: 2,
                }}
              />
              {/* Edge light effect */}
              <motion.div
                className="absolute inset-0 z-20 pointer-events-none border border-brass/0 group-hover:border-brass/10 rounded-r-md transition-colors duration-500"
              />

              {/* Subtle Leather Binding Edge */}
              <div
                className="w-3 sm:w-4 shrink-0 bg-gradient-to-r from-[#2a1d13] via-[#3a281c] to-[#2a1d13] relative overflow-hidden border-r border-brass/20 z-10"
                style={{ transform: "translateZ(-5px)" }}
              >
                {/* Subtle Texture */}
                <div className="absolute inset-0 opacity-30 mix-blend-overlay pointer-events-none grain" />
                {/* Thin inner shadow for depth */}
                <div className="absolute inset-y-0 right-0 w-[1px] bg-black/40" />
              </div>

              {/* Glassmorphic Panel (Book Cover) */}
              <div
                className="relative flex-1 border border-brass/15 border-l-0 bg-green-dark/40 backdrop-blur-md px-8 py-12 sm:px-10 flex flex-col justify-center items-center text-center"
                style={{ transform: "translateZ(15px)", transformStyle: "preserve-3d" }}
              >
                {/* Subtle top inner highlight */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brass/30 to-transparent opacity-50" />

                {/* Floating Content Wrapper */}
                <div
                  className="transition-transform duration-500"
                  style={{ transform: "translateZ(40px)" }}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 1.4 }}
                  >
                    <div className="font-display text-[14px] 2xl:text-[16px] tracking-[0.45em] uppercase text-transparent bg-clip-text bg-gradient-to-b from-brass-light to-brass-dark">
                      Meritus
                    </div>
                    <div className="mt-3 font-serif text-[14px] 2xl:text-[16px] text-cream/40 italic tracking-wide font-light">
                      earned · deserved · due · proper
                    </div>
                  </motion.div>

                  <motion.span
                    className="block w-12 h-px bg-gradient-to-r from-transparent via-brass/30 to-transparent my-8 mx-auto"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.8, delay: 1.6 }}
                  />

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 1.5 }}
                  >
                    <div className="font-display text-[14px] 2xl:text-[16px] tracking-[0.45em] uppercase text-transparent bg-clip-text bg-gradient-to-b from-brass-light to-brass-dark">
                      Via
                    </div>
                    <div className="mt-3 font-serif text-[14px] 2xl:text-[16px] text-cream/40 italic tracking-wide font-light">
                      the pathway
                    </div>
                  </motion.div>

                  <motion.div
                    className="mt-12 pt-10 border-t border-brass/10 w-full"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, delay: 1.9 }}
                  >
                    <div className="font-serif text-[18px] 2xl:text-[20px] text-cream/60 italic leading-relaxed">
                      Your Pathway,<br />
                      <span className="text-cream/90 font-medium">Built on Merit.</span>
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </motion.aside>
        </div>
      </div>

      {/* Scroll indicator,bottom centre */}
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
