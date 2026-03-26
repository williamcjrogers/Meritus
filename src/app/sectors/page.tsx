import type { Metadata } from "next";
import Link from "next/link";
import { FadeIn, ProjectPulse } from "@/components/animations";
import { CTABand } from "@/components/ui";

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
  },
];

export default function SectorsPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-green pt-[clamp(7rem,14vh,9rem)] pb-[clamp(3rem,8vh,5rem)] relative overflow-hidden">
        <ProjectPulse className="z-0 opacity-30" />
        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%] relative z-10">
          <FadeIn>
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-cream/50 mb-6">
              Sector Experience
            </div>
            <h1 className="font-serif text-4xl lg:text-[52px] text-cream leading-[1.1] max-w-4xl">
              The disputes change.<br />The discipline does not.
            </h1>
            <p className="mt-8 text-base lg:text-lg text-cream/55 max-w-2xl leading-relaxed">
              Our forensic methodology is consistent. Its application is tailored to the
              contractual framework, procurement route, and technical context of each sector.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Sectors */}
      <section className="bg-stone">
        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%]">
          {SECTORS.map((sector, i) => (
            <FadeIn key={sector.num}>
              <div
                className={`py-14 lg:py-20 ${i > 0 ? "border-t border-green/8" : ""}`}
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
                  {/* Left: Title & Description */}
                  <div className="lg:col-span-5">
                    <div className="font-mono text-[10px] tracking-[0.2em] text-brass/70 mb-3">
                      {sector.num}
                    </div>
                    <h2 className="font-serif text-2xl lg:text-3xl text-green leading-tight mb-6">
                      {sector.title}
                    </h2>
                    <p className="text-[14px] text-slate leading-relaxed">
                      {sector.description}
                    </p>

                    {/* Contract forms */}
                    <div className="mt-6 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[9px] tracking-[0.15em] uppercase text-slate/40">
                        Common forms:
                      </span>
                      {sector.contracts.map((c) => (
                        <span
                          key={c}
                          className="font-mono text-[9px] tracking-[0.1em] text-green/50 bg-green/5 px-2.5 py-1 rounded-sm"
                        >
                          {c}
                        </span>
                      ))}
                    </div>

                    {/* Discipline links */}
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <span className="font-mono text-[9px] tracking-[0.15em] uppercase text-slate/40">
                        Disciplines:
                      </span>
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

                  {/* Right: Typical Disputes */}
                  <div className="lg:col-span-7">
                    <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-slate/50 mb-5">
                      Typical disputes
                    </div>
                    <ul className="space-y-4">
                      {sector.disputes.map((dispute, j) => (
                        <li
                          key={j}
                          className="flex items-start gap-3 text-[14px] text-ink/70 leading-relaxed"
                        >
                          <span className="text-brass/40 mt-[3px] shrink-0">
                            &mdash;
                          </span>
                          {dispute}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <CTABand
        heading="Discuss your position"
        subtext="Direct access to a partner. No intermediaries."
      />
    </>
  );
}
