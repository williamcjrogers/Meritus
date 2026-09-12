import { Button } from "@/components/ui/Button";
import { PublicIntro } from "@/components/ui/PublicIntro";
import { CTABand } from "@/components/ui/CTABand";
import { JsonLd } from "@/components/seo/JsonLd";
import { pageMetadata } from "@/lib/seo";
import { SITE_CONFIG } from "@/lib/constants";

export const metadata = pageMetadata({
  title: "Expertise",
  description:
    "Delay, quantum, technical and advisory expertise for construction disputes, supported by traceable project evidence.",
  path: "/services",
});
const services = [
  {
    id: "delay",
    title: "Delay",
    question: "What changed the path to completion?",
    description:
      "Reconstruct the works from programmes and contemporary records. Test the asserted cause of delay against the sequence actually delivered.",
    outputs: [
      "Forensic retrospective delay analysis",
      "Time impact and windows analysis",
      "Critical path interrogation",
      "Extension of time and compensation event assessment",
    ],
    records:
      "Programmes, progress updates, instructions, site diaries and correspondence.",
  },
  {
    id: "quantum",
    title: "Quantum",
    question: "What value does the evidence support?",
    description:
      "Prepare or challenge the valuation with a clear account of entitlement, measurement and cost. Keep each element of the assessment traceable.",
    outputs: [
      "Final account preparation and defence",
      "Prolongation and disruption assessment",
      "Commercial valuation and damages",
      "Review of opposing quantum positions",
    ],
    records:
      "Cost ledgers, applications, valuations, subcontract accounts and resource records.",
  },
  {
    id: "technical",
    title: "Technical",
    question: "What failed, and why?",
    description:
      "Connect the physical condition with design, workmanship and contractual requirements. Define the causal questions before drawing conclusions.",
    outputs: [
      "Defect investigation and causation",
      "Root cause and failure mode analysis",
      "Design responsibility assessment",
      "Building safety and remediation support",
    ],
    records:
      "Drawings, specifications, inspection records, test results and as-built information.",
  },
  {
    id: "advisory",
    title: "Advisory",
    question: "What is the right next step?",
    description:
      "Understand the strength of the position, the evidence still needed and the practical choices ahead. Match the analysis to the stage and forum of the dispute.",
    outputs: [
      "Merits and exposure assessment",
      "Adjudication referral and response support",
      "Expert appointment scoping",
      "Negotiation and dispute strategy",
    ],
    records:
      "Contract terms, notices, submissions, correspondence and the supporting evidence.",
  },
  {
    id: "technology",
    title: "Technology",
    question: "How do the records fit together?",
    description:
      "Use structured evidence and source-linked analysis to make complex records manageable. Technology supports the examination; practitioners remain responsible for the conclusions.",
    outputs: [
      "Document classification and chronology",
      "Source-linked evidence review",
      "Programme and cost interrogation",
      "Structured exhibits and audit trails",
    ],
    records:
      "The project record, organised around the questions the instruction needs to answer.",
  },
];
export default function ServicesPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Meritus Via construction disputes expertise",
          itemListElement: services.map((s, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: {
              "@type": "Service",
              name: s.title,
              provider: { "@type": "Organization", name: SITE_CONFIG.name },
              url: `${SITE_CONFIG.url}/services#${s.id}`,
            },
          })),
        }}
      />
      <PublicIntro
        label="Expertise"
        title="The issue defines the analysis."
        description="Specialist disciplines, brought together around the facts of your construction dispute."
      >
        <nav className="public-anchor-nav" aria-label="Areas of expertise">
          {services.map((service) => (
            <a key={service.id} href={`#${service.id}`}>
              {service.title}
            </a>
          ))}
        </nav>
      </PublicIntro>
      <div className="public-container">
        {services.map((service) => (
          <section
            key={service.id}
            id={service.id}
            className="public-service-detail"
          >
            <div>
              <p className="public-page-label">{service.title}</p>
              <h2>{service.question}</h2>
              <p>{service.description}</p>
            </div>
            <div className="public-deliverables">
              <h3>How we can help</h3>
              <ul>
                {service.outputs.map((output) => (
                  <li key={output}>{output}</li>
                ))}
              </ul>
              <div className="public-record-note">
                <h3>The supporting record</h3>
                <p>{service.records}</p>
              </div>
            </div>
          </section>
        ))}
      </div>
      <section className="public-section public-approach-summary">
        <div className="public-container public-section-topline">
          <div>
            <h2>Expertise in context.</h2>
            <p>
              Buildings, infrastructure and energy each bring different delivery
              and contractual conditions.
            </p>
          </div>
          <Button href="/sectors" variant="secondary">
            Explore sectors
          </Button>
        </div>
      </section>
      <CTABand />
    </>
  );
}
