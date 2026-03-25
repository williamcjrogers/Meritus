"use client";

import { CountUp } from "./CountUp";

const METRICS = [
  { value: "100+", label: "Years Combined Experience" },
  { value: "4", label: "Disciplines" },
  { value: "100%", label: "Partner Led" },
];

export function CredibilityBar() {
  return (
    <section className="bg-green-dark grain py-14 lg:py-16">
      <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%]">
        <div className="grid grid-cols-3 gap-y-8 gap-x-0">
          {METRICS.map((metric, i) => (
            <div
              key={metric.label}
              className={`flex flex-col items-center ${i > 0 ? "border-l border-brass/15" : ""}`}
            >
              <span className="block w-10 h-[2px] bg-brass/40 mb-5" />
              <CountUp value={metric.value} label={metric.label} />
            </div>
          ))}
        </div>
        <div className="mt-8 text-center font-mono text-[8px] tracking-[0.3em] uppercase text-cream/[0.16]" aria-hidden="true">
          delay &middot; quantum &middot; technical &middot; advisory
        </div>
      </div>
    </section>
  );
}
