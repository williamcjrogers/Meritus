import Link from "next/link";
import { PublicIntro } from "@/components/ui/PublicIntro";
import { CTABand } from "@/components/ui/CTABand";

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
      },
      {
        id: "bsa",
        title: "Building Safety Compliance",
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
        contracts: ["Statutory", "JCT", "JCT D&B"],
        disciplines: [
          { label: "Technical", href: "/services#technical" },
          { label: "Quantum", href: "/services#quantum" },
          { label: "Advisory", href: "/services#advisory" },
        ],
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
          "Gas, telecoms, and electrical distribution infrastructure disputes",
        ],
        contracts: ["NEC3", "NEC4", "ICE"],
        disciplines: [
          { label: "Technical", href: "/services#technical" },
          { label: "Quantum", href: "/services#quantum" },
          { label: "Delay", href: "/services#delay" },
        ],
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
      },
    ],
  },
];

const sectorIds = ["buildings", "infrastructure", "energy"];
export function SectorsClient() {
  return (
    <>
      <PublicIntro
        title="The same discipline. Different project realities."
        label="Sectors"
        description="Construction records make sense in context: how a project was procured, what it had to deliver and the conditions in which it was built."
      >
        <nav
          id="sector-tabs"
          className="public-anchor-nav"
          aria-label="Sectors"
        >
          {SECTORS.map((sector, index) => (
            <a href={`#${sectorIds[index]}`} key={sector.title}>
              {sector.title}
            </a>
          ))}
        </nav>
      </PublicIntro>
      <div id="sector-top" className="public-container">
        {SECTORS.map((sector, index) => (
          <section
            key={sector.title}
            id={sectorIds[index]}
            className="public-sector"
          >
            <div className="public-sector-heading">
              <h2>{sector.title}</h2>
              <div>
                <p>{sector.description}</p>
                <p className="public-meta">
                  Contract context: {sector.contractContext}
                </p>
              </div>
            </div>
            <div className="public-sector-grid">
              {sector.subSectors.map((sub) => (
                <article
                  id={sub.id}
                  key={sub.id}
                  className="public-sector-item"
                >
                  <h3>{sub.title}</h3>
                  <ul>
                    {sub.disputes.map((dispute) => (
                      <li key={dispute}>{dispute}</li>
                    ))}
                  </ul>
                  <div className="public-related-links">
                    {sub.disciplines.map((discipline) => (
                      <Link key={discipline.href} href={discipline.href}>
                        {discipline.label}
                      </Link>
                    ))}
                  </div>
                  <details className="public-authority-disclosure">
                    <summary>Relevant authority</summary>
                    <div>
                      <h4>{sub.landmarkCase.name}</h4>
                      <p className="public-meta">
                        {sub.landmarkCase.citation}, {sub.landmarkCase.court}
                      </p>
                      <p>{sub.landmarkCase.summary}</p>
                    </div>
                  </details>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
      <CTABand />
    </>
  );
}
