"use client";

import { useState } from "react";
import Link from "next/link";
import { ComponentType } from "react";
import { motion } from "framer-motion";
import {
  FadeIn,
  ProjectPulse,
  TerminalBox,
  MurphyTerminal,
  BeaufortTerminal,
  TeesEskTerminal,
  URSTerminal,
  BalfourDLRTerminal,
  HochtiefTerminal,
  CostainTerminal,
  ChannelTunnelTerminal,
  HenryBootTerminal,
  HojgaardTerminal,
  SabicTerminal,
} from "@/components/animations";
import { CTABand, BlueprintDivider } from "@/components/ui";

interface SubSector {
  id: string;
  title: string;
  landmarkCase: {
    name: string;
    citation: string;
    year: number;
    court: string;
    summary: string;
  };
  disputes: string[];
  contracts: string[];
  disciplines: { label: string; href: string }[];
  terminal: ComponentType<{ className?: string }>;
}

interface Sector {
  num: string;
  title: string;
  description: string;
  contractContext: string;
  subSectors: SubSector[];
}

const SECTORS: Sector[] = [
  {
    num: "01",
    title: "Buildings",
    description:
      "Architect-led design, JCT-dominated procurement, and disputes that revolve around defects, variations, final accounts, and increasingly, Building Safety Act remediation. From prime residential to complex healthcare PFI, the discipline is consistent: forensic analysis of the as-built record against the contractual standard.",
    contractContext: "JCT, JCT D&B, NEC, Bespoke",
    subSectors: [
      {
        id: "residential",
        title: "Residential & Prime Development",
        landmarkCase: {
          name: "Murphy v Brentwood District Council",
          citation: "[1991] 1 AC 398",
          year: 1991,
          court: "House of Lords",
          summary:
            "Established that local authorities owe no duty of care in negligence for pure economic loss arising from defective buildings. Overruled Anns v Merton and defined the boundary between physical damage and economic loss in construction defect claims.",
        },
        disputes: [
          "Final account disputes on complex residential fit-out and facade works",
          "Variation valuation and loss and expense claims on high-specification builds",
          "Defect and design liability disputes, facade failures, and remediation",
          "Sequence disruption and prolongation on phased housing delivery programmes",
        ],
        contracts: ["JCT", "JCT D&B", "Bespoke"],
        disciplines: [
          { label: "Quantum", href: "/services#quantum" },
          { label: "Technical", href: "/services#technical" },
          { label: "Advisory", href: "/services#advisory" },
        ],
        terminal: MurphyTerminal,
      },
      {
        id: "commercial",
        title: "Commercial & Mixed-Use",
        landmarkCase: {
          name: "Beaufort Developments v Gilbert-Ash",
          citation: "[1998] UKHL 19",
          year: 1998,
          court: "House of Lords",
          summary:
            "Held that courts have inherent power to open up, review, and revise architect's certificates, and that employers retain rights of set-off against certified sums. Overruled Northern Regional Health Authority v Derek Crouch [1984].",
        },
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
        terminal: BeaufortTerminal,
      },
      {
        id: "healthcare",
        title: "Healthcare & Education",
        landmarkCase: {
          name: "Tees Esk & Wear Valleys NHS v Three Valleys Healthcare",
          citation: "[2018] EWHC 1659 (TCC)",
          year: 2018,
          court: "Technology & Construction Court",
          summary:
            "The Roseberry Park Hospital PFI case. One of the first successful terminations of a healthcare PFI contract for construction defects, involving serious failures to roofing, plumbing, and fire safety systems in a 365-bed mental health facility.",
        },
        disputes: [
          "PFI/PF2 lifecycle and defects disputes on hospital and school facilities",
          "Fire safety and compartmentation compliance failures",
          "Extension of time claims on NHS trust and university estate programmes",
          "Design liability disputes on specialist healthcare M&E systems",
        ],
        contracts: ["PFI/PF2", "NEC", "JCT D&B"],
        disciplines: [
          { label: "Delay", href: "/services#delay" },
          { label: "Technical", href: "/services#technical" },
          { label: "Advisory", href: "/services#advisory" },
        ],
        terminal: TeesEskTerminal,
      },
      {
        id: "bsa",
        title: "Building Safety Act Remediation",
        landmarkCase: {
          name: "URS Corporation v BDW Trading",
          citation: "[2025] UKSC 21",
          year: 2025,
          court: "UK Supreme Court",
          summary:
            "The first Supreme Court interpretation of the Building Safety Act 2022. Held that developers can recover voluntarily incurred remediation costs in negligence, and clarified the retrospective effect of extended limitation periods under s.135 BSA reaching back to 1992.",
        },
        disputes: [
          "Cladding and fire safety remediation cost recovery",
          "Remediation contribution order disputes under BSA ss.116-125",
          "Design liability and material substitution causation analysis",
          "Multi-party liability allocation across developer, contractor, and design team",
        ],
        contracts: ["Statutory", "JCT", "D&B"],
        disciplines: [
          { label: "Technical", href: "/services#technical" },
          { label: "Quantum", href: "/services#quantum" },
          { label: "Advisory", href: "/services#advisory" },
        ],
        terminal: URSTerminal,
      },
    ],
  },
  {
    num: "02",
    title: "Infrastructure",
    description:
      "NEC-dominated, contractor-designed, and programme-driven. Infrastructure disputes centre on compensation events, ground risk, multi-party interfaces, and programme-level delay analysis across some of the largest and most complex projects in the UK.",
    contractContext: "NEC3, NEC4, ICE, FIDIC",
    subSectors: [
      {
        id: "rail",
        title: "Rail & Transport",
        landmarkCase: {
          name: "Balfour Beatty v Docklands Light Railway",
          citation: "(1996) 78 BLR 42",
          year: 1996,
          court: "Court of Appeal",
          summary:
            "Concerned the Beckton Extension of the DLR. Established that the employer has an implied duty to act honestly, fairly, and reasonably in exercising contractual discretion when the independent certifier role has been removed.",
        },
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
        terminal: BalfourDLRTerminal,
      },
      {
        id: "highways",
        title: "Highways & Bridges",
        landmarkCase: {
          name: "Hochtief v Atkins",
          citation: "[2019] EWHC 2109 (TCC)",
          year: 2019,
          court: "Technology & Construction Court",
          summary:
            "Atkins found liable for negligent structural design on the East Kent Access Road, including Cottington Road Bridge and Cliffsend Underpass. A significant authority on designer liability and standard of care in highway and bridge engineering.",
        },
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
        terminal: HochtiefTerminal,
      },
      {
        id: "water",
        title: "Water & Utilities",
        landmarkCase: {
          name: "Costain v Charles Haswell",
          citation: "[2009] EWHC 3140 (TCC)",
          year: 2009,
          court: "Technology & Construction Court",
          summary:
            "Costain's design consultant negligently misinterpreted geological data on the Lostock and Rivington Water Treatment Works, recommending a ground treatment scheme that failed. An important authority on designer negligence in water infrastructure.",
        },
        disputes: [
          "Ground risk and unforeseen conditions on water treatment works",
          "AMP programme delay and prolongation claims for regulated utilities",
          "Tunnelling disputes on sewer and water transfer schemes",
          "Performance shortfall claims on treatment plant commissioning",
        ],
        contracts: ["NEC3", "NEC4", "ICE"],
        disciplines: [
          { label: "Technical", href: "/services#technical" },
          { label: "Quantum", href: "/services#quantum" },
          { label: "Delay", href: "/services#delay" },
        ],
        terminal: CostainTerminal,
      },
      {
        id: "tunnelling",
        title: "Tunnelling & Marine",
        landmarkCase: {
          name: "Channel Tunnel Group v Balfour Beatty",
          citation: "[1993] AC 334",
          year: 1993,
          court: "House of Lords",
          summary:
            "The Channel Tunnel case. The House of Lords held that courts can grant interlocutory injunctive relief in support of foreign arbitrations but should not pre-empt the arbitral process. The most famous tunnelling case in UK law.",
        },
        disputes: [
          "TBM performance and ground condition disputes on major tunnel schemes",
          "Marine and port construction delay and prolongation claims",
          "Multi-jurisdictional arbitration on cross-border infrastructure",
          "Coastal defence and harbour works defect and design disputes",
        ],
        contracts: ["NEC", "FIDIC", "Bespoke"],
        disciplines: [
          { label: "Delay", href: "/services#delay" },
          { label: "Technical", href: "/services#technical" },
          { label: "Advisory", href: "/services#advisory" },
        ],
        terminal: ChannelTunnelTerminal,
      },
    ],
  },
  {
    num: "03",
    title: "Energy",
    description:
      "FIDIC and bespoke EPC contracts, performance-based obligations, and specialist engineering interfaces. Energy disputes are distinct: they involve long procurement chains, commissioning complexity, and performance guarantees that create a fundamentally different dispute landscape.",
    contractContext: "FIDIC, EPC, NEC, Bespoke",
    subSectors: [
      {
        id: "power",
        title: "Power Generation & Grid",
        landmarkCase: {
          name: "Henry Boot v Alstom Combined Cycles",
          citation: "[2000] EWCA Civ 99",
          year: 2000,
          court: "Court of Appeal",
          summary:
            "Established the correct method for valuing variations under ICE Clause 52(1) where the original rates contain a pricing error. Concerned civil engineering works for a CCGT power station at Connah's Quay, North Wales.",
        },
        disputes: [
          "Delay and disruption on substation and grid connection programmes",
          "Variation valuation disputes on power station civil and M&E works",
          "Prolongation claims across extended commissioning periods",
          "Technical causation disputes on high-voltage electrical systems",
        ],
        contracts: ["NEC", "FIDIC", "ICE"],
        disciplines: [
          { label: "Delay", href: "/services#delay" },
          { label: "Quantum", href: "/services#quantum" },
          { label: "Technical", href: "/services#technical" },
        ],
        terminal: HenryBootTerminal,
      },
      {
        id: "renewables",
        title: "Renewables",
        landmarkCase: {
          name: "MT Højgaard v E.ON Climate & Renewables",
          citation: "[2017] UKSC 59",
          year: 2017,
          court: "UK Supreme Court",
          summary:
            "Offshore wind farm foundations at Robin Rigg failed. The Supreme Court held that a 20-year design life warranty was a binding fitness-for-purpose obligation that took precedence over compliance with a flawed industry design standard containing a tenfold mathematical error.",
        },
        disputes: [
          "Fitness-for-purpose and design life disputes on offshore wind foundations",
          "Performance shortfall claims on solar and onshore wind installations",
          "Grid connection delay and prolongation on renewable energy schemes",
          "EPC contractor termination and completion cost disputes",
        ],
        contracts: ["FIDIC", "Bespoke EPC"],
        disciplines: [
          { label: "Technical", href: "/services#technical" },
          { label: "Delay", href: "/services#delay" },
          { label: "Quantum", href: "/services#quantum" },
        ],
        terminal: HojgaardTerminal,
      },
      {
        id: "process",
        title: "Process & Industrial",
        landmarkCase: {
          name: "Sabic v Punj Lloyd",
          citation: "[2013] EWHC 2916 (TCC)",
          year: 2013,
          court: "Technology & Construction Court",
          summary:
            "A £135m EPC contract for an LDPE petrochemical plant at the former ICI site at Wilton, Teesside. Court upheld the justified termination of the EPC contractor and awarded £11.8m in completion costs. The leading TCC authority on EPC termination.",
        },
        disputes: [
          "EPC contractor termination and completion cost recovery",
          "Process plant commissioning disputes and performance guarantee failures",
          "Delay analysis on complex industrial installation programmes",
          "Performance bond and advance payment guarantee enforcement",
        ],
        contracts: ["EPC", "FIDIC", "Bespoke"],
        disciplines: [
          { label: "Quantum", href: "/services#quantum" },
          { label: "Delay", href: "/services#delay" },
          { label: "Advisory", href: "/services#advisory" },
        ],
        terminal: SabicTerminal,
      },
    ],
  },
];

export function SectorsClient() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <>
      {/* Hero */}
      <section className="bg-green pt-[clamp(8rem,16vh,12rem)] pb-[clamp(4rem,10vh,6rem)] relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay pointer-events-none" />
        <ProjectPulse className="z-0 opacity-20" />

        <div className="absolute inset-0 pointer-events-none opacity-30">
          <div className="absolute top-0 left-[15%] w-[1px] h-full bg-gradient-to-b from-transparent via-brass/20 to-transparent" />
          <div className="absolute top-0 right-[15%] w-[1px] h-full bg-gradient-to-b from-transparent via-brass/20 to-transparent" />
          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-brass/10 to-transparent" />
        </div>

        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%] relative z-10">
          <FadeIn delay={0.1}>
            <div className="flex items-center gap-4 mb-8">
              <div className="h-[1px] w-8 bg-brass/50" />
              <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-brass/80">
                Sector Experience
              </div>
              <div className="h-[1px] flex-1 max-w-[100px] bg-gradient-to-r from-brass/50 to-transparent" />
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
            <div className="lg:col-span-8">
              <FadeIn delay={0.2}>
                <h1 className="font-serif text-4xl lg:text-[56px] text-cream leading-[1.1] mb-8">
                  Three sectors.<br />
                  <span className="text-cream/70 italic">One forensic standard.</span>
                </h1>
              </FadeIn>

              <FadeIn delay={0.3}>
                <div className="flex gap-6 max-w-2xl">
                  <div className="w-[1px] bg-brass/30 shrink-0 mt-2" />
                  <p className="text-[14px] lg:text-[15px] text-cream/70 leading-[1.8] font-light tracking-[0.02em]">
                    The UK construction disputes landscape splits into three distinct
                    contractual ecosystems: buildings, infrastructure, and energy. Each
                    has different procurement routes, standard forms, and dispute
                    dynamics. Our forensic methodology is consistent. Its application is
                    tailored to each.
                  </p>
                </div>
              </FadeIn>
            </div>

            <div className="lg:col-span-4 hidden lg:flex flex-col items-end text-right pt-4">
              <FadeIn delay={0.4}>
                <div className="inline-flex flex-col gap-3 p-6 border border-brass/10 bg-black/10 backdrop-blur-md rounded-sm relative">
                  <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-brass/40" />
                  <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-brass/40" />

                  <div className="font-mono text-[9px] tracking-[0.2em] text-cream/40 uppercase mb-2">Taxonomy</div>
                  <div className="font-mono text-[11px] tracking-[0.15em] text-brass/80">01_BUILDINGS</div>
                  <div className="font-mono text-[11px] tracking-[0.15em] text-brass/80">02_INFRASTRUCTURE</div>
                  <div className="font-mono text-[11px] tracking-[0.15em] text-brass/80">03_ENERGY</div>
                  <div className="h-[1px] w-full bg-brass/10 my-1" />
                  <div className="font-mono text-[9px] tracking-[0.15em] text-cream/30">11_SUB_SECTORS</div>
                  <div className="font-mono text-[9px] tracking-[0.15em] text-cream/30">11_LANDMARK_CASES</div>
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>

      {/* Sticky Tabs */}
      <div className="bg-[#0b1f13] border-y border-brass/10 sticky top-[72px] lg:top-[88px] z-50 shadow-xl shadow-black/20">
        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%]">
          <div className="flex overflow-x-auto hide-scrollbar">
            {SECTORS.map((sector, idx) => (
              <button
                key={sector.num}
                onClick={() => setActiveTab(idx)}
                className={`flex items-center gap-3 py-5 px-6 lg:px-8 whitespace-nowrap border-b-2 transition-all duration-300 ${
                  activeTab === idx 
                    ? "border-brass text-cream bg-white/5" 
                    : "border-transparent text-cream/40 hover:text-cream/80 hover:bg-white/[0.02]"
                }`}
              >
                <span className={`font-mono text-[10px] tracking-[0.2em] transition-colors ${activeTab === idx ? "text-brass" : "text-brass/40"}`}>
                  SEC.{sector.num}
                </span>
                <span className="font-serif text-lg tracking-wide">{sector.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active Sector Content */}
      <div className="min-h-[80vh]">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Sector Header */}
            <section className="bg-green relative overflow-hidden border-b border-brass/5">
              <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay pointer-events-none" />

              <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%] relative z-10 py-[clamp(3rem,6vw,5rem)]">
                <FadeIn delay={0.1}>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="font-mono text-[11px] tracking-[0.25em] text-brass/80">
                      SEC.{SECTORS[activeTab].num}
                    </div>
                    <div className="h-[1px] w-16 bg-brass/30" />
                    <div className="font-mono text-[9px] tracking-[0.15em] text-cream/30 uppercase">
                      {SECTORS[activeTab].contractContext}
                    </div>
                  </div>

                  <h2 className="font-serif text-3xl lg:text-[48px] text-cream leading-[1.1] mb-6">
                    {SECTORS[activeTab].title}
                  </h2>

                  <div className="flex gap-6 max-w-3xl">
                    <div className="w-[1px] bg-brass/20 shrink-0 mt-2" />
                    <p className="text-[14px] lg:text-[15px] text-cream/60 leading-[1.8] font-light tracking-[0.02em]">
                      {SECTORS[activeTab].description}
                    </p>
                  </div>
                </FadeIn>
              </div>
            </section>

            {/* Sub-Sectors */}
            {SECTORS[activeTab].subSectors.map((sub, subIdx) => {
              const Terminal = sub.terminal;
              const bgClass = subIdx % 2 === 0 ? "bg-stone" : "bg-parchment";
              const isReversed = subIdx % 2 !== 0;

              return (
                <div key={sub.id} id={sub.id} className={`${bgClass} relative`}>
                  <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[30vw] font-serif leading-none text-green/[0.015] select-none">
                      {SECTORS[activeTab].num}.{subIdx + 1}
                    </div>
                  </div>

                  {subIdx > 0 && (
                    <div className="absolute top-0 left-0 w-full z-10">
                      <BlueprintDivider />
                    </div>
                  )}

                  <div className="py-[clamp(4.5rem,8vw,8rem)] relative z-10">
                    <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%]">
                      <div className={`grid grid-cols-1 gap-12 lg:gap-20 ${isReversed ? "lg:grid-cols-[minmax(400px,500px)_1fr] 2xl:grid-cols-[550px_1fr]" : "lg:grid-cols-[1fr_minmax(400px,500px)] 2xl:grid-cols-[1fr_550px]"}`}>
                        {/* Content */}
                        <div className={isReversed ? "order-1 lg:order-2" : "order-1 lg:order-1"}>
                          <FadeIn delay={0.1}>
                            <div className="flex items-center gap-4 mb-6">
                              <div className="font-mono text-[11px] tracking-[0.25em] text-brass/80">
                                SEC.{SECTORS[activeTab].num}.{subIdx + 1}
                              </div>
                              <div className="h-[1px] w-12 bg-brass/30"></div>
                            </div>

                            <h3 className="font-serif text-2xl lg:text-3xl text-green leading-tight mb-4">
                              {sub.title}
                            </h3>

                            {/* Landmark Case */}
                            <div className="mb-8 p-5 border border-green/10 bg-green/[0.03] relative group">
                              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-brass/30 transition-colors group-hover:border-brass/60" />
                              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-brass/30 transition-colors group-hover:border-brass/60" />
                              <div className="font-mono text-[9px] tracking-[0.2em] text-brass/60 uppercase mb-2">
                                Landmark Authority
                              </div>
                              <div className="font-serif text-[15px] text-green italic leading-snug mb-1">
                                {sub.landmarkCase.name}
                              </div>
                              <div className="font-mono text-[10px] text-slate/60 tracking-wide mb-3">
                                {sub.landmarkCase.citation} <span className="mx-1 text-brass/30">|</span> {sub.landmarkCase.court}
                              </div>
                              <p className="text-[13px] text-ink/65 leading-[1.7] font-light">
                                {sub.landmarkCase.summary}
                              </p>
                            </div>

                            {/* Disputes */}
                            <div className="space-y-8">
                              <div>
                                <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-slate/50 mb-4">
                                  Typical disputes
                                </div>
                                <ul className="space-y-3.5">
                                  {sub.disputes.map((dispute, j) => (
                                    <li key={j} className="flex items-start gap-3 text-[14px] text-ink/75 leading-relaxed">
                                      <span className="text-brass/50 mt-[3px] shrink-0">&mdash;</span>
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
                                    {sub.contracts.map((c) => (
                                      <span key={c} className="font-mono text-[9px] tracking-[0.1em] text-green/60 bg-green/5 px-2.5 py-1 rounded-sm">
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
                                    {sub.disciplines.map((d) => (
                                      <Link key={d.label} href={d.href} className="font-mono text-[10px] tracking-[0.1em] text-brass hover:text-brass-dark transition-colors duration-200">
                                        {d.label} &rarr;
                                      </Link>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </FadeIn>
                        </div>

                        {/* Terminal Graphic */}
                        <div className={`relative w-full aspect-[16/10] lg:aspect-auto lg:h-full ${isReversed ? "order-2 lg:order-1" : "order-2 lg:order-2"}`}>
                          <div className="lg:sticky lg:top-[30vh] w-full h-auto aspect-[16/10]">
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
          </motion.div>
      </div>

      <CTABand
        heading="Discuss your position"
        subtext="Direct access to a partner. No intermediaries."
      />
    </>
  );
}