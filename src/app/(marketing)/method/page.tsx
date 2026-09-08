import { FadeIn, ProjectPulse, TerminalBox, DelayTerminal, QuantumTerminal, PartnerTerminal } from "@/components/animations";
import { GovernanceTerminal } from "@/components/animations/terminal-patterns";
import { CTABand } from "@/components/ui";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Method",
  description: "Intelligence, accelerated. Proprietary systems engineered in-house by our own team. AI-augmented analysis, not AI-generated opinions.",
  path: "/method",
  keywords: [
    "forensic construction technology",
    "AI construction disputes",
    "technology-assisted document review",
    "delay analysis methodology",
    "evidence structuring",
  ],
});

const capabilities = [
  {
    num: "01",
    title: "Algorithmic evidence structuring",
    desc: "The days of billing hundreds of hours to read unindexed PDFs are over. Thousands of documents, from correspondence to site records to meeting minutes, are classified and structured chronologically in hours, each one still linked to its source. The expert begins their analysis from a perfectly organised, fully traceable evidence base.",
    terminal: "delay" as const,
  },
  {
    num: "02",
    title: "Forensic interrogation pivot",
    desc: "Technology isolates the anomalies: schedule logic shifts, unapproved clause deviations, mathematical discrepancies, the documents that support a position and the documents that cut against it. Our senior practitioners then interrogate these pivot points, applying decades of site and tribunal experience to separate genuine compensable events from background noise.",
    terminal: "quantum" as const,
  },
  {
    num: "03",
    title: "Partner-led execution",
    desc: "AI cannot testify. Every judgment, liability apportionment, and valuation is formed by a testifying partner. From CPR Part 35 Expert Reports to rapid Adjudication Referrals, our outputs are entirely traceable, disclosable, and built to withstand aggressive cross-examination.",
    terminal: "partner" as const,
  },
];

const terminalComponents = {
  delay: DelayTerminal,
  quantum: QuantumTerminal,
  partner: PartnerTerminal,
};

const systems = [
  {
    label: "Site operations",
    title: "Operational platforms",
    desc: "Production systems running the day-to-day of construction businesses: compliance, training, workforce, site access, and land acquisition intelligence. We understand operational records because we build the systems that create them.",
  },
  {
    label: "Live projects",
    title: "Early warning",
    desc: "Systems that read project correspondence, programmes, and contract terms as they are generated, and flag contractual risk while there is still a commercial window to act. Scored, evidenced, and traceable to source.",
  },
  {
    label: "Disputes",
    title: "Evidence intelligence",
    desc: "The forensic platform behind our method: ingestion at scale, chronology reconstruction, and proposition testing, with every finding traceable to the underlying document and an audit trail built for disclosure.",
  },
];

export default function MethodPage() {
  return (
    <>
      <section className="bg-green pt-[clamp(8rem,16vh,12rem)] pb-[clamp(4rem,10vh,6rem)] relative overflow-hidden border-b border-brass/10">
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay pointer-events-none" />
        <ProjectPulse className="z-0 opacity-20" />
        
        {/* Abstract Technical Background Grid */}
        <div className="absolute inset-0 pointer-events-none opacity-30">
          <div className="absolute top-0 left-[15%] w-[1px] h-full bg-gradient-to-b from-transparent via-brass/20 to-transparent" />
          <div className="absolute top-0 right-[15%] w-[1px] h-full bg-gradient-to-b from-transparent via-brass/20 to-transparent" />
          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-brass/10 to-transparent" />
        </div>

        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%] relative z-10">
          <FadeIn delay={0.1}>
            <div className="flex items-center gap-4 mb-8">
              <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-brass/80">
                Method
              </div>
            </div>
          </FadeIn>
            
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
            <div className="lg:col-span-8">
              <FadeIn delay={0.2}>
                <h1 className="font-serif text-4xl lg:text-[56px] text-cream leading-[1.1] mb-8">
                  Intelligence, <span className="text-cream/70 italic">accelerated.</span>
                </h1>
              </FadeIn>
              
              <FadeIn delay={0.3}>
                <div className="flex gap-6 max-w-2xl">
                  <div className="w-[1px] bg-brass/30 shrink-0 mt-2" />
                  <p className="text-[15px] lg:text-[16px] text-cream/70 leading-[1.8] font-light tracking-[0.02em]">
                    We build, not buy. An in-house engineering team writes the systems our
                    experts deploy: tools that digest 100,000 documents in the time it takes
                    others to review 100.
                  </p>
                </div>
              </FadeIn>
            </div>
            
            <div className="lg:col-span-4 hidden lg:flex flex-col items-end text-right pt-4">
              <FadeIn delay={0.4}>
                <div className="inline-flex flex-col gap-3 p-6 border border-brass/10 bg-black/10 backdrop-blur-md rounded-sm relative">
                  {/* Decorative corner markers */}
                  <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-brass/40" />
                  <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-brass/40" />
                  
                  <div className="font-mono text-[9px] tracking-[0.2em] text-cream/40 uppercase mb-2">Processing Power</div>
                  <div className="font-mono text-[11px] tracking-[0.15em] text-brass/80">ALGORITHMIC_STRUCTURING</div>
                  <div className="font-mono text-[11px] tracking-[0.15em] text-brass/80">FORENSIC_INTERROGATION</div>
                  <div className="font-mono text-[11px] tracking-[0.15em] text-brass/80">HUMAN_TESTIMONY</div>
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>

      <section id="principle" className="bg-stone py-16 lg:py-20 scroll-mt-16 lg:scroll-mt-20">
        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%]">
          <FadeIn>
            <div className="max-w-3xl">
              <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-slate mb-4">The principle</div>
              <h2 className="font-serif text-2xl lg:text-3xl text-green leading-[1.35] mb-6">
                We automate the preparation. Never the judgment.
              </h2>
              <div className="space-y-4 text-[15px] lg:text-base text-slate leading-relaxed">
                <p>
                  The construction disputes market is racing to adopt AI as a shortcut.
                  Firms are using it to draft opinions, generate reports, and produce
                  deliverables at speed. The result is work that looks efficient but
                  cannot withstand forensic scrutiny.
                </p>
                <p>
                  We took a different view. We hired engineers and built our own systems.
                  They process over 100GB of project data per matter: correspondence,
                  site records, contract documents, programme files. Classified,
                  cross-referenced, and structured chronologically in hours rather than
                  weeks. The expert starts from an organised evidence base, not a folder
                  of unsorted PDFs.
                </p>
                <p>
                  But the tools stop where the judgment begins. Every opinion is formed
                  by a partner. Every conclusion is traceable to source. Every method is
                  disclosable. Technology clears the path so our experts can focus on the
                  only thing that wins disputes: the quality of the analysis.
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <section id="capabilities" className="bg-parchment border-t border-green/5 scroll-mt-16 lg:scroll-mt-20">
        {capabilities.map((cap, i) => {
          const Terminal = terminalComponents[cap.terminal];
          return (
            <div key={cap.num}>
              <div className="py-[clamp(2.5rem,5vw,5rem)]">
                <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%]">
                  <FadeIn>
                    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-[clamp(2rem,3.5vw,4rem)] items-center ${i % 2 === 1 ? "lg:flex-row-reverse" : ""}`}>
                      <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                        <div className="font-mono text-[10px] tracking-[0.2em] text-brass mb-3">{cap.num}</div>
                        <h2 className="font-serif text-2xl lg:text-3xl text-green leading-tight mb-6">{cap.title}</h2>
                        <p className="text-[15px] text-slate leading-relaxed">{cap.desc}</p>
                      </div>
                      <div className={i % 2 === 1 ? "lg:order-1" : ""}>
                        <TerminalBox>
                          <Terminal />
                        </TerminalBox>
                      </div>
                    </div>
                  </FadeIn>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section id="engineering" className="bg-green py-[clamp(3rem,6vw,6rem)] relative overflow-hidden scroll-mt-16 lg:scroll-mt-20">
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay pointer-events-none" />
        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%] relative z-10">
          <FadeIn>
            <div className="max-w-3xl mb-12 lg:mb-16">
              <div className="flex items-center gap-4 mb-6">
                <div className="h-[1px] w-8 bg-brass/50" />
                <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-brass/80">
                  In-house engineering
                </div>
              </div>
              <h2 className="font-serif text-2xl lg:text-[34px] text-cream leading-[1.25] mb-6">
                An engineering bench most consultancies do not have.
              </h2>
              <p className="text-[14px] lg:text-[15px] text-cream/70 leading-[1.8] font-light">
                Behind the advisory practice sits a permanent engineering team. They design,
                build, and run production software across the construction lifecycle: platforms
                running the daily operations of contracting businesses, systems watching live
                projects for emerging contractual risk, and the forensic engine our experts
                deploy on disputes. We built these systems for ourselves, to support our own
                practice. Our clients get the benefit of them on every instruction.
              </p>
            </div>
          </FadeIn>
          <FadeIn delay={0.15}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
              {systems.map((sys) => (
                <div key={sys.label} className="border-t border-brass/30 pt-6">
                  <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-brass mb-3">{sys.label}</div>
                  <h3 className="font-serif text-xl text-cream mb-3">{sys.title}</h3>
                  <p className="text-[13px] lg:text-[14px] text-cream/60 leading-relaxed">{sys.desc}</p>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      <section id="governance" className="bg-stone py-[clamp(2.5rem,5vw,5rem)] border-t border-green/5 scroll-mt-16 lg:scroll-mt-20">
        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%]">
          <FadeIn>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-[clamp(2rem,3.5vw,4rem)] items-start">
              <div className="max-w-xl">
                <div className="font-mono text-[14px] tracking-[0.25em] uppercase text-slate mb-6">Governance</div>
                <ul className="space-y-4">
                  {["Human review and sign-off before any output leaves the firm", "Method notes accompany every technology-assisted deliverable", "Every output traceable to source documents. No black boxes.", "Client data isolated per matter. No cross-matter model training.", "Built in-house by our own engineers, not licensed from a software vendor"].map((item, i) => (
                    <li key={i} className="text-[15px] text-slate leading-relaxed flex items-start gap-3">
                      <span className="text-brass/70 text-[16px] leading-none mt-[3px] shrink-0">&bull;</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative h-full min-h-[400px]">
                <TerminalBox className="absolute inset-0 w-full h-full">
                  <GovernanceTerminal />
                </TerminalBox>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <CTABand heading="See it in practice" subtext="We demonstrate on sample data. No sales pitch." buttonText="Request a Demonstration" />
    </>
  );
}
