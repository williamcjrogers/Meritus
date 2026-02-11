"use client";

import { CountUp } from "./CountUp";

const METRICS = [
  { value: "25+", label: "Years Combined Experience" },
  { value: "100%", label: "Partner-Led Delivery" },
  { value: "28", label: "Day Adjudication Sprint" },
];

export function CredibilityBar() {
  return (
    <section className="bg-green-dark grain py-14 lg:py-16">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-[8%]">
        <div className="grid grid-cols-3 gap-0">
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
      </div>
    </section>
  );
}
