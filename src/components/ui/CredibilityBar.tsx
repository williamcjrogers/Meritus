"use client";

import { CountUp } from "./CountUp";

const METRICS = [
  { value: "100%", label: "Partner-Led Delivery" },
  { value: "0", label: "Conflicts of Interest" },
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
              className={`${i > 0 ? "border-l border-brass/15" : ""}`}
            >
              <CountUp value={metric.value} label={metric.label} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
