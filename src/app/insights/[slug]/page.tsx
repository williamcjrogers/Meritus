import type { Metadata } from "next";
import Link from "next/link";
import { FadeIn, ProjectPulse } from "@/components/animations";
import { CTABand } from "@/components/ui";
import { INSIGHT_ARTICLES } from "@/lib/constants";
import { notFound } from "next/navigation";

const ARTICLE_CONTENT: Record<string, { body: string[] }> = {
  "delay-analysis-adjudications": {
    body: [
      "The standard approach to forensic delay analysis — retrospective windows analysis, full as-planned versus as-built comparisons, and granular critical path interrogation — was designed for litigation and arbitration. These methods assume months of preparation time, access to complete project records, and the ability to present technical evidence over multiple hearing days.",
      "Adjudication does not offer any of those luxuries. From the moment a Notice of Adjudication is served, the referring party typically has seven days to serve its Referral. The responding party then has a matter of weeks — often as few as fourteen days — to prepare and submit its Response. The entire process, from notice to decision, must be concluded within twenty-eight days unless extended by agreement.",
      "Yet the same forensic rigour is expected. The adjudicator will scrutinise the delay analysis with the same technical eye as an arbitrator. The difference is that you have a fraction of the time to prepare it.",
      "This creates a fundamental problem. Traditional delay methodologies are time-consuming by design. A full retrospective windows analysis of a three-year infrastructure project can take weeks of analyst time. An as-planned versus as-built comparison requires complete baseline programmes, contemporaneous updates, and painstaking cross-referencing with site records. There is simply no way to compress these methods into a fourteen-day response window without sacrificing either accuracy or completeness.",
      "The answer is not to abandon forensic discipline — it is to restructure how the analysis is performed. The methodology must be adapted to the forum, not the other way around.",
      "At Meritus Via, we approach adjudication delay analysis differently. Our technology ingests the programme data, daily logs, and correspondence within hours of instruction. The critical path is identified algorithmically. Float consumption is mapped. The narrative is then built by our senior practitioners around the data, not around a traditional sequential methodology.",
      "The result is a forensically robust delay analysis — one that can withstand scrutiny by the adjudicator — delivered within the timescales that adjudication demands. The analysis is no less rigorous. It is simply structured for the reality of the forum.",
      "This distinction matters. Too many responding parties lose adjudications not because their position is weak, but because their delay analysis arrives incomplete or is presented in a format that the adjudicator cannot easily interrogate. The twenty-eight-day clock does not pause for methodological perfectionism.",
    ],
  },
  "building-safety-act-remediation": {
    body: [
      "The Building Safety Act 2022 has fundamentally reshaped the landscape of construction disputes in England and Wales. For those involved in the remediation of residential buildings — particularly high-rise developments over eighteen metres — the Act has introduced a new class of liability, extended limitation periods, and a degree of multi-party complexity that did not previously exist.",
      "At its core, the Act creates retrospective obligations. Developers of buildings completed in the last thirty years may now face remediation contribution orders, even where the original works were compliant with the building regulations in force at the time of construction. The introduction of the Building Safety Regulator, the requirements for Principal Accountable Persons, and the creation of new criminal offences for non-compliance have all added layers of regulatory exposure.",
      "But the real challenge for disputes practitioners is the causation analysis. In a typical building defect claim, the chain of causation runs from defective work to resultant damage. Under the Building Safety Act, the analysis is more nuanced. The question is not simply whether the cladding is non-compliant — it is who specified it, who approved the substitution, who inspected the installation, and who bears the duty to remediate.",
      "Consider a typical scenario: a residential tower completed in 2012 with aluminium composite material cladding. The original specification called for Class A1 mineral wool insulation behind the cladding panels. During construction, the subcontractor substituted combustible PIR board on floors six through twelve. The substitution was not recorded in the contractor's quality records but was visible in the procurement chain.",
      "Under the Act, the leaseholders have a direct route to require remediation. The developer faces a remediation contribution order. The developer, in turn, seeks recovery from the D&B contractor, who blames the façade subcontractor, who points to the architect's performance specification being ambiguous. Each party's liability depends on a forensic reconstruction of the design, procurement, and construction sequence.",
      "This is where traditional disputes expertise meets a new statutory framework. The technical investigation — intrusive surveys, core sampling, BS 8414 compliance testing — must be coupled with a forensic document review that traces every specification change, every request for information, and every approval through the project lifecycle.",
      "At Meritus Via, we are seeing an increasing volume of Building Safety Act remediation disputes. Our approach is to treat each case as a forensic investigation from day one: ingesting the full project record, mapping the decision chain, and isolating liability to the specific parties whose actions or omissions caused the non-compliance. The statutory framework may be new, but the forensic discipline required is not.",
    ],
  },
  "ai-in-construction-disputes": {
    body: [
      "Every technology company in the construction disputes space is talking about artificial intelligence. The marketing materials promise automated delay analysis, instant quantum assessments, and AI-generated expert reports. The reality is more nuanced — and, for practitioners who understand the difference, more useful.",
      "The first distinction to draw is between genuine analytical capability and simple document processing. Most tools marketed as 'AI for construction disputes' are performing document classification, keyword extraction, and basic pattern matching. These are useful functions — being able to rapidly sort one hundred thousand project documents into chronological, thematic, or party-based categories saves significant analyst time. But they are not performing forensic analysis.",
      "Forensic delay analysis requires an understanding of critical path methodology, the contractual framework governing extensions of time, and the factual matrix of the specific project. No current AI system can independently determine whether a delay event was on the critical path, whether concurrent delay applies, or whether the contractor's mitigation efforts were reasonable. These are matters of professional judgment that require human expertise.",
      "What AI can do, effectively, is prepare the evidence base for human analysis. At Meritus Via, our proprietary tools ingest programme data — Primavera P6, Asta Powerproject, Microsoft Project schedules — and automatically map the critical path, identify float consumption patterns, and flag schedule anomalies. The system cross-references correspondence dates with programme updates to highlight potential areas of interest. It does not produce conclusions. It produces a structured evidence base that our senior practitioners can interrogate.",
      "The same principle applies to quantum analysis. Our tools can parse bills of quantities, variation accounts, and cost reports to identify mathematical inconsistencies, duplicated claims, and unsupported figures. The output is a flagged dataset — not a damages assessment. The assessment remains the responsibility of the quantum expert who understands the contractual mechanism, the applicable formula for head office overheads, and the evidential burden for each head of claim.",
      "This distinction is critical because the output of any technology-assisted analysis must be disclosable. In arbitration and litigation, the expert must be able to explain and defend every step of their methodology. An expert who relies on an opaque AI system to produce conclusions will face significant difficulties under cross-examination. An expert who uses technology to structure and accelerate their own analysis — and can demonstrate exactly how — has a significant advantage.",
      "The gap between what technology companies promise and what practitioners actually need is substantial. The practitioners who will benefit most from AI are not those who hand over their analysis to a machine. They are those who use AI to work faster, more accurately, and with a more complete evidence base — while retaining full ownership of their professional opinions.",
    ],
  },
};

export function generateStaticParams() {
  return INSIGHT_ARTICLES.map((article) => ({
    slug: article.slug,
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = INSIGHT_ARTICLES.find((a) => a.slug === slug);
  if (!article) return { title: "Insight" };
  return {
    title: article.title,
    description: article.excerpt,
  };
}

export default async function InsightArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = INSIGHT_ARTICLES.find((a) => a.slug === slug);
  if (!article) notFound();

  const content = ARTICLE_CONTENT[slug];
  if (!content) notFound();

  return (
    <>
      <section className="bg-green pt-[clamp(7rem,14vh,9rem)] pb-[clamp(3rem,8vh,5rem)] relative overflow-hidden">
        <ProjectPulse className="z-0 opacity-30" />
        <div className="max-w-[1000px] 2xl:max-w-[1100px] mx-auto px-6 lg:px-[8%] relative z-10">
          <FadeIn>
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-brass mb-6">
              {article.category}
            </div>
            <h1 className="font-serif text-3xl lg:text-[44px] text-cream leading-[1.15] italic">
              {article.title}
            </h1>
            <div className="mt-6 flex items-center gap-4 font-mono text-[10px] text-cream/40">
              <span>{article.date}</span>
              <span className="text-cream/15">|</span>
              <span>{article.readTime}</span>
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="bg-stone py-[clamp(3rem,6vw,5rem)]">
        <div className="max-w-[900px] 2xl:max-w-[1000px] mx-auto px-6 lg:px-[8%]">
          <FadeIn>
            <div className="space-y-6">
              {content.body.map((paragraph, i) => (
                <p key={i} className="text-[16px] lg:text-[17px] text-ink/80 leading-[1.85] font-sans">
                  {paragraph}
                </p>
              ))}
            </div>

            <div className="mt-16 pt-8 border-t border-green/10">
              <Link
                href="/insights"
                className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.15em] uppercase text-brass hover:text-brass-dark transition-colors duration-200"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M11 6H1M5 2L1 6l4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Back to Insights
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      <CTABand
        heading="Discuss your position"
        subtext="Direct access to a partner. No intermediaries."
      />
    </>
  );
}
