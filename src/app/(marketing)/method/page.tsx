import Link from "next/link";
import { PublicIntro } from "@/components/ui/PublicIntro";
import { CTABand } from "@/components/ui/CTABand";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata({
  title: "Approach",
  description:
    "A considered approach to construction disputes: establish the record, test the analysis and explain the conclusion.",
  path: "/method",
});
const steps = [
  {
    title: "Establish the record",
    body: "Agree the questions to be answered and identify the relevant material. Organise the contract, correspondence, programmes and cost records into a usable evidence base.",
    output: "A defined scope, evidence index and initial chronology.",
  },
  {
    title: "Interrogate the position",
    body: "Examine the sequence of events, causation and value. Test the proposed explanation against contemporary records, alternative explanations and incomplete evidence.",
    output:
      "An analysis that distinguishes facts, assumptions and matters requiring further evidence.",
  },
  {
    title: "Form the conclusion",
    body: "Bring the analysis into a clear report, submission or advisory note. Explain how each material conclusion follows from the evidence and state its limitations.",
    output: "A reasoned position suitable for the instruction and the forum.",
  },
];
export default function MethodPage() {
  return (
    <>
      <PublicIntro
        label="Approach"
        title="A conclusion is only as useful as the reasoning behind it."
        description="We organise the evidence, test competing explanations and make the basis of the advice clear."
      >
        <nav className="public-anchor-nav" aria-label="Our approach">
          <a href="#principle">Principle</a>
          <a href="#capabilities">The work</a>
          <a href="#engineering">Technology</a>
          <a href="#governance">Review</a>
        </nav>
      </PublicIntro>
      <section id="principle" className="public-section">
        <div className="public-container public-text-split">
          <h2>The record comes first.</h2>
          <div>
            <p className="public-lead">
              Construction disputes rarely turn on a single document. The
              important question is how the programme, the costs and the
              correspondence relate to one another.
            </p>
            <p>
              We structure the work around those relationships. Contemporary
              evidence is separated from later explanation, and uncertainty is
              made visible before it becomes an unsupported conclusion.
            </p>
          </div>
        </div>
      </section>
      <section
        id="capabilities"
        className="public-section public-approach-summary"
      >
        <div className="public-container">
          <h2>From instruction to opinion</h2>
          <ol className="public-method-steps">
            {steps.map((step) => (
              <li key={step.title}>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
                <div className="public-record-note">
                  <strong>The output</strong>
                  <p>{step.output}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section id="engineering" className="public-section">
        <div className="public-container public-text-split">
          <h2>Technology supports the examination.</h2>
          <div>
            <p className="public-lead">
              Structured chronologies, programme interrogation and source-linked
              records make the detail easier to work with.
            </p>
            <p>
              Our engineering capability supports that preparation and analysis.
              Professional judgement remains with the practitioner responsible
              for the instruction.
            </p>
            <Link className="public-text-link" href="/services#technology">
              Technology expertise
            </Link>
          </div>
        </div>
      </section>
      <section id="governance" className="public-section public-review-section">
        <div className="public-container public-text-split">
          <h2>A reviewable line of reasoning.</h2>
          <ul className="public-check-list">
            <li>Material findings connected to their sources.</li>
            <li>Assumptions and limitations stated clearly.</li>
            <li>Evidence that challenges the position considered.</li>
            <li>Human review before an opinion is issued.</li>
          </ul>
        </div>
      </section>
      <CTABand />
    </>
  );
}
