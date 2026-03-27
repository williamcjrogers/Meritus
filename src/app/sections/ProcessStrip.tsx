"use client";

import { useRef } from "react";
import { useInView } from "framer-motion";
import { SequencerTimeline } from "@/components/animations/SequencerTimeline";

const STEPS = [
  { num: "01", label: "Conflict Check*", desc: "Independence confirmed", disciplines: "all disciplines" },
  { num: "02", label: "Scoping", desc: "Strategy and resourcing", disciplines: "delay \u00b7 quantum \u00b7 technical \u00b7 advisory" },
  { num: "03", label: "Analysis", desc: "Forensic investigation", disciplines: "programme \u00b7 cost \u00b7 engineering \u00b7 strategy" },
  { num: "04", label: "Delivery", desc: "Opinion and testimony", disciplines: "report \u00b7 model \u00b7 opinion \u00b7 evidence" },
];

export function ProcessStrip() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-10%" });

  return (
    <section className="bg-green-dark py-[clamp(4rem,8vw,8rem)] relative overflow-hidden">
      {/* Background elements for premium feel */}
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay pointer-events-none" />

      <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%] relative z-10 text-center">

        <div className="flex items-center justify-center gap-4 mb-16 lg:mb-20">
          <div className="h-[1px] w-8 bg-brass/30"></div>
          <div className="font-mono text-brass/80 text-[11px] tracking-[0.25em] uppercase">
            How we engage
          </div>
          <div className="h-[1px] w-8 bg-brass/30"></div>
        </div>

        <div ref={containerRef} className={`relative w-full ${isInView ? "animate-sequencer" : ""}`}>

          <SequencerTimeline />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12 lg:gap-10 mt-10 lg:mt-12 relative z-10">
            {STEPS.map((step, index) => (
              <div key={step.num} className={`step-block step-${index + 1} flex flex-col items-center text-center group`}>
                <div className="font-mono text-brass/70 text-[10px] md:text-[11px] tracking-[0.2em] mb-3 group-hover:text-brass transition-colors duration-500">
                  {step.num}
                </div>
                <div className="font-serif text-cream text-xl md:text-2xl mb-3">
                  {step.label}
                </div>
                <div className="font-sans font-light text-[13px] md:text-[14px] text-cream/60 tracking-[0.02em] mb-2 lowercase">
                  {step.desc}
                </div>
                <div className="font-mono text-[9px] tracking-[0.15em] text-brass/40 lowercase group-hover:text-brass/60 transition-colors duration-500">
                  {step.disciplines}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-20 flex items-center justify-center gap-4 opacity-0 animate-[fadeUp_0.6s_ease_forwards_3.5s]">
            <div className="h-[1px] w-4 bg-cream/10"></div>
            <div className="text-[10px] md:text-[11px] text-cream/30 italic tracking-[0.05em] font-light">
              *Conflict check is only where required
            </div>
            <div className="h-[1px] w-4 bg-cream/10"></div>
          </div>

        </div>

      </div>
    </section>
  );
}
