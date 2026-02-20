"use client";

import Link from "next/link";
import { SERVICE_PILLARS } from "@/lib/constants";

/* Discipline-specific SVG watermarks — appear on hover at very low opacity */
const PILLAR_MARKS = [
  // Delay — tiny Gantt fragment with link line
  <svg key="delay" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect x="4" y="8" width="18" height="3" rx="0.5" fill="#F5F0E8" opacity="0.9" />
    <rect x="10" y="16" width="24" height="3" rx="0.5" fill="#F5F0E8" opacity="0.9" />
    <rect x="8" y="24" width="14" height="3" rx="0.5" fill="#F5F0E8" opacity="0.9" />
    <rect x="14" y="32" width="20" height="3" rx="0.5" fill="#F5F0E8" opacity="0.9" />
    <path d="M22 11 L22 16" stroke="#F5F0E8" strokeWidth="0.5" opacity="0.6" />
    <path d="M22 19 L22 24" stroke="#F5F0E8" strokeWidth="0.5" opacity="0.6" />
  </svg>,
  // Quantum — tiny table/grid fragment
  <svg key="quantum" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect x="4" y="4" width="32" height="32" stroke="#F5F0E8" strokeWidth="0.5" opacity="0.6" />
    <line x1="4" y1="12" x2="36" y2="12" stroke="#F5F0E8" strokeWidth="0.5" opacity="0.6" />
    <line x1="4" y1="20" x2="36" y2="20" stroke="#F5F0E8" strokeWidth="0.5" opacity="0.6" />
    <line x1="4" y1="28" x2="36" y2="28" stroke="#F5F0E8" strokeWidth="0.5" opacity="0.6" />
    <line x1="15" y1="4" x2="15" y2="36" stroke="#F5F0E8" strokeWidth="0.5" opacity="0.6" />
    <line x1="26" y1="4" x2="26" y2="36" stroke="#F5F0E8" strokeWidth="0.5" opacity="0.6" />
    <text x="20" y="17" textAnchor="middle" fill="#F5F0E8" fontSize="3" fontFamily="monospace" opacity="0.5">&pound;</text>
  </svg>,
  // Technical — section-through-wall with hatching
  <svg key="technical" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <line x1="8" y1="4" x2="8" y2="36" stroke="#F5F0E8" strokeWidth="1" opacity="0.7" />
    <line x1="20" y1="4" x2="20" y2="36" stroke="#F5F0E8" strokeWidth="1" opacity="0.7" />
    {/* Hatching between walls */}
    <line x1="9" y1="6" x2="19" y2="10" stroke="#F5F0E8" strokeWidth="0.3" opacity="0.4" />
    <line x1="9" y1="12" x2="19" y2="16" stroke="#F5F0E8" strokeWidth="0.3" opacity="0.4" />
    <line x1="9" y1="18" x2="19" y2="22" stroke="#F5F0E8" strokeWidth="0.3" opacity="0.4" />
    <line x1="9" y1="24" x2="19" y2="28" stroke="#F5F0E8" strokeWidth="0.3" opacity="0.4" />
    <line x1="9" y1="30" x2="19" y2="34" stroke="#F5F0E8" strokeWidth="0.3" opacity="0.4" />
    {/* Dimension line */}
    <line x1="24" y1="10" x2="24" y2="30" stroke="#F5F0E8" strokeWidth="0.3" opacity="0.5" />
    <line x1="22" y1="10" x2="26" y2="10" stroke="#F5F0E8" strokeWidth="0.3" opacity="0.5" />
    <line x1="22" y1="30" x2="26" y2="30" stroke="#F5F0E8" strokeWidth="0.3" opacity="0.5" />
  </svg>,
  // Advisory — document outline with seal
  <svg key="advisory" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
    <rect x="8" y="4" width="24" height="32" stroke="#F5F0E8" strokeWidth="0.5" opacity="0.6" />
    <line x1="12" y1="10" x2="28" y2="10" stroke="#F5F0E8" strokeWidth="0.3" opacity="0.4" />
    <line x1="12" y1="14" x2="28" y2="14" stroke="#F5F0E8" strokeWidth="0.3" opacity="0.4" />
    <line x1="12" y1="18" x2="24" y2="18" stroke="#F5F0E8" strokeWidth="0.3" opacity="0.4" />
    <line x1="12" y1="22" x2="28" y2="22" stroke="#F5F0E8" strokeWidth="0.3" opacity="0.4" />
    <line x1="12" y1="26" x2="20" y2="26" stroke="#F5F0E8" strokeWidth="0.3" opacity="0.4" />
    <circle cx="26" cy="30" r="3" stroke="#F5F0E8" strokeWidth="0.4" opacity="0.5" />
  </svg>,
];

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
                {/* Discipline watermark — appears on hover */}
                {PILLAR_MARKS[index] && (
                  <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-[0.06] transition-opacity duration-500 pointer-events-none" aria-hidden="true">
                    {PILLAR_MARKS[index]}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
