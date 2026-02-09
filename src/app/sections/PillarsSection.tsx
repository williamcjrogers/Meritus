"use client";

import Link from "next/link";
import { SERVICE_PILLARS } from "@/lib/constants";

export function PillarsSection() {
  return (
    <section className="bg-stone py-16 lg:py-20 border-t border-green/8">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-[8%]">
        <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-slate mb-4">
          Four disciplines. One team.
        </div>
        <h2 className="font-serif text-3xl lg:text-4xl text-green leading-tight mb-10">
          What we do
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2">
          {SERVICE_PILLARS.map((pillar, index) => (
            <Link key={pillar.title} href={pillar.href} className="group block">
              <div className={`pillar-card p-8 lg:p-10 border-t border-green/8 ${index % 2 === 0 ? "md:border-r md:border-r-green/8" : ""} transition-all duration-400 group-hover:bg-green`}>
                <div className="font-serif text-[48px] lg:text-[56px] leading-none text-green/8 group-hover:text-cream/10 transition-colors duration-400 mb-1">
                  0{index + 1}
                </div>
                <h3 className="font-serif text-2xl text-green group-hover:text-cream transition-colors duration-400 mb-3 leading-tight">
                  {pillar.title}
                </h3>
                <p className="text-[15px] text-ink/55 group-hover:text-cream/65 leading-relaxed transition-colors duration-400">
                  {pillar.output}
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-brass opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-[-8px] group-hover:translate-x-0">
                    View detail
                  </span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-brass opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-[-8px] group-hover:translate-x-0" aria-hidden="true">
                    <path d="M1 6h10M7 2l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
