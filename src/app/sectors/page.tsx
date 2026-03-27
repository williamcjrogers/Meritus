import type { Metadata } from "next";
import Link from "next/link";
import { FadeIn, ProjectPulse, TerminalBox, RailTerminal, HighwaysTerminal, ResidentialTerminal, CommercialTerminal, EnergyTerminal, BSATerminal } from "@/components/animations";
import { CTABand, BlueprintDivider } from "@/components/ui";

export const metadata: Metadata = {
  title: "Sectors",
  description:
    "Construction disputes expertise across rail, infrastructure, residential, commercial, energy, and Building Safety Act remediation.",
};

const SECTORS = [
  {
    num: "01",
    title: "Rail & Transport Infrastructure",
    description:
      "Major rail programmes generate some of the most complex delay disputes in the UK — multi-year delivery programmes with hundreds of interface points, concurrent workstreams, and NEC-based contractual frameworks that demand precise compensation event assessment.",
    disputes: [
      "Programme-level delay analysis across multi-phase rail programmes",
      "NEC3/NEC4 compensation event assessment and time impact analysis",
      "Prolongation and disruption claims on signalling, track, and station works",
      "Rolling stock and depot facility delivery disputes",
    ],
    contracts: ["NEC3", "NEC4"],
    disciplines: [
      { label: "Delay", href: "/services#delay" },
      { label: "Quantum", href: "/services#quantum" },
      { label: "Advisory", href: "/services#advisory" },
    ],
    terminal: RailTerminal,
    reference: "¹ Core Clause 60.1, NEC4 Engineering and Construction Contract (ECC)."
  },
  {
    num: "02",
    title: "Highways & Civil Engineering",
    description:
      "Highways improvement schemes, bridge structures, and major civils programmes involve ground risk, design evolution, and sequencing complexity that routinely gives rise to extension of time and loss and expense disputes.",
    disputes: [
      "Ground condition claims and unforeseen physical conditions",
      "Design development disputes under D&B and traditional procurement",
      "Prolongation cost analysis on multi-year highway schemes",
      "Subcontractor delay and disruption claims on earthworks and structures",
    ],
    contracts: ["NEC3", "NEC4", "ICE"],
    disciplines: [
      { label: "Delay", href: "/services#delay" },
      { label: "Quantum", href: "/services#quantum" },
      { label: "Technical", href: "/services#technical" },
    ],
    terminal: HighwaysTerminal,
    reference: "² e.g., Obrascon Huarte Lain SA v HM Attorney General [2015] EWCA Civ 227 on unforeseeable ground conditions."
  },
  {
    num: "03",
    title: "Major Residential & Prime Development",
    description:
      "High-value residential programmes — from UHNW prime developments to large-scale housing delivery — present disputes that span façade defects, fit-out variations, and complex final account negotiations where the quantum can be substantial.",
    disputes: [
      "Final account disputes on complex residential fit-out and façade works",
      "Variation valuation and loss and expense claims",
      "Defect and design liability disputes on high-specification residential",
      "Sequence disruption and prolongation on phased delivery programmes",
    ],
    contracts: ["JCT", "JCT D&B", "Bespoke"],
    disciplines: [
      { label: "Quantum", href: "/services#quantum" },
      { label: "Technical", href: "/services#technical" },
      { label: "Advisory", href: "/services#advisory" },
    ],
    terminal: ResidentialTerminal,
    reference: "³ See Walter Lilly & Co Ltd v Mackay [2012] EWHC 1773 (TCC) regarding global claims and concurrent delay."
  },
  {
    num: "04",
    title: "Commercial & Mixed-Use",
    description:
      "Office, retail, and mixed-use developments involve complex M&E coordination, landlord interface issues, and multi-party contractual structures that create fertile ground for delay, quantum, and technical disputes.",
    disputes: [
      "M&E coordination failure and commissioning delay claims",
      "Curtain walling and envelope defect investigations",
      "Measured works disputes on complex commercial interiors",
      "Multi-party claims involving developer, contractor, and subcontractor chains",
    ],
    contracts: ["JCT", "JCT D&B", "NEC"],
    disciplines: [
      { label: "Delay", href: "/services#delay" },
      { label: "Quantum", href: "/services#quantum" },
      { label: "Technical", href: "/services#technical" },
    ],
    terminal: CommercialTerminal,
    reference: "⁴ Triple Point Technology, Inc v PTT Public Company Ltd [2021] UKSC 29 regarding liquidated damages."
  },
  {
    num: "05",
    title: "Energy & Power",
    description:
      "Substations, renewable energy installations, grid connections, and power generation facilities involve specialist engineering interfaces, long procurement chains, and performance-based contractual obligations that generate distinct disputes.",
    disputes: [
      "Delay and disruption on substation and grid connection programmes",
      "Performance shortfall claims on renewable energy installations",
      "Prolongation claims across extended commissioning periods",
      "Technical causation disputes on mechanical and electrical systems",
    ],
    contracts: ["NEC", "FIDIC", "Bespoke EPC"],
    disciplines: [
      { label: "Delay", href: "/services#delay" },
      { label: "Technical", href: "/services#technical" },
      { label: "Quantum", href: "/services#quantum" },
    ],
    terminal: EnergyTerminal,
    reference: "⁵ MT Højgaard A/S v E.ON Climate & Renewables UK Robin Rigg East Limited [2017] UKSC 59 on fitness for purpose obligations."
  },
  {
    num: "06",
    title: "Building Safety Act Remediation",
    description:
      "The Building Safety Act 2022 has created an entirely new category of construction dispute. Cladding remediation, fire safety compliance, and retrospective liability analysis require a forensic approach that combines technical investigation with statutory interpretation.",
    disputes: [
      "Cladding and fire safety remediation cost recovery",
      "Remediation contribution order disputes under BSA ss.116–125",
      "Design liability and material substitution causation analysis",
      "Multi-party liability allocation across developer, contractor, and design team",
    ],
    contracts: ["Statutory", "JCT", "D&B"],
    disciplines: [
      { label: "Technical", href: "/services#technical" },
      { label: "Quantum", href: "/services#quantum" },
      { label: "Advisory", href: "/services#advisory" },
    ],
    terminal: BSATerminal,
    reference: "⁶ Building Safety Act 2022, ss. 116–125 (Remediation Orders and Remediation Contribution Orders) and Defective Premises Act 1972 s.1."
  },
];

export default function SectorsPage() {
  return (
    <>
      {/* Hero */}
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
                Sector Experience
              </div>
              <div className="h-[1px] flex-1 max-w-[100px] bg-gradient-to-r from-brass/50 to-transparent" />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
              <div className="lg:col-span-8">
                <h1 className="font-serif text-4xl lg:text-[56px] text-cream leading-[1.1] mb-8">
                  The disputes change.<br />
                  <span className="text-cream/70 italic">The discipline does not.</span>
                </h1>
                
                <div className="flex gap-6 max-w-2xl">
                  <div className="w-[1px] bg-brass/30 shrink-0 mt-2" />
                  <p className="text-[15px] lg:text-lg text-cream/60 leading-relaxed">
                    Our forensic methodology is consistent. Its application is tailored to the 
                    contractual framework, procurement route, and technical context of each sector. 
                    We ingest complex project data and output clear, defensible narratives.
                  </p>
                </div>
              </div>
              
              <div className="lg:col-span-4 hidden lg:flex flex-col items-end text-right pt-4">
                <div className="inline-flex flex-col gap-3 p-6 border border-brass/10 bg-black/10 backdrop-blur-md rounded-sm relative">
                  {/* Decorative corner markers */}
                  <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-brass/40" />
                  <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-brass/40" />
                  
                  <div className="font-mono text-[9px] tracking-[0.2em] text-cream/40 uppercase mb-2">Domain Expertise</div>
                  <div className="font-mono text-[11px] tracking-[0.15em] text-brass/80">06_KEY_SECTORS</div>
                  <div className="font-mono text-[11px] tracking-[0.15em] text-brass/80">MULTI_PARTY_CONTRACTS</div>
                  <div className="font-mono text-[11px] tracking-[0.15em] text-brass/80">FORENSIC_QUANTIFICATION</div>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Sectors */}
      <section className="flex flex-col">
        {SECTORS.map((sector, i) => {
          const Terminal = sector.terminal;
          const bgClass = i % 2 === 0 ? "bg-stone" : "bg-parchment";
          
          return (
            <div key={sector.num} className={`${bgClass} relative`}>
              {/* Huge watermark number in the background */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[40vw] font-serif leading-none text-green/[0.02] select-none">
                  {sector.num}
                </div>
              </div>

              {i > 0 && (
                <div className="absolute top-0 left-0 w-full z-10">
                  <BlueprintDivider />
                </div>
              )}
              
              <div className="py-[clamp(4.5rem,8vw,8rem)] relative z-10">
                <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%]">
                    <div className={`grid grid-cols-1 gap-12 lg:gap-20 ${i % 2 === 0 ? "lg:grid-cols-[1fr_minmax(400px,500px)] 2xl:grid-cols-[1fr_550px]" : "lg:grid-cols-[minmax(400px,500px)_1fr] 2xl:grid-cols-[550px_1fr]"}`}>
                    {/* Left: Content */}
                    <div className={i % 2 !== 0 ? "order-1 lg:order-2" : "order-1 lg:order-1"}>
                      <FadeIn delay={0.1}>
                        <div className="flex items-center gap-4 mb-6">
                          <div className="font-mono text-[11px] tracking-[0.25em] text-brass/80">
                            SEC.{sector.num}
                          </div>
                          <div className="h-[1px] w-12 bg-brass/30"></div>
                        </div>

                        <h2 className="font-serif text-3xl lg:text-4xl text-green leading-tight mb-6">
                          {sector.title}
                        </h2>
                        <p className="text-[15px] lg:text-base text-slate leading-relaxed mb-8">
                          {sector.description}
                        </p>

                        <div className="space-y-8">
                          <div>
                            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-slate/50 mb-4">
                              Typical disputes
                            </div>
                            <ul className="space-y-3.5">
                              {sector.disputes.map((dispute, j) => (
                                <li
                                  key={j}
                                  className="flex items-start gap-3 text-[14px] text-ink/75 leading-relaxed"
                                >
                                  <span className="text-brass/50 mt-[3px] shrink-0">
                                    &mdash;
                                  </span>
                                  {dispute}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-8 gap-y-6 pt-4 border-t border-green/5">
                            <div>
                              <div className="font-mono text-[9px] tracking-[0.15em] uppercase text-slate/40 mb-2.5">
                                Forms:
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {sector.contracts.map((c) => (
                                  <span
                                    key={c}
                                    className="font-mono text-[9px] tracking-[0.1em] text-green/60 bg-green/5 px-2.5 py-1 rounded-sm"
                                  >
                                    {c}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div>
                              <div className="font-mono text-[9px] tracking-[0.15em] uppercase text-slate/40 mb-2.5">
                                Disciplines:
                              </div>
                              <div className="flex flex-wrap gap-3">
                                {sector.disciplines.map((d) => (
                                  <Link
                                    key={d.label}
                                    href={d.href}
                                    className="font-mono text-[10px] tracking-[0.1em] text-brass hover:text-brass-dark transition-colors duration-200"
                                  >
                                    {d.label} &rarr;
                                  </Link>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Lawyer Referencing */}
                          {sector.reference && (
                            <div className="pt-6 mt-6 border-t border-green/5">
                              <p className="font-serif text-[12px] lg:text-[13px] text-slate/80 italic leading-relaxed">
                                {sector.reference}
                              </p>
                            </div>
                          )}
                        </div>
                      </FadeIn>
                    </div>

                    {/* Right: Terminal Graphic */}
                    <div className={`relative w-full aspect-[16/10] lg:aspect-auto lg:h-full ${i % 2 !== 0 ? "order-2 lg:order-1" : "order-2 lg:order-2"}`}>
                      <div className="lg:sticky lg:top-[20vh] w-full h-auto aspect-[16/10]">
                        <FadeIn delay={0.2} className="w-full h-full">
                          <TerminalBox className="w-full h-full">
                            <Terminal />
                          </TerminalBox>
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

      <CTABand
        heading="Discuss your position"
        subtext="Direct access to a partner. No intermediaries."
      />
    </>
  );
}
