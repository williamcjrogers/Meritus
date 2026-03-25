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
    <section className="bg-green-dark py-16 lg:py-20">
      <div className="max-w-[1100px] mx-auto px-6 text-center">

        <div className="font-mono text-brass/80 text-[12px] md:text-[14px] tracking-[6px] font-bold mb-16 uppercase">
          How we engage
        </div>

        <div ref={containerRef} className={`relative w-full ${isInView ? "animate-sequencer" : ""}`}>

          <SequencerTimeline />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-10 mt-6 lg:mt-8">
            {STEPS.map((step, index) => (
              <div key={step.num} className={`step-block step-${index + 1} flex flex-col items-center text-center`}>
                <div className="font-mono text-brass text-[12px] md:text-[13px] tracking-[2px] mb-[10px] md:mb-[15px]">
                  {step.num}
                </div>
                <div className="font-serif text-cream text-xl md:text-[26px] font-normal mb-[8px] md:mb-[12px]">
                  {step.label}
                </div>
                <div className="font-mono text-cream/70 text-[10px] md:text-[11px] tracking-[1px] mb-[6px] md:mb-[8px] lowercase">
                  {step.desc}
                </div>
                <div className="font-mono text-cream/40 text-[8px] md:text-[9px] tracking-[1.5px] lowercase">
                  {step.disciplines}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-[10px] md:text-[11px] text-cream/30 italic tracking-wide">
            *Conflict check is only where required
          </div>

        </div>

      </div>
    </section>
  );
}
