export function PhilosophyBand() {
  return (
    <section className="bg-green grain py-20 lg:py-28 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brass/15 to-transparent" aria-hidden="true" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brass/15 to-transparent" aria-hidden="true" />

      <div className="max-w-[1200px] mx-auto px-6 lg:px-[8%] relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">

          {/* Left — large numeral */}
          <div className="lg:col-span-4 text-center lg:text-right">
            <div className="font-serif text-[80px] lg:text-[120px] leading-none text-brass/25 tracking-tight">
              100
              <span className="text-[48px] lg:text-[64px] align-top">GB</span>
              <span className="text-[48px] lg:text-[64px]">+</span>
            </div>
            <div className="mt-2 font-mono text-[10px] tracking-[0.2em] uppercase text-cream/30">
              Per matter. In hours.
            </div>
          </div>

          {/* Right — copy */}
          <div className="lg:col-span-8">
            <span className="brass-rule mb-8 block" />
            <h2 className="font-serif text-3xl lg:text-[38px] text-cream leading-[1.3] mb-6">
              We automate the preparation.<br />
              <span className="italic text-cream/60">Never the judgment.</span>
            </h2>
            <p className="text-base lg:text-lg text-cream/50 leading-relaxed max-w-2xl">
              100GB of project data — correspondence, site records, contract documents,
              programme files — classified, cross-referenced, and chronologically
              structured in hours. So our partners spend their time in the analysis,
              not the archive.
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}
