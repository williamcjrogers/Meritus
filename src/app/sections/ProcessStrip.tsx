const STEPS = [
  { num: "01", label: "Conflict Check", desc: "Independence confirmed", disciplines: "all disciplines" },
  { num: "02", label: "Scoping", desc: "Strategy and resourcing", disciplines: "delay \u00b7 quantum \u00b7 technical \u00b7 advisory" },
  { num: "03", label: "Analysis", desc: "Forensic investigation", disciplines: "programme \u00b7 cost \u00b7 engineering \u00b7 strategy" },
  { num: "04", label: "Delivery", desc: "Opinion and testimony", disciplines: "report \u00b7 model \u00b7 opinion \u00b7 evidence" },
];

export function ProcessStrip() {
  return (
    <section className="bg-parchment py-14 lg:py-16 border-y border-green/8">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-[8%]">
        <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-slate mb-10 text-center">
          How we engage
        </div>

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-8 md:gap-0">
          {/* Connecting line — visible, solid brass */}
          <div className="hidden md:block absolute top-[5px] left-[12%] right-[12%] h-[2px] bg-brass/60" aria-hidden="true" />

          {STEPS.map((step) => (
            <div key={step.num} className="relative flex-1 flex flex-col items-center text-center">
              {/* Node */}
              <div className="w-3 h-3 rounded-full bg-brass border-[3px] border-parchment relative z-10 mb-4" />

              <div className="font-mono text-[10px] tracking-[0.2em] text-brass mb-1">
                {step.num}
              </div>
              <div className="font-serif text-lg text-green leading-tight mb-1">
                {step.label}
              </div>
              <div className="font-mono text-[10px] text-slate/50">
                {step.desc}
              </div>
              <div className="font-mono text-[8px] text-slate/20 mt-1" aria-hidden="true">
                {step.disciplines}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
