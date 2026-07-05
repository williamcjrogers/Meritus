import type { Metadata } from "next";
import Link from "next/link";
import { FadeIn, ProjectPulse } from "@/components/animations";
import { CTABand } from "@/components/ui";
import { JsonLd } from "@/components/seo/JsonLd";
import { INSIGHT_ARTICLES, SITE_CONFIG } from "@/lib/constants";
import { pageMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";

/* ── Structured article content ──────────────────────────────────────────
   Articles are composed of typed blocks rather than flat paragraphs so the
   template can vary the visual rhythm: section headings, stat callouts,
   authority cards, pull quotes, lists, and firm-view panels. */

type Block =
  | { kind: "lead"; text: string }
  | { kind: "heading"; num: string; text: string; id: string }
  | { kind: "para"; text: string }
  | { kind: "pull"; text: string }
  | { kind: "authority"; name: string; citation: string; court: string; point: string; url?: string }
  | { kind: "list"; title: string; items: string[] }
  | { kind: "stat"; value: string; suffix: string; label: string; detail: string }
  | { kind: "view"; paragraphs: string[] };

interface ArticleData {
  takeaways: string[];
  blocks: Block[];
  references: { id: string; text: string; url?: string }[];
}

const ARTICLE_CONTENT: Record<string, ArticleData> = {
  "delay-analysis-adjudications": {
    takeaways: [
      "Adjudication compresses months of forensic preparation into a response window measured in days. The methodology must be chosen for the forum.",
      "The rigour expected does not drop: adjudicators scrutinise delay analysis with the same technical eye, and the TCC enforces their decisions robustly.",
      "A technology-prepared evidence base lets senior practitioners deliver analysis that survives scrutiny inside the twenty-eight-day clock.",
    ],
    blocks: [
      {
        kind: "lead",
        text: "The standard approach to forensic delay analysis,retrospective windows analysis, full as-planned versus as-built comparisons, and granular critical path interrogation,was designed for litigation and arbitration. These methods assume months of preparation time, access to complete project records, and the ability to present technical evidence over multiple hearing days.",
      },
      { kind: "heading", num: "01", text: "The statutory clock", id: "s1" },
      {
        kind: "stat",
        value: "28",
        suffix: "days",
        label: "Referral to decision",
        detail: "The statutory window under the Construction Act. The Referral typically follows within seven days of the Notice; the Response often has as few as fourteen.",
      },
      {
        kind: "para",
        text: "Adjudication does not offer any of those luxuries. The statutory right to adjudicate under the Housing Grants, Construction and Regeneration Act 1996, s.108¹ provides for a decision within twenty-eight days of referral. From the moment a Notice of Adjudication is served, the referring party typically has seven days to serve its Referral. The responding party then has a matter of weeks,often as few as fourteen days,to prepare and submit its Response.",
      },
      {
        kind: "para",
        text: "Yet the same forensic rigour is expected. The adjudicator will scrutinise the delay analysis with the same technical eye as an arbitrator,as confirmed by the TCC's robust approach to enforcement in cases such as CNO Plant Hire Ltd v Caldwell Construction Ltd [2024] EWHC 2188 (TCC).² The difference is that you have a fraction of the time to prepare it.",
      },
      {
        kind: "authority",
        name: "CNO Plant Hire Ltd v Caldwell Construction Ltd",
        citation: "[2024] EWHC 2188 (TCC)",
        court: "Technology & Construction Court",
        point: "Cited here for the TCC's robust approach to enforcing adjudicators' decisions. The compressed timetable in which an analysis is produced will not shield it from technical scrutiny.",
        url: "https://caselaw.nationalarchives.gov.uk/ewhc/tcc/2024/2188",
      },
      { kind: "heading", num: "02", text: "Why traditional methods do not compress", id: "s2" },
      {
        kind: "para",
        text: "This creates a fundamental problem. Traditional delay methodologies are time-consuming by design. A full retrospective windows analysis of a three-year infrastructure project can take weeks of analyst time. An as-planned versus as-built comparison requires complete baseline programmes, contemporaneous updates, and painstaking cross-referencing with site records. There is simply no way to compress these methods into a fourteen-day response window without sacrificing either accuracy or completeness.",
      },
      {
        kind: "para",
        text: "The SCL Delay and Disruption Protocol (2nd Edition, 2017)³ now recognises that no single methodology is preferred,providing a menu of approaches with guidance on selecting the appropriate method for the circumstances. This flexibility is critical in the adjudication context.",
      },
      { kind: "heading", num: "03", text: "Concurrency makes it harder", id: "s3" },
      {
        kind: "para",
        text: "Where concurrent delay is alleged, the position is yet more complex. The principles established in Henry Boot Construction (UK) Ltd v Malmaison Hotel (Manchester) Ltd⁴ and developed in Royal Brompton Hospital NHS Trust v Hammond (No. 7)⁵ require careful analysis of competing delay causes,analysis that must be compressed into days rather than weeks.",
      },
      {
        kind: "authority",
        name: "Walter Lilly & Company Ltd v Mackay",
        citation: "[2012] EWHC 1773 (TCC)",
        court: "Technology & Construction Court",
        point: "The leading modern authority on prospective versus retrospective delay analysis,demanding a level of forensic detail that traditional sequential methodologies struggle to deliver within adjudication timescales.⁶",
        url: "https://caselaw.nationalarchives.gov.uk/ewhc/tcc/2012/1773",
      },
      { kind: "pull", text: "The methodology must be adapted to the forum, not the other way around." },
      { kind: "heading", num: "04", text: "Restructuring the analysis", id: "s4" },
      {
        kind: "para",
        text: "The answer is not to abandon forensic discipline,it is to restructure how the analysis is performed.",
      },
      {
        kind: "view",
        paragraphs: [
          "At Meritus Via, we approach adjudication delay analysis differently. Our technology ingests the programme data, daily logs, and correspondence within hours of instruction. The critical path is identified algorithmically. Float consumption is mapped. The narrative is then built by our senior practitioners around the data, not around a traditional sequential methodology.",
          "The result is a forensically robust delay analysis,one that can withstand scrutiny by the adjudicator,delivered within the timescales that adjudication demands. The analysis is no less rigorous. It is simply structured for the reality of the forum.",
        ],
      },
      {
        kind: "para",
        text: "This distinction matters. Too many responding parties lose adjudications not because their position is weak, but because their delay analysis arrives incomplete or is presented in a format that the adjudicator cannot easily interrogate.",
      },
      { kind: "pull", text: "The twenty-eight-day clock does not pause for methodological perfectionism." },
    ],
    references: [
      { id: "1", text: "Housing Grants, Construction and Regeneration Act 1996, s.108 (as amended by the Local Democracy, Economic Development and Construction Act 2009, Part 8).", url: "https://www.legislation.gov.uk/ukpga/1996/53/section/108" },
      { id: "2", text: "CNO Plant Hire Ltd v Caldwell Construction Ltd [2024] EWHC 2188 (TCC).", url: "https://caselaw.nationalarchives.gov.uk/ewhc/tcc/2024/2188" },
      { id: "3", text: "Society of Construction Law, Delay and Disruption Protocol, 2nd Edition (February 2017).", url: "https://www.scl.org.uk/resources/delay-disruption-protocol" },
      { id: "4", text: "Henry Boot Construction (UK) Ltd v Malmaison Hotel (Manchester) Ltd [1999] 70 Con LR 32." },
      { id: "5", text: "Royal Brompton Hospital NHS Trust v Hammond (No. 7) [2001] 76 Con LR 148." },
      { id: "6", text: "Walter Lilly & Company Ltd v Mackay [2012] EWHC 1773 (TCC).", url: "https://caselaw.nationalarchives.gov.uk/ewhc/tcc/2012/1773" },
    ],
  },

  "building-safety-act-remediation": {
    takeaways: [
      "The Act creates retrospective liability: remediation contribution orders can reach developers and contractors on buildings completed decades ago.",
      "Section 134 extends the Defective Premises Act limitation period from six years to thirty,retrospectively.",
      "Liability turns on forensic reconstruction: who specified, who substituted, who approved, and who inspected.",
    ],
    blocks: [
      {
        kind: "lead",
        text: "The Building Safety Act 2022¹ has fundamentally reshaped the landscape of construction disputes in England and Wales. For those involved in the remediation of residential buildings,particularly high-rise developments over eighteen metres,the Act has introduced a new class of liability, extended limitation periods, and a degree of multi-party complexity that did not previously exist.",
      },
      { kind: "heading", num: "01", text: "A new class of liability", id: "s1" },
      {
        kind: "para",
        text: "At its core, the Act creates retrospective obligations. Sections 116 to 125 and Schedule 8² establish the framework for remediation contribution orders, enabling the First-tier Tribunal to require responsible parties to contribute to remediation costs. Developers of buildings completed in the last thirty years may now face such orders, even where the original works were compliant with the Building Regulations 2010³ in force at the time of construction. The introduction of the Building Safety Regulator, the requirements for Principal Accountable Persons, and the creation of new criminal offences for non-compliance have all added layers of regulatory exposure.",
      },
      {
        kind: "stat",
        value: "30",
        suffix: "years",
        label: "Retrospective limitation",
        detail: "Section 134 extends the Defective Premises Act 1972 limitation period from six years to thirty,reopening exposure on projects completed decades ago.",
      },
      {
        kind: "para",
        text: "The extended limitation period is particularly significant. Section 134 amends the Defective Premises Act 1972⁴ to extend the limitation period from six years to thirty years retrospectively for claims relating to dwellings. This single provision has reopened the liability exposure of developers, contractors, and design professionals on projects completed decades ago.",
      },
      { kind: "heading", num: "02", text: "Causation is the real battleground", id: "s2" },
      {
        kind: "para",
        text: "But the real challenge for disputes practitioners is the causation analysis. In a typical building defect claim, the chain of causation runs from defective work to resultant damage. Under the Building Safety Act, the analysis is more nuanced.",
      },
      {
        kind: "pull",
        text: "The question is not simply whether the cladding is non-compliant,it is who specified it, who approved the substitution, who inspected the installation, and who bears the duty to remediate.",
      },
      { kind: "heading", num: "03", text: "Anatomy of a remediation dispute", id: "s3" },
      {
        kind: "para",
        text: "Consider a typical scenario: a residential tower completed in 2012 with aluminium composite material cladding. The original specification called for Class A1 mineral wool insulation behind the cladding panels, in accordance with BS 8414⁵ fire performance requirements and the guidance in Approved Document B.⁶ During construction, the subcontractor substituted combustible PIR board on floors six through twelve. The substitution was not recorded in the contractor's quality records but was visible in the procurement chain.",
      },
      {
        kind: "list",
        title: "The liability cascade",
        items: [
          "The leaseholders have a direct statutory route to remediation,with protections ensuring they are not required to bear the costs⁷",
          "The developer faces a remediation contribution order before the First-tier Tribunal",
          "The developer, in turn, seeks recovery from the D&B contractor",
          "The contractor blames the façade subcontractor for the substitution",
          "The subcontractor points to the architect's performance specification being ambiguous",
        ],
      },
      {
        kind: "para",
        text: "Each party's liability depends on a forensic reconstruction of the design, procurement, and construction sequence.",
      },
      { kind: "heading", num: "04", text: "Old discipline, new framework", id: "s4" },
      {
        kind: "para",
        text: "This is where traditional disputes expertise meets a new statutory framework. The technical investigation,intrusive surveys, core sampling, BS 8414 compliance testing,must be coupled with a forensic document review that traces every specification change, every request for information, and every approval through the project lifecycle.",
      },
      {
        kind: "view",
        paragraphs: [
          "At Meritus Via, we are seeing an increasing volume of Building Safety Act remediation disputes. Our approach is to treat each case as a forensic investigation from day one: ingesting the full project record, mapping the decision chain, and isolating liability to the specific parties whose actions or omissions caused the non-compliance. The statutory framework may be new, but the forensic discipline required is not.",
        ],
      },
    ],
    references: [
      { id: "1", text: "Building Safety Act 2022 (c. 30).", url: "https://www.legislation.gov.uk/ukpga/2022/30/contents" },
      { id: "2", text: "Building Safety Act 2022, ss.116–125 and Schedule 8 (Remediation of certain defects).", url: "https://www.legislation.gov.uk/ukpga/2022/30/section/124" },
      { id: "3", text: "The Building Regulations 2010 (SI 2010/2214).", url: "https://www.legislation.gov.uk/uksi/2010/2214/contents" },
      { id: "4", text: "Defective Premises Act 1972, s.1 (as amended by Building Safety Act 2022, s.134, extending the limitation period to 30 years retrospectively).", url: "https://www.legislation.gov.uk/ukpga/1972/35/section/1" },
      { id: "5", text: "BS 8414-1:2015+A1:2017,Fire performance of external cladding systems. Test method for non-loadbearing external cladding systems applied to the masonry face of a building." },
      { id: "6", text: "HM Government, Approved Document B: Fire Safety,Volume 1: Dwellings (2019 edition incorporating amendments).", url: "https://www.gov.uk/government/publications/fire-safety-approved-document-b" },
      { id: "7", text: "Building Safety Act 2022, Schedule 8, paras 2–4 (Leaseholder protections,qualifying leaseholders of relevant buildings are protected from remediation costs).", url: "https://www.legislation.gov.uk/ukpga/2022/30/schedule/8" },
    ],
  },

  "ai-in-construction-disputes": {
    takeaways: [
      "Most tools marketed as 'AI for disputes' perform document processing, not forensic analysis. Useful,but not an opinion.",
      "Under CPR Part 35 and the Academy of Experts' 2026 guidance, AI use must be disclosed,and the expert remains personally responsible.",
      "The advantage goes to practitioners who use AI to build the evidence base while retaining full ownership of the professional judgment.",
    ],
    blocks: [
      {
        kind: "lead",
        text: "Every technology company in the construction disputes space is talking about artificial intelligence. The marketing materials promise automated delay analysis, instant quantum assessments, and AI-generated expert reports. The reality is more nuanced,and, for practitioners who understand the difference, more useful.",
      },
      { kind: "heading", num: "01", text: "Processing is not analysis", id: "s1" },
      {
        kind: "para",
        text: "The first distinction to draw is between genuine analytical capability and simple document processing. Most tools marketed as 'AI for construction disputes' are performing document classification, keyword extraction, and basic pattern matching. These are useful functions,being able to rapidly sort one hundred thousand project documents into chronological, thematic, or party-based categories saves significant analyst time. But they are not performing forensic analysis.",
      },
      {
        kind: "para",
        text: "Forensic delay analysis requires an understanding of critical path methodology, the contractual framework governing extensions of time, and the factual matrix of the specific project. No current AI system can independently determine whether a delay event was on the critical path, whether concurrent delay applies, or whether the contractor's mitigation efforts were reasonable. These are matters of professional judgment that require human expertise.",
      },
      { kind: "heading", num: "02", text: "What the technology actually does", id: "s2" },
      {
        kind: "view",
        paragraphs: [
          "What AI can do, effectively, is prepare the evidence base for human analysis. At Meritus Via, our proprietary tools ingest programme data,Primavera P6, Asta Powerproject, Microsoft Project schedules,and automatically map the critical path, identify float consumption patterns, and flag schedule anomalies. The system cross-references correspondence dates with programme updates to highlight potential areas of interest. It does not produce conclusions. It produces a structured evidence base that our senior practitioners can interrogate.",
          "The same principle applies to quantum analysis. Our tools can parse bills of quantities, variation accounts, and cost reports to identify mathematical inconsistencies, duplicated claims, and unsupported figures. The output is a flagged dataset,not a damages assessment. The assessment remains the responsibility of the quantum expert who understands the contractual mechanism, the applicable formula for head office overheads, and the evidential burden for each head of claim.",
        ],
      },
      { kind: "heading", num: "03", text: "The disclosure test", id: "s3" },
      {
        kind: "para",
        text: "This distinction is critical because the output of any technology-assisted analysis must be disclosable. Under CPR Part 35.3,¹ the expert's overriding duty is to the court,and that duty extends to full transparency about methodology. Practice Direction 35² requires experts to state the substance of all material instructions and the methodology employed.",
      },
      {
        kind: "para",
        text: "The Academy of Experts' guidance on AI use (2026)³ makes clear that experts must disclose any use of AI tools and are personally responsible for all material produced in their name, regardless of AI involvement. An expert who relies on an opaque AI system to produce conclusions will face significant difficulties under cross-examination. An expert who uses technology to structure and accelerate their own analysis,and can demonstrate exactly how,has a significant advantage.",
      },
      {
        kind: "authority",
        name: "Expert Witnesses,Vital Participants in Civil Justice",
        citation: "Lord Justice Birss, EWI Annual Conference, 20 June 2025",
        court: "Courts & Tribunals Judiciary",
        point: "CPR 35.1 restricts expert evidence to that 'reasonably required to resolve the proceedings',a principle that demands focus and selectivity, not the indiscriminate volume that AI tools can generate.⁴",
        url: "https://www.judiciary.uk/speech-by-lord-justice-birss-expert-witnesses-vital-participants-in-civil-justice/",
      },
      {
        kind: "para",
        text: "The judiciary has taken an increasingly clear position. The SRA Code of Conduct⁵ has already been applied in cases involving AI-generated inaccuracies in legal proceedings, and the regulatory direction is unambiguous.",
      },
      { kind: "pull", text: "The expert, not the tool, bears responsibility." },
      { kind: "heading", num: "04", text: "Where the advantage lies", id: "s4" },
      {
        kind: "para",
        text: "The gap between what technology companies promise and what practitioners actually need is substantial. The practitioners who will benefit most from AI are not those who hand over their analysis to a machine. They are those who use AI to work faster, more accurately, and with a more complete evidence base,while retaining full ownership of their professional opinions.",
      },
    ],
    references: [
      { id: "1", text: "Civil Procedure Rules, Part 35.3,Experts: overriding duty to the court.", url: "https://www.justice.gov.uk/courts/procedure-rules/civil/rules/part35" },
      { id: "2", text: "Practice Direction 35,Experts and Assessors, para 3.2.", url: "https://www.justice.gov.uk/courts/procedure-rules/civil/rules/part35/pd_part35" },
      { id: "3", text: "The Academy of Experts, Guidance for Expert Witnesses on the Use of Artificial Intelligence (January 2026).", url: "https://academyofexperts.org/practising-as-expert/expert-witness-guidance/guidance-for-expert-witnesses-on-the-use-of-artificial-intelligence-ai/" },
      { id: "4", text: "Lord Justice Birss, 'Expert Witnesses,Vital Participants in Civil Justice', Speech to the Expert Witness Institute Annual Conference (20 June 2025).", url: "https://www.judiciary.uk/speech-by-lord-justice-birss-expert-witnesses-vital-participants-in-civil-justice/" },
      { id: "5", text: "Solicitors Regulation Authority, Code of Conduct for Solicitors, RELs and RFLs (as updated).", url: "https://www.sra.org.uk/solicitors/standards-regulations/code-conduct-solicitors/" },
    ],
  },
};

/* ── Block renderer ─────────────────────────────────────────────────── */

function ArticleBlock({ block }: { block: Block }) {
  switch (block.kind) {
    case "lead":
      return (
        <p className="font-serif text-[19px] lg:text-[22px] text-ink/85 leading-[1.65]">
          {block.text}
        </p>
      );

    case "heading":
      return (
        <div id={block.id} className="pt-10 mt-2 border-t border-green/10 scroll-mt-24 lg:scroll-mt-28">
          <div className="font-mono text-[10px] tracking-[0.25em] text-brass/80 mb-3">
            PT.{block.num}
          </div>
          <h2 className="font-serif text-2xl lg:text-[30px] text-green leading-tight">
            {block.text}
          </h2>
        </div>
      );

    case "para":
      return (
        <p className="text-[15px] lg:text-[16px] text-ink/80 leading-[1.85] font-sans font-light tracking-[0.01em]">
          {block.text}
        </p>
      );

    case "pull":
      return (
        <blockquote className="border-l-2 border-brass/50 pl-6 lg:pl-8 py-1 my-2">
          <p className="font-serif text-xl lg:text-[24px] italic text-green leading-[1.5]">
            {block.text}
          </p>
        </blockquote>
      );

    case "authority":
      return (
        <div className="p-5 lg:p-6 border border-green/10 bg-green/[0.03] relative group">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-brass/30 transition-colors group-hover:border-brass/60" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-brass/30 transition-colors group-hover:border-brass/60" />
          <div className="font-mono text-[9px] tracking-[0.2em] text-brass/60 uppercase mb-2">
            Authority
          </div>
          <div className="font-serif text-[16px] text-green italic leading-snug mb-1">
            {block.name}
          </div>
          <div className="font-mono text-[10px] text-slate/60 tracking-wide mb-3">
            {block.citation} <span className="mx-1 text-brass/30">|</span> {block.court}
          </div>
          <p className="text-[13px] text-ink/65 leading-[1.7] font-light">
            {block.point}
          </p>
          {block.url && (
            <a
              href={block.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 font-mono text-[10px] tracking-[0.15em] uppercase text-brass hover:text-brass-dark transition-colors duration-200"
            >
              Read the source
              <span aria-hidden="true">&#8599;</span>
            </a>
          )}
        </div>
      );

    case "list":
      return (
        <div>
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-slate/50 mb-4">
            {block.title}
          </div>
          <ul className="space-y-3.5">
            {block.items.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-[14px] lg:text-[15px] text-ink/75 leading-relaxed">
                <span className="font-mono text-[10px] text-brass/70 mt-[3px] shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      );

    case "stat":
      return (
        <div className="border-y border-green/10 py-7 lg:py-8 flex items-center gap-6 lg:gap-10">
          <div className="font-serif leading-none text-green/30 shrink-0 flex items-start">
            <span className="text-[64px] lg:text-[84px] tracking-tight">{block.value}</span>
            <span className="text-[22px] lg:text-[28px] mt-2 ml-1">{block.suffix}</span>
          </div>
          <div>
            <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-brass/80 mb-2">
              {block.label}
            </div>
            <p className="text-[13px] text-slate/70 leading-[1.7] font-light max-w-md">
              {block.detail}
            </p>
          </div>
        </div>
      );

    case "view":
      return (
        <div className="bg-green grain relative overflow-hidden p-7 lg:p-9">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-brass/50" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-brass/50" />
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-brass mb-5">
            The Meritus View
          </div>
          <div className="space-y-5">
            {block.paragraphs.map((p, i) => (
              <p key={i} className="text-[14px] lg:text-[15px] text-cream/80 leading-[1.85] font-light">
                {p}
              </p>
            ))}
          </div>
        </div>
      );
  }
}

/* ── Page ───────────────────────────────────────────────────────────── */

export function generateStaticParams() {
  return INSIGHT_ARTICLES.map((article) => ({
    slug: article.slug,
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = INSIGHT_ARTICLES.find((a) => a.slug === slug);
  if (!article) return { title: "Insight Not Found", robots: { index: false, follow: false } };
  const meta = pageMetadata({
    title: article.title,
    description: article.excerpt,
    path: `/insights/${slug}`,
    keywords: [
      article.category,
      "construction disputes",
      "delay analysis",
      "Building Safety Act",
      "adjudication",
      "expert witness",
    ],
  });
  return {
    ...meta,
    openGraph: {
      type: "article",
      url: `${SITE_CONFIG.url}/insights/${slug}`,
      siteName: SITE_CONFIG.name,
      locale: "en_GB",
      title: `${article.title} | ${SITE_CONFIG.name}`,
      description: article.excerpt,
      publishedTime: article.isoDate,
      authors: [SITE_CONFIG.legalName],
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: article.title }],
    },
  };
}

export default async function InsightArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = INSIGHT_ARTICLES.find((a) => a.slug === slug);
  if (!article) notFound();

  const content = ARTICLE_CONTENT[slug];
  if (!content) notFound();

  const sections = content.blocks.filter(
    (b): b is Extract<Block, { kind: "heading" }> => b.kind === "heading"
  );

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt,
    datePublished: article.isoDate,
    dateModified: article.isoDate,
    author: { "@type": "Organization", name: SITE_CONFIG.legalName, url: SITE_CONFIG.url },
    publisher: {
      "@type": "Organization",
      name: SITE_CONFIG.name,
      logo: { "@type": "ImageObject", url: `${SITE_CONFIG.url}/opengraph-image` },
    },
    image: `${SITE_CONFIG.url}/opengraph-image`,
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_CONFIG.url}/insights/${slug}` },
    articleSection: article.category,
    isAccessibleForFree: true,
    inLanguage: "en-GB",
  };

  return (
    <>
      <JsonLd data={articleSchema} />
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
            <div className="lg:col-span-12 max-w-4xl">
              <FadeIn delay={0.1}>
                <div className="flex items-center gap-4 mb-8">
                  <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-brass/80">
                    {article.category}
                  </div>
                  <div className="font-mono text-[9px] tracking-[0.15em] text-cream/30 uppercase">
                    Briefing
                  </div>
                </div>
              </FadeIn>

              <FadeIn delay={0.2}>
                <h1 className="font-serif text-3xl lg:text-[44px] text-cream leading-[1.15] italic mb-8">
                  {article.title}
                </h1>
              </FadeIn>

              <FadeIn delay={0.3}>
                <div className="flex gap-6">
                  <div className="w-[1px] bg-brass/30 shrink-0 mt-2" />
                  <div className="flex items-center gap-4 font-mono text-[10px] text-cream/60">
                    <span>{article.date}</span>
                    <span className="text-brass/30">|</span>
                    <span>{article.readTime}</span>
                    <span className="text-brass/30">|</span>
                    <span>{sections.length} parts</span>
                  </div>
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-stone py-[clamp(4rem,8vw,8rem)] relative">
        <div className="max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto px-6 lg:px-[8%]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">

            {/* Article Content */}
            <div className="lg:col-span-8">
              {/* Key takeaways */}
              <FadeIn delay={0.05}>
                <div className="mb-14 p-6 lg:p-8 border border-green/10 bg-green/[0.03] relative">
                  <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-brass/40" />
                  <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-brass/40" />
                  <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-brass/80 mb-6">
                    Key Takeaways
                  </div>
                  <ol className="space-y-4">
                    {content.takeaways.map((t, i) => (
                      <li key={i} className="flex items-start gap-4">
                        <span className="font-mono text-[10px] text-brass/70 mt-[4px] shrink-0">
                          KT.{String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="text-[14px] lg:text-[15px] text-ink/75 leading-[1.7] font-light">
                          {t}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </FadeIn>

              {/* Structured body */}
              <div className="space-y-8">
                {content.blocks.map((block, i) => (
                  <FadeIn key={i} delay={0.1 + Math.min(i, 6) * 0.04}>
                    <ArticleBlock block={block} />
                  </FadeIn>
                ))}
              </div>

              {content.references.length > 0 && (
                <FadeIn delay={0.2}>
                  <div className="mt-16 pt-10 border-t border-green/10">
                    <div className="flex items-center gap-4 mb-8">
                      <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-slate/50">
                        References
                      </div>
                    </div>
                    <ol className="space-y-4">
                      {content.references.map((ref) => (
                        <li key={ref.id} className="text-[13px] lg:text-[14px] text-slate/70 leading-[1.7] font-sans font-light flex items-start gap-3">
                          <span className="font-mono text-[10px] text-brass/60 mt-[4px] shrink-0">[{ref.id}]</span>
                          {ref.url ? (
                            <a
                              href={ref.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate/70 underline decoration-brass/30 underline-offset-2 hover:text-brass hover:decoration-brass transition-colors duration-200"
                            >
                              {ref.text}
                              <span className="ml-1 text-brass/50 no-underline" aria-hidden="true">&#8599;</span>
                            </a>
                          ) : (
                            <span>{ref.text}</span>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                </FadeIn>
              )}

              <FadeIn delay={0.25}>
                <div className="mt-12 pt-8 border-t border-green/5">
                  <p className="text-[11px] text-slate/40 leading-relaxed italic">
                    The views expressed in this article are those of the author and are intended for general information only. They do not constitute legal advice and should not be relied upon as such. Specific professional advice should be sought in relation to any particular matter.
                  </p>
                </div>

                <div className="mt-10 pt-8 border-t border-green/10">
                  <Link
                    href="/insights"
                    className="inline-flex items-center gap-3 font-mono text-[11px] tracking-[0.15em] uppercase text-brass hover:text-brass-dark transition-colors duration-200 group"
                  >
                    <span className="transform group-hover:-translate-x-1 transition-transform duration-200">←</span>
                    Return to Insights
                  </Link>
                </div>
              </FadeIn>
            </div>

            {/* Side rail */}
            <aside className="hidden lg:block lg:col-span-4">
              <div className="sticky top-[120px] space-y-8">
                <FadeIn delay={0.15}>
                  <div className="p-6 border border-green/10 bg-green/[0.02] relative">
                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-brass/30" />
                    <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-brass/30" />
                    <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-slate/50 mb-5">
                      In this briefing
                    </div>
                    <nav aria-label="Article sections">
                      <ul className="space-y-3">
                        {sections.map((s) => (
                          <li key={s.id}>
                            <a
                              href={`#${s.id}`}
                              className="group flex items-baseline gap-3 text-[13px] text-slate/70 hover:text-brass transition-colors duration-200"
                            >
                              <span className="font-mono text-[9px] tracking-[0.15em] text-brass/50 group-hover:text-brass transition-colors duration-200 shrink-0">
                                PT.{s.num}
                              </span>
                              <span className="leading-snug">{s.text}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </nav>
                  </div>
                </FadeIn>

                <FadeIn delay={0.2}>
                  <div className="p-6 bg-green grain relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-brass/50" />
                    <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-brass/50" />
                    <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-brass mb-3">
                      Apply this thinking
                    </div>
                    <p className="text-[13px] text-cream/70 leading-[1.7] font-light mb-5">
                      Facing this issue on a live matter? A partner will review your position directly.
                    </p>
                    <Link
                      href="/contact"
                      className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.15em] uppercase text-brass hover:text-brass-light transition-colors duration-200"
                    >
                      Request Conflict Check
                      <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </FadeIn>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <CTABand
        heading="Discuss your position"
        subtext="Direct access to a partner. No intermediaries."
      />
    </>
  );
}
