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
          <TerminalBox key="defect" className="" hideBorders>
            <TechnicalDefectTerminal />
          </TerminalBox>,
          <TerminalBox key="bsa" className="" hideBorders>
            <TechnicalBSATerminal />
          </TerminalBox>,
        ]}
      </TerminalToggle>
    );
  }

  if (type === "advisory") {
    return (
      <div className="relative h-full">
        {/* Outer HUD Borders for Advisory */}
        <div className="absolute -inset-2 sm:-inset-4 pointer-events-none z-20">
          {/* Corner Brackets */}
          <div className="absolute top-0 left-0 w-3 h-3 sm:w-5 sm:h-5 border-t border-l border-[#c1a679]/60" />
          <div className="absolute top-0 right-0 w-3 h-3 sm:w-5 sm:h-5 border-t border-r border-[#c1a679]/60" />
          <div className="absolute bottom-0 left-0 w-3 h-3 sm:w-5 sm:h-5 border-b border-l border-[#c1a679]/60" />
          <div className="absolute bottom-0 right-0 w-3 h-3 sm:w-5 sm:h-5 border-b border-r border-[#c1a679]/60" />
          
          {/* Corner Markers */}
          <div className="absolute -top-4 left-0 text-[#c1a679]/50 font-mono text-[7px] sm:text-[8px] tracking-widest hidden sm:block">SYS.OP.01</div>
          <div className="absolute -bottom-4 right-0 text-[#c1a679]/50 font-mono text-[7px] sm:text-[8px] tracking-widest hidden sm:block">AXIS_LOCK</div>
        </div>

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
            <TerminalBox className="" hideBorders>
              <AdvisoryStrategyTerminal />
            </TerminalBox>
          </div>
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
          <TerminalBox key="tia" className="" hideBorders>
            <DelayTIATerminal />
          </TerminalBox>,
          <TerminalBox key="windows" className="" hideBorders>
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
        <TerminalBox key="mile" className="" hideBorders>
          <QuantumMeasuredMileTerminal />
        </TerminalBox>,
        <TerminalBox key="overhead" className="" hideBorders>
          <QuantumOverheadTerminal />
        </TerminalBox>,
      ]}
    </TerminalToggle>
  );
}

export default function ServicesPage() {
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
          <FadeIn>
            <div className="flex items-center gap-4 mb-8">
              <div className="h-[1px] w-8 bg-brass/50" />
              <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-brass/80">
                Services
              </div>
              <div className="h-[1px] flex-1 max-w-[100px] bg-gradient-to-r from-brass/50 to-transparent" />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
              <div className="lg:col-span-8">
                <h1 className="font-serif text-4xl lg:text-[56px] text-cream leading-[1.1] mb-8">
                  Four disciplines. One team.<br />
                  <span className="text-cream/70 italic">Outputs, not hours.</span>
                </h1>
                
                <div className="flex gap-6 max-w-2xl">
                  <div className="w-[1px] bg-brass/30 shrink-0 mt-2" />
                  <p className="text-[15px] lg:text-lg text-cream/60 leading-relaxed">
                    We deploy highly integrated teams across delay, quantum, technical, and advisory disciplines. 
                    No siloed departments. Just coordinated forensic expertise engineered to resolve your dispute.
                  </p>
                </div>
              </div>
              
              <div className="lg:col-span-4 hidden lg:flex flex-col items-end text-right pt-4">
                <div className="inline-flex flex-col gap-3 p-6 border border-brass/10 bg-black/10 backdrop-blur-md rounded-sm relative">
                  {/* Decorative corner markers */}
                  <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-brass/40" />
                  <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-brass/40" />
                  
                  <div className="font-mono text-[9px] tracking-[0.2em] text-cream/40 uppercase mb-2">Practice Areas</div>
                  <div className="font-mono text-[11px] tracking-[0.15em] text-brass/80">01_DELAY_ANALYSIS</div>
                  <div className="font-mono text-[11px] tracking-[0.15em] text-brass/80">02_QUANTUM_VALUATION</div>
                  <div className="font-mono text-[11px] tracking-[0.15em] text-brass/80">03_TECHNICAL_CAUSATION</div>
                  <div className="font-mono text-[11px] tracking-[0.15em] text-brass/80">04_ADVISORY_STRATEGY</div>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Services List */}
      <section className="flex flex-col">
        {services.map((service, i) => {
          const bgClass = i % 2 === 0 ? "bg-stone" : "bg-parchment";
          
          return (
            <div key={service.id} id={service.id} className={`${bgClass} relative`}>
              {/* Huge watermark number in the background */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[40vw] font-serif leading-none text-green/[0.02] select-none">
                  {service.number}
                </div>
              </div>

              {i > 0 && (
                <div className="absolute top-0 left-0 w-full z-10">
                  <BlueprintDivider />
                </div>
              )}

              <div className="py-[clamp(4.5rem,8vw,8rem)] relative z-10">
                <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%]">
                  <div className="flex items-center gap-4 mb-6">
                    <FadeIn delay={0}>
                      <div className="flex items-center gap-4">
                        <div className="font-mono text-[11px] tracking-[0.25em] text-brass/80">
                          SRV.{service.number}
                        </div>
                        <div className="h-[1px] w-12 bg-brass/30"></div>
                      </div>
                    </FadeIn>
                  </div>

                  <div className={`grid grid-cols-1 gap-12 lg:gap-20 ${i % 2 === 0 ? "lg:grid-cols-[1fr_minmax(450px,550px)] 2xl:grid-cols-[1fr_600px]" : "lg:grid-cols-[minmax(450px,550px)_1fr] 2xl:grid-cols-[600px_1fr]"}`}>
                    {/* Content Side */}
                    <div className={i % 2 !== 0 ? "order-1 lg:order-2" : "order-1 lg:order-1"}>
                      <FadeIn delay={0.1}>
                        <h2 className="font-serif text-3xl lg:text-4xl text-green leading-tight mb-6">
                          {service.title}
                        </h2>

                        <div className="space-y-8">
                          <div>
                            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-slate/50 mb-4">
                              Core Outputs
                            </div>
                            <ul className="space-y-3.5">
                              {service.outputs.map((output, j) => (
                                <li key={j} className="text-[14px] text-slate leading-[1.6] flex items-start gap-3">
                                  <span className="text-brass/50 mt-[3px] shrink-0">&mdash;</span>
                                  {output}
                                </li>
                              ))}
                            </ul>
                          </div>
                          
                          <div className="pt-6 border-t border-green/5">
                            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-slate/50 mb-4">
                              Context & Toolkit
                            </div>
                            <p className="text-[14px] text-slate/80 leading-[1.6] mb-4">
                              <span className="italic">{service.context}</span>
                            </p>
                            <p className="text-[12px] text-slate/60 bg-green/5 p-3 rounded-sm border border-green/10">
                              <span className="font-mono text-[9px] tracking-[0.1em] uppercase text-brass mr-2">Tools:</span>
                              {service.tools}
                            </p>
                          </div>
                        </div>
                      </FadeIn>
                    </div>

                    {/* Terminal Graphic Side */}
                    <div className={`relative w-full lg:h-full ${i % 2 !== 0 ? "order-2 lg:order-1" : "order-2 lg:order-2"}`}>
                      <div className="lg:sticky lg:top-[20vh] w-full h-auto">
                        <FadeIn delay={0.2} className="w-full">
                          <ServiceTerminal type={service.terminal} />
                        </FadeIn>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <CTABand heading="Discuss your position" subtext="Direct access to a partner. No intermediaries." />
    </>
  );
}
