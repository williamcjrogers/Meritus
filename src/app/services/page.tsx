import type { Metadata } from "next";
import { FadeIn } from "@/components/animations";
import { CTABand } from "@/components/ui";

export const metadata: Metadata = {
  title: "Services",
  description: "Delay analysis, quantum, technical advisory, and adjudication services. Forensic construction disputes expertise from senior practitioners.",
};

const services = [
  {
    id: "delay", number: "01", title: "Delay Analysis",
    outputs: ["Forensic retrospective delay analysis", "Time Impact Analysis (TIA)", "Windows analysis and As-Planned vs As-Built", "Critical path interrogation and narrative", "NEC3/NEC4 compensation event assessment", "Narratives that survive cross-examination"],
    context: "The data indicates the critical path shifted at event 47. The contractor\u2019s narrative fails to account for concurrent delay between weeks 38 and 52. Our analysis identifies the point of divergence.",
    tools: "Primavera P6, Asta Powerproject, Microsoft Project \u2014 plus proprietary schedule interrogation tools.",
  },
  {
    id: "quantum", number: "02", title: "Quantum",
    outputs: ["Commercial valuation and damages assessment", "Prolongation cost analysis (site and head office overheads)", "Disruption and loss of productivity quantification", "Final account preparation and defence", "Forensic cost modelling", "Critique of opposing quantum positions"],
    context: "The claimed prolongation of \u00a312.4m includes \u00a33.1m of costs that pre-date the delay event. The head office overhead calculation applies Hudson where Emden is the appropriate formula. The true exposure is \u00a37.8m.",
    tools: "Forensic cost models built per instruction. Every figure sourced and auditable.",
  },
  {
    id: "technical", number: "03", title: "Technical Advisory",
    outputs: ["Root cause and failure mode analysis", "Defect investigation and causation", "Design liability assessment", "Building Safety Act remediation claims", "Fire safety and cladding disputes", "Specification compliance review"],
    context: "The water ingress at Level 14 is attributable to a design deficiency at the curtain wall interface, not workmanship. The specification was ambiguous at clause 4.3.2. The contractor relied on the design intent drawing, which omitted the secondary seal detail.",
    tools: "Technical evidence packs structured for adjudication, arbitration, and litigation.",
  },
  {
    id: "adjudication", number: "04", title: "Adjudication",
    outputs: ["The 28-day sprint: strategy and rapid mobilisation", "Merits assessment and position papers", "Evidence architecture and document control", "Referral and response structuring", "Expert reports (CPR Part 35 compliant)", "Cross-examination readiness and testimony"],
    context: "Day 1: instruction received. Day 3: document set ingested, classified, chronology drafted. Day 7: expert position paper issued. Day 21: submission filed. Day 28: decision in our client\u2019s favour.",
    tools: "Proprietary document ingestion compresses weeks of review into days.",
  },
];

export default function ServicesPage() {
  return (
    <>
      <section className="bg-green pt-32 pb-20 lg:pt-40 lg:pb-28">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-[8%]">
          <FadeIn>
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-cream/50 mb-6">Services</div>
            <h1 className="font-serif text-4xl lg:text-[52px] text-cream leading-[1.1] max-w-3xl">Four disciplines. One team.<br />Outputs, not hours.</h1>
          </FadeIn>
        </div>
      </section>

      {services.map((service) => (
        <section key={service.id} id={service.id} className="py-24 lg:py-32 border-t border-green/5">
          <div className="max-w-[1200px] mx-auto px-6 lg:px-[8%]">
            <FadeIn>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
                <div className="lg:col-span-5">
                  <div className="font-mono text-[10px] tracking-[0.2em] text-brass mb-3">{service.number}</div>
                  <h2 className="font-serif text-3xl text-green leading-tight mb-8">{service.title}</h2>
                  <ul className="space-y-3">
                    {service.outputs.map((output, i) => (
                      <li key={i} className="text-[15px] text-slate leading-relaxed flex items-start gap-2">
                        <span className="text-brass/50 mt-0.5 shrink-0">&mdash;</span>{output}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-6 text-[11px] text-slate/50">{service.tools}</p>
                </div>
                <div className="lg:col-span-7">
                  <div className="bg-green p-8 lg:p-12 h-full">
                    <div className="font-mono text-[10px] tracking-[0.15em] text-brass/60 mb-4">Illustrative analysis</div>
                    <p className="font-mono text-[14px] text-cream/60 leading-[1.8]">{service.context}</p>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </section>
      ))}

      <CTABand heading="Discuss your position" subtext="Direct access to a partner. No intermediaries." />
    </>
  );
}
