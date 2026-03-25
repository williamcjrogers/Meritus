"use client";

export function SplitComparison() {
  return (
    <section className="bg-stone py-16 lg:py-20">
      <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%]">
        <div className="section-stamp mb-5">
          The difference
        </div>
        <h2 className="font-serif text-3xl lg:text-4xl text-green leading-tight mb-10">
          The traditional approach vs. The Meritus standard.
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          <div className="p-8 lg:p-12 bg-stone-dark h-full relative">
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-ink/35 mb-8">
              Traditional approach
            </div>
            <ul className="space-y-5">
              {["Manual document review. Weeks of analyst time.", "Junior staff produce first drafts. Partners review at the end.", "Evidence gaps discovered under cross-examination."].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-[15px] text-ink/50 leading-relaxed">
                  <span className="font-mono text-[10px] text-ink/20 mt-1 shrink-0">0{i + 1}</span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center" aria-hidden="true">
              <div className="w-[80%] h-px bg-ink/6 rotate-[-2deg]" />
            </div>
          </div>

          <div className="p-8 lg:p-12 bg-green grain h-full relative overflow-hidden">
            <div className="relative z-10 font-mono text-[10px] tracking-[0.25em] uppercase text-brass mb-8">
              The Meritus method
            </div>
            <ul className="relative z-10 space-y-5">
              {["100,000 documents ingested and analysed before the first meeting.", "Partners lead the analysis. From instruction to testimony.", "Every conclusion traceable to source. Every method disclosable."].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-[15px] text-cream/85 leading-relaxed">
                  <span className="font-mono text-[10px] text-brass/70 mt-1 shrink-0">0{i + 1}</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
