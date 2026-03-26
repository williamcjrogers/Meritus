import type { Metadata } from "next";
import Link from "next/link";
import { FadeIn, ProjectPulse } from "@/components/animations";
import { CTABand } from "@/components/ui";
import { INSIGHT_ARTICLES } from "@/lib/constants";
import { notFound } from "next/navigation";

interface ArticleData {
  body: string[];
  references: { id: string; text: string }[];
}

const ARTICLE_CONTENT: Record<string, ArticleData> = {
  "delay-analysis-adjudications": {
    body: [
      "The standard approach to forensic delay analysis — retrospective windows analysis, full as-planned versus as-built comparisons, and granular critical path interrogation — was designed for litigation and arbitration. These methods assume months of preparation time, access to complete project records, and the ability to present technical evidence over multiple hearing days.",
      "Adjudication does not offer any of those luxuries. The statutory right to adjudicate under the Housing Grants, Construction and Regeneration Act 1996, s.108¹ provides for a decision within twenty-eight days of referral. From the moment a Notice of Adjudication is served, the referring party typically has seven days to serve its Referral. The responding party then has a matter of weeks — often as few as fourteen days — to prepare and submit its Response.",
      "Yet the same forensic rigour is expected. The adjudicator will scrutinise the delay analysis with the same technical eye as an arbitrator — as confirmed by the TCC's robust approach to enforcement in cases such as CNO Plant Hire Ltd v Caldwell Construction Ltd [2024] EWHC 2188 (TCC).² The difference is that you have a fraction of the time to prepare it.",
      "This creates a fundamental problem. Traditional delay methodologies are time-consuming by design. A full retrospective windows analysis of a three-year infrastructure project can take weeks of analyst time. An as-planned versus as-built comparison requires complete baseline programmes, contemporaneous updates, and painstaking cross-referencing with site records. There is simply no way to compress these methods into a fourteen-day response window without sacrificing either accuracy or completeness. The SCL Delay and Disruption Protocol (2nd Edition, 2017)³ now recognises that no single methodology is preferred — providing a menu of approaches with guidance on selecting the appropriate method for the circumstances. This flexibility is critical in the adjudication context.",
      "Where concurrent delay is alleged, the position is yet more complex. The principles established in Henry Boot Construction (UK) Ltd v Malmaison Hotel (Manchester) Ltd⁴ and developed in Royal Brompton Hospital NHS Trust v Hammond (No. 7)⁵ require careful analysis of competing delay causes — analysis that must be compressed into days rather than weeks. The approach endorsed in Walter Lilly & Company Ltd v Mackay⁶ — the leading modern authority on prospective versus retrospective delay analysis — demands a level of forensic detail that traditional sequential methodologies struggle to deliver within adjudication timescales.",
      "The answer is not to abandon forensic discipline — it is to restructure how the analysis is performed. The methodology must be adapted to the forum, not the other way around.",
      "At Meritus Via, we approach adjudication delay analysis differently. Our technology ingests the programme data, daily logs, and correspondence within hours of instruction. The critical path is identified algorithmically. Float consumption is mapped. The narrative is then built by our senior practitioners around the data, not around a traditional sequential methodology.",
      "The result is a forensically robust delay analysis — one that can withstand scrutiny by the adjudicator — delivered within the timescales that adjudication demands. The analysis is no less rigorous. It is simply structured for the reality of the forum.",
      "This distinction matters. Too many responding parties lose adjudications not because their position is weak, but because their delay analysis arrives incomplete or is presented in a format that the adjudicator cannot easily interrogate. The twenty-eight-day clock does not pause for methodological perfectionism.",
    ],
    references: [
      { id: "1", text: "Housing Grants, Construction and Regeneration Act 1996, s.108 (as amended by the Local Democracy, Economic Development and Construction Act 2009, Part 8)." },
      { id: "2", text: "CNO Plant Hire Ltd v Caldwell Construction Ltd [2024] EWHC 2188 (TCC)." },
      { id: "3", text: "Society of Construction Law, Delay and Disruption Protocol, 2nd Edition (February 2017)." },
      { id: "4", text: "Henry Boot Construction (UK) Ltd v Malmaison Hotel (Manchester) Ltd [1999] 70 Con LR 32." },
      { id: "5", text: "Royal Brompton Hospital NHS Trust v Hammond (No. 7) [2001] 76 Con LR 148." },
      { id: "6", text: "Walter Lilly & Company Ltd v Mackay [2012] EWHC 1773 (TCC)." },
    ],
  },
  "building-safety-act-remediation": {
    body: [
      "The Building Safety Act 2022¹ has fundamentally reshaped the landscape of construction disputes in England and Wales. For those involved in the remediation of residential buildings — particularly high-rise developments over eighteen metres — the Act has introduced a new class of liability, extended limitation periods, and a degree of multi-party complexity that did not previously exist.",
      "At its core, the Act creates retrospective obligations. Sections 116 to 125 and Schedule 8² establish the framework for remediation contribution orders, enabling the First-tier Tribunal to require responsible parties to contribute to remediation costs. Developers of buildings completed in the last thirty years may now face such orders, even where the original works were compliant with the Building Regulations 2010³ in force at the time of construction. The introduction of the Building Safety Regulator, the requirements for Principal Accountable Persons, and the creation of new criminal offences for non-compliance have all added layers of regulatory exposure.",
      "The extended limitation period is particularly significant. Section 134 amends the Defective Premises Act 1972⁴ to extend the limitation period from six years to thirty years retrospectively for claims relating to dwellings. This single provision has reopened the liability exposure of developers, contractors, and design professionals on projects completed decades ago.",
      "But the real challenge for disputes practitioners is the causation analysis. In a typical building defect claim, the chain of causation runs from defective work to resultant damage. Under the Building Safety Act, the analysis is more nuanced. The question is not simply whether the cladding is non-compliant — it is who specified it, who approved the substitution, who inspected the installation, and who bears the duty to remediate.",
      "Consider a typical scenario: a residential tower completed in 2012 with aluminium composite material cladding. The original specification called for Class A1 mineral wool insulation behind the cladding panels, in accordance with BS 8414⁵ fire performance requirements and the guidance in Approved Document B.⁶ During construction, the subcontractor substituted combustible PIR board on floors six through twelve. The substitution was not recorded in the contractor's quality records but was visible in the procurement chain.",
      "Under the Act, the leaseholders have a direct route to require remediation — and statutory protections ensure they are not required to bear the costs.⁷ The developer faces a remediation contribution order. The developer, in turn, seeks recovery from the D&B contractor, who blames the façade subcontractor, who points to the architect's performance specification being ambiguous. Each party's liability depends on a forensic reconstruction of the design, procurement, and construction sequence.",
      "This is where traditional disputes expertise meets a new statutory framework. The technical investigation — intrusive surveys, core sampling, BS 8414 compliance testing — must be coupled with a forensic document review that traces every specification change, every request for information, and every approval through the project lifecycle.",
      "At Meritus Via, we are seeing an increasing volume of Building Safety Act remediation disputes. Our approach is to treat each case as a forensic investigation from day one: ingesting the full project record, mapping the decision chain, and isolating liability to the specific parties whose actions or omissions caused the non-compliance. The statutory framework may be new, but the forensic discipline required is not.",
    ],
    references: [
      { id: "1", text: "Building Safety Act 2022 (c. 30)." },
      { id: "2", text: "Building Safety Act 2022, ss.116–125 and Schedule 8 (Remediation of certain defects)." },
      { id: "3", text: "The Building Regulations 2010 (SI 2010/2214)." },
      { id: "4", text: "Defective Premises Act 1972, s.1 (as amended by Building Safety Act 2022, s.134, extending the limitation period to 30 years retrospectively)." },
      { id: "5", text: "BS 8414-1:2015+A1:2017 — Fire performance of external cladding systems. Test method for non-loadbearing external cladding systems applied to the masonry face of a building." },
      { id: "6", text: "HM Government, Approved Document B: Fire Safety — Volume 2: Buildings other than dwellings (2019 edition)." },
      { id: "7", text: "Building Safety Act 2022, Schedule 8, paras 2–4 (Leaseholder protections — qualifying leaseholders of relevant buildings are protected from remediation costs)." },
    ],
  },
  "ai-in-construction-disputes": {
    body: [
      "Every technology company in the construction disputes space is talking about artificial intelligence. The marketing materials promise automated delay analysis, instant quantum assessments, and AI-generated expert reports. The reality is more nuanced — and, for practitioners who understand the difference, more useful.",
      "The first distinction to draw is between genuine analytical capability and simple document processing. Most tools marketed as 'AI for construction disputes' are performing document classification, keyword extraction, and basic pattern matching. These are useful functions — being able to rapidly sort one hundred thousand project documents into chronological, thematic, or party-based categories saves significant analyst time. But they are not performing forensic analysis.",
      "Forensic delay analysis requires an understanding of critical path methodology, the contractual framework governing extensions of time, and the factual matrix of the specific project. No current AI system can independently determine whether a delay event was on the critical path, whether concurrent delay applies, or whether the contractor's mitigation efforts were reasonable. These are matters of professional judgment that require human expertise.",
      "What AI can do, effectively, is prepare the evidence base for human analysis. At Meritus Via, our proprietary tools ingest programme data — Primavera P6, Asta Powerproject, Microsoft Project schedules — and automatically map the critical path, identify float consumption patterns, and flag schedule anomalies. The system cross-references correspondence dates with programme updates to highlight potential areas of interest. It does not produce conclusions. It produces a structured evidence base that our senior practitioners can interrogate.",
      "The same principle applies to quantum analysis. Our tools can parse bills of quantities, variation accounts, and cost reports to identify mathematical inconsistencies, duplicated claims, and unsupported figures. The output is a flagged dataset — not a damages assessment. The assessment remains the responsibility of the quantum expert who understands the contractual mechanism, the applicable formula for head office overheads, and the evidential burden for each head of claim.",
      "This distinction is critical because the output of any technology-assisted analysis must be disclosable. Under CPR Part 35.3,¹ the expert's overriding duty is to the court — and that duty extends to full transparency about methodology. Practice Direction 35² requires experts to state the substance of all material instructions and the methodology employed. The Academy of Experts' guidance on AI use (2025)³ makes clear that experts must disclose any use of AI tools and are personally responsible for all material produced in their name, regardless of AI involvement. An expert who relies on an opaque AI system to produce conclusions will face significant difficulties under cross-examination. An expert who uses technology to structure and accelerate their own analysis — and can demonstrate exactly how — has a significant advantage.",
      "The judiciary has taken an increasingly clear position. Lord Justice Birss, addressing the Expert Witness Institute Annual Conference (2025),⁴ emphasised that CPR 35.1 restricts expert evidence to that 'reasonably required to resolve the proceedings' — a principle that demands focus and selectivity, not the indiscriminate volume that AI tools can generate. The SRA Code of Conduct⁵ has already been applied in cases involving AI-generated inaccuracies in legal proceedings, and the regulatory direction is unambiguous: the expert, not the tool, bears responsibility.",
      "The gap between what technology companies promise and what practitioners actually need is substantial. The practitioners who will benefit most from AI are not those who hand over their analysis to a machine. They are those who use AI to work faster, more accurately, and with a more complete evidence base — while retaining full ownership of their professional opinions.",
    ],
    references: [
      { id: "1", text: "Civil Procedure Rules, Part 35.3 — Experts: overriding duty to the court." },
      { id: "2", text: "Practice Direction 35 — Experts and Assessors, para 3.2." },
      { id: "3", text: "The Academy of Experts, Guidance for Expert Witnesses on the Use of Artificial Intelligence (2025)." },
      { id: "4", text: "Lord Justice Birss, Speech to the Expert Witness Institute Annual Conference (June 2025)." },
      { id: "5", text: "Solicitors Regulation Authority, Code of Conduct for Solicitors, RELs and RFLs (as updated)." },
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

            {content.references.length > 0 && (
              <div className="mt-14 pt-8 border-t border-green/10">
                <h3 className="font-mono text-[10px] tracking-[0.25em] uppercase text-slate/60 mb-5">References</h3>
                <ol className="space-y-2.5">
                  {content.references.map((ref) => (
                    <li key={ref.id} className="text-[12px] lg:text-[13px] text-slate/70 leading-[1.7] font-sans flex items-start gap-2">
                      <span className="font-mono text-[10px] text-brass/60 mt-[3px] shrink-0">{ref.id}.</span>
                      <span>{ref.text}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="mt-10 pt-6 border-t border-green/8">
              <p className="text-[11px] text-slate/40 leading-relaxed italic">
                The views expressed in this article are those of the author and are intended for general information only. They do not constitute legal advice and should not be relied upon as such. Specific professional advice should be sought in relation to any particular matter.
              </p>
            </div>

            <div className="mt-10 pt-8 border-t border-green/10">
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
