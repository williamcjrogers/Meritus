import Link from "next/link";
export function ProcessStrip() {
  return (
    <section className="public-section public-approach-summary">
      <div className="public-container public-approach-layout">
        <div>
          <h2>
            Start with the question.
            <br />
            Follow the evidence.
          </h2>
          <p>
            Our approach brings project records, analytical discipline and
            professional judgement into one line of reasoning.
          </p>
          <Link className="public-text-link" href="/method">
            How we work
          </Link>
        </div>
        <ol className="public-process">
          <li>
            <h3>Establish the record</h3>
            <p>
              Identify the relevant contract, programme and contemporary
              evidence, including the gaps.
            </p>
          </li>
          <li>
            <h3>Test the position</h3>
            <p>
              Examine cause, effect and value. Challenge assumptions and
              consider the evidence that cuts against the case.
            </p>
          </li>
          <li>
            <h3>Explain the conclusion</h3>
            <p>
              Set out the analysis, its sources and its limits so the next
              decision is properly informed.
            </p>
          </li>
        </ol>
      </div>
    </section>
  );
}
