import type { Metadata } from "next";
import { FadeIn, ProjectPulse, TerminalBox, DelayTerminal, QuantumTerminal, PartnerTerminal } from "@/components/animations";
import { GovernanceTerminal } from "@/components/animations/terminal-patterns";
import { CTABand, BlueprintDivider } from "@/components/ui";
export const metadata: Metadata = {
  title: "Method",
  description: "Intelligence, accelerated. Proprietary forensic tools built by construction disputes practitioners. AI-augmented analysis, not AI-generated opinions.",
};

const capabilities = [
  {
    num: "01",
    title: "Algorithmic evidence structuring",
    desc: "The days of billing hundreds of hours to read unindexed PDFs are over. Thousands of documents \u2014 correspondence, site records, meeting minutes \u2014 are classified and structured chronologically in hours. The expert begins their analysis from a perfectly organised evidence base.",
    terminal: "delay" as const,
  },
  {
    num: "02",
    title: "Forensic interrogation pivot",
    desc: "Technology isolates the anomalies \u2014 schedule logic shifts, unapproved clause deviations, and mathematical discrepancies. Our senior practitioners then interrogate these pivot points, applying decades of site and tribunal experience to separate genuine compensable events from background noise.",
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

export default function MethodPage() {
  return (
    <>
      <section className="bg-green pt-[clamp(7rem,14vh,9rem)] pb-[clamp(3rem,8vh,5rem)] relative overflow-hidden">
        <ProjectPulse className="z-0 opacity-30" />
        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%] relative z-10">
          <FadeIn>
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-cream/50 mb-6">Method</div>
            <h1 className="font-serif text-4xl lg:text-[52px] text-cream leading-tight max-w-4xl">Intelligence, accelerated.</h1>
            <p className="mt-8 text-base lg:text-lg text-cream/55 max-w-2xl leading-relaxed">We do not sell software. We build tools that allow our experts to digest 100,000 documents in the time it takes others to review 100.</p>
          </FadeIn>
        </div>
      </section>

      <section className="bg-stone py-16 lg:py-20">
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
                  We took a different view. Our proprietary tools process over 100GB of
                  project data per matter — correspondence, site records, contract
                  documents, programme files — classifying, cross-referencing, and
                  structuring it chronologically in hours rather than weeks. The expert
                  starts from an organised evidence base, not a folder of unsorted PDFs.
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

      <section className="bg-parchment border-t border-green/5">
        {capabilities.map((cap, i) => {
          const Terminal = terminalComponents[cap.terminal];
          return (
            <div key={cap.num}>
              {/* Elegant Geometric Divider (only between items) */}
              {i > 0 && <BlueprintDivider />}

              <div className="py-[clamp(2.5rem,5vw,5rem)]">
                <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%]">
                  <FadeIn>
                    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-[clamp(2rem,3.5vw,4rem)] items-center ${i % 2 === 1 ? "lg:flex-row-reverse" : ""}`}>
                      <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                        <div className="font-mono text-[10px] tracking-[0.2em] text-brass mb-3">{cap.num}</div>
                        <h2 className="font-serif text-2xl lg:text-3xl text-green leading-tight mb-6">{cap.title}</h2>
                        <p className="text-[14px] text-slate leading-relaxed">{cap.desc}</p>
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

      <section className="bg-stone py-[clamp(2.5rem,5vw,5rem)] border-t border-green/5">
        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%]">
          <FadeIn>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-[clamp(2rem,3.5vw,4rem)] items-center">
              <div className="max-w-xl">
                <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-slate mb-4">Governance</div>
                <ul className="space-y-4">
                  {["Human review and sign-off before any output leaves the firm", "Method notes accompany every technology-assisted deliverable", "Every output traceable to source documents. No black boxes.", "Client data isolated per matter. No cross-matter model training.", "Tools built by disputes practitioners, not software companies"].map((item, i) => (
                    <li key={i} className="text-[15px] text-slate leading-relaxed flex items-start gap-3">
                      <span className="text-brass/50 mt-0.5 shrink-0">&mdash;</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative h-full min-h-[400px]">
                <TerminalBox className="absolute inset-0 w-full h-full border border-green/20">
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
