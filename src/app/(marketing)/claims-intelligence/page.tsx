import { PublicIntro } from "@/components/ui/PublicIntro";
import { CTABand } from "@/components/ui/CTABand";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata({
  title: "Claims intelligence",
  description:
    "Research connecting construction case authorities, professional guidance and contractual frameworks.",
  path: "/claims-intelligence",
});
const MODULES = [
  {
    num: "01",
    title: "Case Law Database",
    description:
      "UK construction law cases with analysis, from foundational authorities to the latest TCC and Court of Appeal decisions. Each case includes the ratio, practical implications, and cross-references to related authorities.",
    tags: [
      "Walter Lilly v Mackay",
      "Triple Point v PTT",
      "Bresco v Lonsdale",
      "Grove v S&T",
    ],
  },
  {
    num: "02",
    title: "RICS Guidance Library",
    description:
      "Professional guidance notes across surveying and dispute resolution. Searchable and cross-referenced with relevant case law and contract provisions. Reviewed in the context of the instruction.",
    tags: [
      "Surveying practice",
      "Expert witness",
      "Valuation",
      "Contract administration",
    ],
  },
  {
    num: "03",
    title: "Standard Form Contracts",
    description:
      "Key clauses and cross-comparison across JCT, ICE, NEC, and FIDIC contract suites. Extension of time mechanisms, loss and expense provisions, termination, and dispute resolution clauses, mapped side by side.",
    tags: ["JCT", "ICE", "NEC3/NEC4", "FIDIC"],
  },
  {
    num: "04",
    title: "Legislation & Statutory Framework",
    description:
      "HGCRA 1996, Building Safety Act 2022, Defective Premises Act 1972, and the Limitation Act 1980,with annotations on recent amendments, practical impact, and connections to leading case law.",
    tags: ["HGCRA 1996", "BSA 2022", "DPA 1972", "Limitation Act 1980"],
  },
  {
    num: "05",
    title: "Expert Evidence & Methodology",
    description:
      "CPR Part 35 duties, SCL Protocol delay analysis methods, disruption quantification techniques, and the evolving requirements around technology-assisted evidence and AI disclosure.",
    tags: [
      "CPR Part 35",
      "SCL Protocol",
      "Disruption analysis",
      "AI disclosure",
    ],
  },
  {
    num: "06",
    title: "Trend Analysis",
    description:
      "Judicial trends in quantum assessment, delay analysis methodology, expert evidence standards, and Building Safety Act jurisprudence. Pattern recognition across recent decisions to inform strategy.",
    tags: [
      "Quantum trends",
      "Delay methodology",
      "BSA 2022 case law",
      "Expert evidence",
    ],
  },
];

const FEATURED_AUTHORITIES = [
  {
    name: "Walter Lilly & Co Ltd v Mackay",
    cite: "[2012] EWHC 1773 (TCC)",
    note: "Leading authority on global claims and concurrent delay analysis in English law.",
  },
  {
    name: "Triple Point Technology v PTT",
    cite: "[2021] UKSC 29",
    note: "Supreme Court resolution on LADs surviving termination of construction contracts.",
  },
  {
    name: "Bresco v Lonsdale",
    cite: "[2020] UKSC 25",
    note: "Insolvent parties may adjudicate to crystallise claims in the insolvency process.",
  },
  {
    name: "Adriatic Land 5 v Long Leaseholders",
    cite: "[2025] EWCA Civ",
    note: "Landlords cannot recover BSA remediation costs from leaseholders, driving claims up the supply chain.",
  },
];

export default function ClaimsIntelligencePage() {
  return (
    <>
      <PublicIntro
        title="Research behind the analysis."
        label="Claims intelligence"
        description="Case authorities, professional guidance and contractual frameworks, considered in the context of the questions on your instruction."
      />
      <section className="public-section">
        <div className="public-container public-research-grid">
          {MODULES.map((module) => (
            <article key={module.num}>
              <h2>{module.title}</h2>
              <p>{module.description}</p>
              <ul className="public-topic-list">
                {module.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
      <section className="public-section public-approach-summary">
        <div className="public-container">
          <h2>Authorities in context</h2>
          <div className="public-research-grid">
            {FEATURED_AUTHORITIES.map((authority) => (
              <article key={authority.cite}>
                <h3>{authority.name}</h3>
                <p className="public-meta">{authority.cite}</p>
                <p>{authority.note}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="public-section">
        <div className="public-container public-text-split">
          <h2>Research access</h2>
          <div>
            <p>Already have access to the research dashboard?</p>
            <a
              className="public-text-link"
              href="https://intelligence.meritusvia.com/dashboard"
            >
              Open research dashboard
            </a>
            <p>
              To discuss research relevant to a prospective instruction, contact
              the team.
            </p>
          </div>
        </div>
      </section>
      <CTABand />
    </>
  );
}
