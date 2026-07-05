import Link from "next/link";
import { FadeIn, ProjectPulse } from "@/components/animations";
import { CTABand } from "@/components/ui";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Claims Intelligence",
  description:
    "Proprietary legal research and case law intelligence for construction disputes. 60+ UK authorities, RICS guidance, standard form contract analysis, and judicial trend mapping.",
  path: "/claims-intelligence",
  keywords: [
    "construction case law research",
    "RICS guidance construction",
    "NEC JCT FIDIC contract analysis",
    "adjudication case authorities",
    "construction judicial trends",
  ],
});

const PLATFORM_STATS = [
  { value: "60", label: "Case Authorities" },
  { value: "26", label: "RICS Guidance Notes" },
  { value: "4", label: "Contract Forms" },
  { value: "76", label: "Sources Indexed" },
];

const MODULES = [
  {
    num: "01",
    title: "Case Law Database",
    description:
      "60 UK construction law cases with full analysis,from foundational authorities to the latest TCC and Court of Appeal decisions. Each case includes the ratio, practical implications, and cross-references to related authorities.",
    tags: ["Walter Lilly v Mackay", "Triple Point v PTT", "Bresco v Lonsdale", "Grove v S&T"],
  },
  {
    num: "02",
    title: "RICS Guidance Library",
    description:
      "26 professional guidance notes across four categories. Searchable and cross-referenced with relevant case law and contract provisions. Kept current as new guidance is published.",
    tags: ["Surveying practice", "Expert witness", "Valuation", "Contract administration"],
  },
  {
    num: "03",
    title: "Standard Form Contracts",
    description:
      "Key clauses and cross-comparison across JCT, ICE, NEC, and FIDIC contract suites. Extension of time mechanisms, loss and expense provisions, termination, and dispute resolution clauses,mapped side by side.",
    tags: ["JCT", "ICE", "NEC3/NEC4", "FIDIC"],
  },
  {
    num: "04",
    title: "Legislation & Statutory Framework",
    description:
      "HGCRA 1996, Building Safety Act 2022, Defective Premises Act 1972, and the Limitation Act 1980,with annotations on recent amendments, practical impact, and connections to leading case law.",
    tags: ["HGCRA 1996", "BSA 2022", "DPA 1972", "Limitation Act 1980"],
  },
  {
    num: "05",
    title: "Expert Evidence & Methodology",
    description:
      "CPR Part 35 duties, SCL Protocol delay analysis methods, disruption quantification techniques, and the evolving requirements around technology-assisted evidence and AI disclosure.",
    tags: ["CPR Part 35", "SCL Protocol", "Disruption analysis", "AI disclosure"],
  },
  {
    num: "06",
    title: "Trend Analysis",
    description:
      "Judicial trends in quantum assessment, delay analysis methodology, expert evidence standards, and Building Safety Act jurisprudence. Pattern recognition across recent decisions to inform strategy.",
    tags: ["Quantum trends", "Delay methodology", "BSA 2022 case law", "Expert evidence"],
  },
];

const FEATURED_AUTHORITIES = [
  {
    name: "Walter Lilly & Co Ltd v Mackay",
    cite: "[2012] EWHC 1773 (TCC)",
    note: "Leading authority on global claims and concurrent delay analysis in English law.",
  },
  {
    name: "Triple Point Technology v PTT",
    cite: "[2021] UKSC 29",
    note: "Supreme Court resolution on LADs surviving termination of construction contracts.",
  },
  {
    name: "Bresco v Lonsdale",
    cite: "[2020] UKSC 25",
    note: "Insolvent parties may adjudicate to crystallise claims in the insolvency process.",
  },
  {
    name: "Adriatic Land 5 v Long Leaseholders",
    cite: "[2025] EWCA Civ",
    note: "Landlords cannot recover BSA remediation costs from leaseholders,driving claims up the supply chain.",
  },
];

export default function ClaimsIntelligencePage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-green pt-[clamp(7rem,14vh,9rem)] pb-[clamp(4rem,10vh,7rem)] relative overflow-hidden">
        <ProjectPulse className="z-0 opacity-30" />
        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%] relative z-10">
          <FadeIn>
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-brass/80 mb-6">
              Claims Intelligence Layer
            </div>
            <h1 className="font-serif text-4xl lg:text-[52px] text-cream leading-[1.1] max-w-4xl">
              The legal research engine behind every opinion.
            </h1>
            <p className="mt-8 text-[15px] lg:text-[16px] font-sans font-light tracking-[0.01em] text-cream/70 max-w-2xl leading-[1.8]">
              A proprietary knowledge platform built by construction disputes practitioners.
              Case law, statutory frameworks, contract analysis, and RICS guidance —
              structured for the speed that adjudication and arbitration demand.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-5">
              <a
                href="https://intelligence.meritusvia.com/dashboard"
                className="btn-brass group"
              >
                Access Dashboard
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
                  <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Stats Strip */}
      <section className="bg-green-dark grain py-12 lg:py-14">
        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%]">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-8">
            {PLATFORM_STATS.map((stat, i) => (
              <div
                key={stat.label}
                className={`flex flex-col items-center ${i > 0 ? "lg:border-l lg:border-brass/15" : ""} ${i % 2 !== 0 ? "max-lg:border-l max-lg:border-brass/15" : ""}`}
              >
                <span className="font-serif text-3xl lg:text-4xl text-cream/80 leading-none">
                  {stat.value}
                </span>
                <span className="mt-2 font-mono text-[9px] tracking-[0.25em] uppercase text-cream/30">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center font-mono text-[8px] tracking-[0.3em] uppercase text-cream/[0.12]">
            Year range: 1854,2025
          </div>
        </div>
      </section>

      {/* Access */}
      <section className="bg-parchment py-16 lg:py-20">
        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%]">
          <FadeIn>
            <div className="max-w-2xl mx-auto text-center">
              <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-slate/70 mb-4">
                Access
              </div>
              <h2 className="font-serif text-2xl lg:text-3xl text-green leading-[1.35] mb-6">
                Who can use it.
              </h2>
              <div className="space-y-4 text-[15px] lg:text-[16px] font-sans font-light tracking-[0.01em] text-slate/80 leading-[1.8]">
                <p>
                  Claims Intelligence is available to clients and instructing solicitors
                  with active matters. Dashboard credentials are issued at the point of
                  instruction and provide read-only access to the research layers relevant
                  to the engagement.
                </p>
                <p>
                  For prospective clients, we can demonstrate the platform on sample data
                  as part of an initial scoping discussion.
                </p>
              </div>
              <div className="mt-10 flex flex-wrap justify-center items-center gap-5">
                <a
                  href="https://intelligence.meritusvia.com/dashboard"
                  className="btn-brass group"
                >
                  Access Dashboard
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
                    <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* What it is */}
      <section className="bg-stone py-16 lg:py-20 border-t border-green/5">
        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%]">
          <FadeIn>
            <div className="max-w-3xl">
              <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-slate mb-4">
                The Platform
              </div>
              <h2 className="font-serif text-2xl lg:text-3xl text-green leading-[1.35] mb-6">
                Built by practitioners, not software companies.
              </h2>
              <div className="space-y-4 text-[15px] lg:text-[16px] font-sans font-light tracking-[0.01em] text-slate/80 leading-[1.8]">
                <p>
                  Claims Intelligence is Meritus Via&apos;s internal research layer,the
                  structured legal and professional knowledge base that underpins every expert
                  opinion, merits assessment, and adjudication strategy we produce.
                </p>
                <p>
                  It is not a general-purpose legal database. Every case authority, guidance
                  note, and contract clause has been selected and annotated by our senior
                  practitioners for its practical relevance to construction disputes. The
                  cross-referencing is designed for the questions that arise in live
                  instructions,not academic research.
                </p>
                <p>
                  Clients and instructing solicitors with active matters are granted dashboard
                  access, providing visibility into the authorities and frameworks informing
                  our analysis on their instruction.
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Modules Grid */}
      <section className="bg-parchment border-t border-green/5 py-16 lg:py-20">
        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%]">
          <FadeIn>
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-slate mb-4">
              Modules
            </div>
            <h2 className="font-serif text-2xl lg:text-3xl text-green leading-[1.35] mb-12">
              Six integrated research layers.
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-green/10">
            {MODULES.map((mod, i) => (
              <FadeIn key={mod.num} delay={0.1 + (i * 0.05)}>
                <div className="bg-parchment p-8 lg:p-10 h-full flex flex-col group transition-colors duration-500 hover:bg-stone">
                  <div className="font-mono text-[10px] tracking-[0.2em] text-brass/70 mb-4 flex items-center justify-between">
                    <span>{mod.num}</span>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-brass">→</span>
                  </div>
                  <h3 className="font-serif text-lg text-green leading-tight mb-4 group-hover:text-brass transition-colors duration-500">
                    {mod.title}
                  </h3>
                  <p className="text-[14px] font-sans font-light text-slate/80 leading-[1.8] flex-1">
                    {mod.description}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2 pt-6 border-t border-green/5">
                    {mod.tags.map((tag) => (
                      <span
                        key={tag}
                        className="font-mono text-[9px] tracking-[0.1em] text-green/60 bg-green/5 px-2.5 py-1.5 rounded-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Authorities */}
      <section className="bg-green grain py-16 lg:py-20">
        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%]">
          <FadeIn>
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-brass/70 mb-4">
              Key Authorities
            </div>
            <h2 className="font-serif text-2xl lg:text-3xl text-cream leading-[1.35] mb-12">
              Foundational cases, fully analysed.
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FEATURED_AUTHORITIES.map((auth, i) => (
              <FadeIn key={auth.cite} delay={0.1 + (i * 0.05)}>
                <div className="border border-cream/10 p-8 lg:p-10 bg-green-dark/30 backdrop-blur-sm group hover:border-brass/30 transition-colors duration-500">
                  <h3 className="font-serif text-lg text-cream italic leading-tight group-hover:text-brass transition-colors duration-500">
                    {auth.name}
                  </h3>
                  <div className="mt-2 font-mono text-[10px] tracking-[0.15em] text-brass/60">
                    {auth.cite}
                  </div>
                  <p className="mt-4 text-[14px] font-sans font-light text-cream/60 leading-[1.8]">
                    {auth.note}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn>
            <p className="mt-12 text-center text-[12px] text-cream/30 font-mono tracking-[0.15em] uppercase">
              + 56 additional authorities indexed and analysed
            </p>
          </FadeIn>
        </div>
      </section>

      <CTABand
        heading="Your next matter starts here."
        subtext="Speak directly with a partner. No intermediaries, no sales teams,just a confidential conversation about your case."
        leftGraphic="monogram"
      />
    </>
  );
}
