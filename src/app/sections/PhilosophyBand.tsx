import { HeroEnginePattern } from "@/components/animations/HeroEnginePattern";

export function PhilosophyBand() {
  return (
    <section className="py-20 lg:py-28 relative overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.15)]" style={{ background: 'radial-gradient(ellipse at 50% 50%, #153222 0%, #112a1d 100%)' }}>
      <HeroEnginePattern />

      <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%] relative z-10 flex flex-col lg:flex-row items-center">

        {/* Left Col */}
        <div className="w-full lg:w-[55%] lg:pr-16 mb-12 lg:mb-0">
          <h2 className="font-serif text-3xl lg:text-[38px] text-[#E6E4DD] font-normal m-0 mb-1">
            We automate the preparation.
          </h2>
          <h3 className="font-serif text-[28px] lg:text-[34px] italic font-normal text-[#8ba995] m-0 mb-6">
            Never the judgment.
          </h3>
          <p className="text-[15px] lg:text-[16px] text-cream/80 leading-[1.6] max-w-[520px] font-sans font-light m-0">
            100GB of project data,correspondence, site records, contract documents,
            programme files,classified, cross-referenced, and chronologically
            structured in hours. So our partners spend their time in the analysis,
            not the archive.
          </p>
        </div>

        {/* Right Col */}
        <div className="w-full lg:w-[45%] lg:pl-10 lg:border-l lg:border-[#6da57e]/20">
          <div className="font-serif text-[80px] lg:text-[100px] xl:text-[120px] leading-none text-[#5d8166] tracking-tight flex items-start justify-center lg:justify-start">
            100
            <span className="text-[32px] lg:text-[40px] xl:text-[48px] mt-2 ml-1">GB+</span>
          </div>
          <div className="mt-6 font-mono text-[11px] tracking-[2px] uppercase text-[#355a42] text-center lg:text-left">
            PER MATTER. IN HOURS.
          </div>
          <div className="mt-5 font-mono text-[8px] tracking-[1.5px] uppercase text-[#2d563a] leading-[1.8] max-w-[280px] mx-auto lg:mx-0 text-center lg:text-left">
            PROGRAMMES,CORRESPONDENCE,DRAWINGS,FIRE CERTIFICATES,COST REPORTS,SPECIFICATIONS,AS-BUILT RECORDS,MEETING MINUTES,VARIATION ORDERS,RFIS
          </div>
        </div>

      </div>
    </section>
  );
}
