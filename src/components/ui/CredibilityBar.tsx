"use client";

import Link from "next/link";
import { CountUp } from "./CountUp";

const METRICS = [
  { value: "100+", label: "Years Combined Experience" },
  { value: "5", label: "Disciplines" },
  { value: "100%", label: "Partner Led" },
];

// The five disciplines double as quick links into the Services page.
const DISCIPLINES = [
  { label: "Delay", anchor: "delay" },
  { label: "Quantum", anchor: "quantum" },
  { label: "Technical", anchor: "technical" },
  { label: "Advisory", anchor: "advisory" },
  { label: "Technology", anchor: "technology" },
];

export function CredibilityBar() {
  return (
    <section className="bg-green-dark grain py-14 lg:py-16 relative overflow-hidden">
      <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%] relative z-10">
        <div className="grid grid-cols-3 gap-y-8 gap-x-0 relative">
          {METRICS.map((metric, i) => (
            <div
              key={metric.label}
              className={`relative flex flex-col items-center`}
            >
              {i > 0 && (
                <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-brass/20 to-transparent" />
              )}
              <CountUp value={metric.value} label={metric.label} />
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-[9px] tracking-[0.3em] uppercase text-cream/35">
          {DISCIPLINES.map((d, i) => (
            <span key={d.anchor} className="flex items-center gap-x-3">
              <Link
                href={`/services#${d.anchor}`}
                className="hover:text-brass focus-visible:text-brass transition-colors duration-200"
              >
                {d.label}
              </Link>
              {i < DISCIPLINES.length - 1 && (
                <span className="text-brass/25" aria-hidden="true">&middot;</span>
              )}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
