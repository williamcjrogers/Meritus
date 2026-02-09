import { HallmarkLogo } from "@/components/icons/HallmarkLogo";

export function PhilosophyBand() {
  return (
    <section className="bg-green grain py-16 lg:py-24 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brass/15 to-transparent" aria-hidden="true" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brass/15 to-transparent" aria-hidden="true" />

      <div className="max-w-[900px] mx-auto px-6 lg:px-[8%] text-center relative z-10">
        <div className="mb-8 flex justify-center">
          <HallmarkLogo size="standalone" variant="light" />
        </div>
        <div className="font-mono text-[10px] tracking-[0.35em] uppercase text-brass/60 mb-6">
          Our philosophy
        </div>
        <p className="font-serif text-2xl lg:text-[30px] text-cream/90 leading-[1.4] italic">
          We do not sell hours. We deliver forensic certainty &mdash;
          every opinion traceable, every method disclosable,
          every conclusion built to withstand cross-examination.
        </p>
        <div className="mt-8 font-mono text-[11px] tracking-[0.2em] text-brass/50">
          Built on merit.
        </div>
      </div>
    </section>
  );
}
