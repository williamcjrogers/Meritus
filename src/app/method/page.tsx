import type { Metadata } from "next";
import { FadeIn, ProjectPulse } from "@/components/animations";
import { CTABand } from "@/components/ui";

export const metadata: Metadata = {
  title: "Method",
  description: "Intelligence, accelerated. Proprietary forensic tools built by construction disputes practitioners. AI-augmented analysis, not AI-generated opinions.",
};

const capabilities = [
  { num: "01", title: "Document ingestion and classification", desc: "Thousands of documents \u2014 correspondence, instructions, site records, meeting minutes \u2014 classified and structured in hours. Relevant evidence surfaced. Gaps identified. The expert starts from an organised evidence base, not a folder of unsorted PDFs.", label: "Pattern match \u2014 redacted" },
  { num: "02", title: "Clause extraction and linkage", desc: "Cause-and-effect relationships across complex project histories, surfaced through pattern analysis and validated by expert review. Chronologies that would take weeks to compile manually, drafted in days and refined by practitioners who know what matters.", label: "Clause extraction \u2014 redacted" },
  { num: "03", title: "Schedule interrogation", desc: "Schedule data interrogated at scale. Logic changes, float consumption, and critical path shifts identified systematically. Supporting the forensic programme analysis \u2014 not replacing it.", label: "Schedule analysis \u2014 redacted" },
];

export default function MethodPage() {
  return (
    <>
      <section className="bg-green pt-32 pb-20 lg:pt-40 lg:pb-28 relative overflow-hidden">
        <ProjectPulse className="z-0 opacity-30" />
        <div className="max-w-[1200px] mx-auto px-6 lg:px-[8%] relative z-10">
          <FadeIn>
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-cream/50 mb-6">Method</div>
            <h1 className="font-serif text-4xl lg:text-[52px] text-cream leading-tight max-w-4xl">Intelligence, accelerated.</h1>
            <p className="mt-8 text-base lg:text-lg text-cream/55 max-w-2xl leading-relaxed">We do not sell software. We build tools that allow our experts to digest 10,000 documents in the time it takes others to review 100.</p>
          </FadeIn>
        </div>
      </section>

      <section className="bg-stone py-16 lg:py-20">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-[8%]">
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

      <section className="border-t border-green/5">
        {capabilities.map((cap, i) => (
          <div key={cap.num} className={`py-24 lg:py-32 ${i > 0 ? "border-t border-green/5" : ""}`}>
            <div className="max-w-[1200px] mx-auto px-6 lg:px-[8%]">
              <FadeIn>
                <div className={`grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center ${i % 2 === 1 ? "lg:flex-row-reverse" : ""}`}>
                  <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                    <div className="font-mono text-[10px] tracking-[0.2em] text-brass mb-3">{cap.num}</div>
                    <h2 className="font-serif text-2xl lg:text-3xl text-green leading-tight mb-6">{cap.title}</h2>
                    <p className="text-[15px] text-slate leading-relaxed">{cap.desc}</p>
                  </div>
                  <div className={i % 2 === 1 ? "lg:order-1" : ""}>
                    <div className="bg-green aspect-[4/3] relative overflow-hidden flex items-center justify-center">
                      <ProjectPulse className="z-0 opacity-50" />
                      <span className="relative z-10 font-mono text-[10px] text-cream/20 tracking-widest uppercase">{cap.label}</span>
                    </div>
                  </div>
                </div>
              </FadeIn>
            </div>
          </div>
        ))}
      </section>

      <section className="bg-stone py-16 lg:py-20 border-t border-green/5">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-[8%]">
          <FadeIn>
            <div className="max-w-2xl">
              <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-slate mb-4">Governance</div>
              <ul className="space-y-4">
                {["Human review and sign-off before any output leaves the firm","Method notes accompany every technology-assisted deliverable","Every output traceable to source documents. No black boxes.","Client data isolated per matter. No cross-matter model training.","Tools built by disputes practitioners, not software companies"].map((item, i) => (
                  <li key={i} className="text-[15px] text-slate leading-relaxed flex items-start gap-3">
                    <span className="text-brass/50 mt-0.5 shrink-0">&mdash;</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          </FadeIn>
        </div>
      </section>

      <CTABand heading="See it in practice" subtext="We demonstrate on sample data. No sales pitch." buttonText="Request a Demonstration" />
    </>
  );
}
