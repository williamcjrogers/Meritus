import type { Metadata } from "next";
import { FadeIn, ProjectPulse } from "@/components/animations";
import {
  TerminalBox,
  DelayTIATerminal,
  DelayWindowsTerminal,
  QuantumMeasuredMileTerminal,
  QuantumOverheadTerminal,
  AdvisoryStrategyTerminal,
  TechnicalDefectTerminal,
  TechnicalBSATerminal,
} from "@/components/animations/terminal-patterns";
import { CTABand, TerminalToggle, BlueprintDivider } from "@/components/ui";

export const metadata: Metadata = {
  title: "Services",
  description: "Delay, quantum, technical, and advisory services. Forensic construction disputes expertise from senior practitioners.",
};

const services = [
  {
    id: "delay", number: "01", title: "Delay",
    outputs: ["Forensic retrospective delay analysis", "Time Impact Analysis (TIA)", "Windows analysis and As-Planned vs As-Built", "Critical path interrogation and narrative", "NEC3/NEC4 compensation event assessment", "Narratives that survive cross-examination"],
    context: "The data indicates the critical path shifted at event 47. The contractor\u2019s narrative fails to account for concurrent delay between weeks 38 and 52. Our analysis identifies the point of divergence.",
    tools: "Primavera P6, Asta Powerproject, Microsoft Project \u2014 plus proprietary schedule interrogation tools.",
    terminal: "delay" as const,
  },
  {
    id: "quantum", number: "02", title: "Quantum",
    outputs: ["Commercial valuation and damages assessment", "Prolongation cost analysis (site and head office overheads)", "Disruption and loss of productivity quantification", "Final account preparation and defence", "Forensic cost modelling", "Critique of opposing quantum positions"],
    context: "The claimed prolongation of \u00a312.4m includes \u00a33.1m of costs that pre-date the delay event. The head office overhead calculation applies Hudson where Emden is the appropriate formula. The true exposure is \u00a37.8m.",
    tools: "Forensic cost models built per instruction. Every figure sourced and auditable.",
    terminal: "quantum" as const,
  },
  {
    id: "technical", number: "03", title: "Technical",
    outputs: ["Root cause and failure mode analysis", "Defect investigation and causation", "Design liability assessment", "Building Safety Act remediation claims", "Fire safety and cladding disputes", "Specification compliance review"],
    context: "The water ingress at Level 14 is attributable to a design deficiency at the curtain wall interface, not workmanship. The specification was ambiguous at clause 4.3.2. The contractor relied on the design intent drawing, which omitted the secondary seal detail.",
    tools: "Technical evidence packs structured for adjudication, arbitration, and litigation.",
    terminal: "technical" as const,
  },
  {
    id: "advisory", number: "04", title: "Advisory",
    outputs: ["Strategy, merits assessment, adjudication support", "Rapid evidence structuring", "Evidence architecture and document control", "Referral and response structuring", "Expert reports (CPR Part 35 compliant)", "Cross-examination readiness and testimony"],
    context: "Opponent’s £14.2m claim and 12,000 unstructured project records ingested. Restructuring isolates a systemic failure to serve notices.",
    tools: "Proprietary document ingestion compresses weeks of review into days.",
    terminal: "advisory" as const,
  },
];

function ServiceTerminal({ type }: { type: "delay" | "quantum" | "technical" | "advisory" }) {
  if (type === "technical") {
    return (
      <TerminalToggle
        labels={["Defect Causation", "BSA Compliance Scan"]}
        texts={[
          "Water ingress at Level 14 isolated. Forensic dissection of the curtain wall interface reveals the secondary seal detail was omitted from the Tier 2 contractor's shop drawings. The specification at clause 4.3.2 was ambiguous, but RFI logs confirm the Architect approved the omission. Primary causation: Design liability, not site workmanship.",
          "Elevation West as-built data cross-referenced with procurement logs and BS 8414 criteria. The specified Class A1 mineral wool was secretly substituted with combustible PIR board on floors 06–12. Intrusive core sampling confirms the absence of horizontal cavity barriers. Remediation liability isolated to the D&B contractor."
        ]}
      >
        {[
          <TerminalBox key="defect" className="border border-green/20">
            <TechnicalDefectTerminal />
          </TerminalBox>,
          <TerminalBox key="bsa" className="border border-green/20">
            <TechnicalBSATerminal />
          </TerminalBox>,
        ]}
      </TerminalToggle>
    );
  }

  if (type === "advisory") {
    return (
      <div className="flex flex-col h-full bg-green p-6 lg:p-8 relative overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-[200px] bg-gradient-to-t from-stone/10 to-transparent pointer-events-none z-0" />

        <div className="relative z-10 mb-8 min-h-[100px] animate-in fade-in duration-500">
          <div className="font-mono text-[10px] tracking-[0.15em] text-brass/60 mb-2 mt-2">
            Illustrative analysis: Claim Strategy & Merits
          </div>
          <p className="font-mono text-[13px] text-cream/70 leading-[1.8]">
            Opponent’s £14.2m claim and 12,000 unstructured project records ingested. Rapid evidence structuring isolates a systemic failure by the contractor to serve condition precedent notices under Clause 61.3. Merits assessment confirms 82% of the claim is procedurally barred. Strategy pivot: Reject commercial settlement. Offensive adjudication triggered to strike out the defective heads of claim.
          </p>
        </div>

        <div className="relative z-10 flex-1 w-full min-h-[300px]">
          <TerminalBox className="border border-green/20">
            <AdvisoryStrategyTerminal />
          </TerminalBox>
        </div>
      </div>
    );
  }

  if (type === "delay") {
    return (
      <TerminalToggle
        labels={["TIA", "Windows & As-Built"]}
        texts={[
          "Fragnets inserted for Employer Risk Events 14-19 demonstrate that while 22 days of project float were consumed, the critical path remained completely unbreached. The contractor’s theoretical 3-week Extension of Time (EoT) claim fails against native schedule logic.",
          "Window 4 (Weeks 12-16) isolated. Opponent claims a 42-day critical delay. However, as-built data cross-referenced with daily site logs confirms the contractor mitigated 18 days through concurrent steel fabrication. Net compensable delay mathematically reduced to 24 days."
        ]}
      >
        {[
          <TerminalBox key="tia" className="border border-green/20">
            <DelayTIATerminal />
          </TerminalBox>,
          <TerminalBox key="windows" className="border border-green/20">
            <DelayWindowsTerminal />
          </TerminalBox>,
        ]}
      </TerminalToggle>
    );
  }

  return (
    <TerminalToggle
      labels={["Measured Mile", "Overhead Audit"]}
      texts={[
        "The £4.2m disruption claim relies on theoretical industry indices. By ingesting turnstile data and daily allocation sheets, we established an unimpacted 'measured mile' of 0.85 hrs/unit. Applying actual achieved site productivity rates reduces the substantiated quantum to £1.1m.",
        "Audit of claimed site overheads (£85k/week) initiated. Interrogation of timesheets and gate records reveals 35% of listed resources were secretly diverted to other active projects during the prolongation period. Recalculated weekly exposure: £55.2k. Overstatement detected: £1.8m."
      ]}
    >
      {[
        <TerminalBox key="mile" className="border border-green/20">
          <QuantumMeasuredMileTerminal />
        </TerminalBox>,
        <TerminalBox key="overhead" className="border border-green/20">
          <QuantumOverheadTerminal />
        </TerminalBox>,
      ]}
    </TerminalToggle>
  );
}

export default function ServicesPage() {
  return (
    <>
      <section className="bg-green pt-[clamp(7rem,14vh,9rem)] pb-[clamp(3rem,8vh,5rem)] relative overflow-hidden">
        <ProjectPulse className="z-0 opacity-30" />
        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%] relative z-10">
          <FadeIn>
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-cream/50 mb-6">Services</div>
            <h1 className="font-serif text-4xl lg:text-[52px] text-cream leading-[1.1] max-w-3xl">Four disciplines. One team.<br />Outputs, not hours.</h1>
          </FadeIn>
        </div>
      </section>

      <div className="bg-stone pb-[clamp(1rem,2vw,2.5rem)]">
        {services.map((service, i) => (
          <div key={service.id}>
          {/* Elegant Geometric Divider (only between services) */}
          {i > 0 && <BlueprintDivider />}

          <section id={service.id} className="py-[clamp(2.5rem,5vw,5rem)]">
            <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%]">
              <FadeIn>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-[clamp(2rem,3.5vw,4rem)]">
                  <div className="lg:col-span-5">
                    <div className="font-mono text-[10px] tracking-[0.2em] text-brass mb-3">{service.number}</div>
                    <h2 className="font-serif text-3xl text-green leading-tight mb-8">{service.title}</h2>
                    <ul className="space-y-2">
                      {service.outputs.map((output, j) => (
                        <li key={j} className="text-[14px] text-slate leading-[1.6] flex items-start gap-3">
                          <span className="text-brass/50 mt-[3px] shrink-0">&mdash;</span>{output}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-5 text-[11px] text-slate/50">{service.tools}</p>
                  </div>
                  <div className="lg:col-span-7">
                    <ServiceTerminal type={service.terminal} />
                  </div>
                </div>
              </FadeIn>
            </div>
          </section>
          </div>
        ))}
      </div>

      <CTABand heading="Discuss your position" subtext="Direct access to a partner. No intermediaries." />
    </>
  );
}
