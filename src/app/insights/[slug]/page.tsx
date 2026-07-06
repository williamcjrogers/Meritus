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
        text: "The standard approach to forensic delay analysis (retrospective windows analysis, full as-planned versus as-built comparisons, and granular critical path interrogation) was designed for litigation and arbitration. These methods assume months of preparation time, access to complete project records, and the ability to present technical evidence over multiple hearing days.",
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
        text: "Adjudication does not offer any of those luxuries. The statutory right to adjudicate under the Housing Grants, Construction and Regeneration Act 1996, s.108¹ provides for a decision within twenty-eight days of referral. From the moment a Notice of Adjudication is served, the referring party typically has seven days to serve its Referral. The responding party then has a matter of weeks, often as few as fourteen days, to prepare and submit its Response.",
      },
      {
        kind: "para",
        text: "Yet the same forensic rigour is expected. The adjudicator will scrutinise the delay analysis with the same technical eye as an arbitrator, as confirmed by the TCC's robust approach to enforcement in cases such as CNO Plant Hire Ltd v Caldwell Construction Ltd [2024] EWHC 2188 (TCC).² The difference is that you have a fraction of the time to prepare it.",
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
        text: "The SCL Delay and Disruption Protocol (2nd Edition, 2017)³ now recognises that no single methodology is preferred, providing a menu of approaches with guidance on selecting the appropriate method for the circumstances. This flexibility is critical in the adjudication context.",
      },
      { kind: "heading", num: "03", text: "Concurrency makes it harder", id: "s3" },
      {
        kind: "para",
        text: "Where concurrent delay is alleged, the position is yet more complex. The principles established in Henry Boot Construction (UK) Ltd v Malmaison Hotel (Manchester) Ltd⁴ and developed in Royal Brompton Hospital NHS Trust v Hammond (No. 7)⁵ require careful analysis of competing delay causes: analysis that must be compressed into days rather than weeks.",
      },
      {
        kind: "authority",
        name: "Walter Lilly & Company Ltd v Mackay",
        citation: "[2012] EWHC 1773 (TCC)",
        court: "Technology & Construction Court",
        point: "The leading modern authority on prospective versus retrospective delay analysis, demanding a level of forensic detail that traditional sequential methodologies struggle to deliver within adjudication timescales.⁶",
        url: "https://caselaw.nationalarchives.gov.uk/ewhc/tcc/2012/1773",
      },
      { kind: "pull", text: "The methodology must be adapted to the forum, not the other way around." },
      { kind: "heading", num: "04", text: "Restructuring the analysis", id: "s4" },
      {
        kind: "para",
        text: "The answer is not to abandon forensic discipline; it is to restructure how the analysis is performed.",
      },
      {
        kind: "view",
        paragraphs: [
          "At Meritus Via, we approach adjudication delay analysis differently. Our technology ingests the programme data, daily logs, and correspondence within hours of instruction. The critical path is identified algorithmically. Float consumption is mapped. The narrative is then built by our senior practitioners around the data, not around a traditional sequential methodology.",
          "The result is a forensically robust delay analysis: one that can withstand scrutiny by the adjudicator, delivered within the timescales that adjudication demands. The analysis is no less rigorous. It is simply structured for the reality of the forum.",
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
      "Section 135 extends the Defective Premises Act limitation period from six years to thirty, retrospectively.",
      "Liability turns on forensic reconstruction: who specified, who substituted, who approved, and who inspected.",
    ],
    blocks: [
      {
        kind: "lead",
        text: "The Building Safety Act 2022¹ has fundamentally reshaped the landscape of construction disputes in England and Wales. For those involved in the remediation of residential buildings, particularly high-rise developments over eighteen metres, the Act has introduced a new class of liability, extended limitation periods, and a degree of multi-party complexity that did not previously exist.",
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
        detail: "Section 135 extends the Defective Premises Act 1972 limitation period from six years to thirty, reopening exposure on projects completed decades ago.",
      },
      {
        kind: "para",
        text: "The extended limitation period is particularly significant. Section 135 amends the Defective Premises Act 1972⁴ to extend the limitation period from six years to thirty years retrospectively for claims relating to dwellings. This single provision has reopened the liability exposure of developers, contractors, and design professionals on projects completed decades ago.",
      },
      { kind: "heading", num: "02", text: "Causation is the real battleground", id: "s2" },
      {
        kind: "para",
        text: "But the real challenge for disputes practitioners is the causation analysis. In a typical building defect claim, the chain of causation runs from defective work to resultant damage. Under the Building Safety Act, the analysis is more nuanced.",
      },
      {
        kind: "pull",
        text: "The question is not simply whether the cladding is non-compliant; it is who specified it, who approved the substitution, who inspected the installation, and who bears the duty to remediate.",
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
          "The leaseholders have a direct statutory route to remediation, with protections ensuring they are not required to bear the costs⁷",
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
        text: "This is where traditional disputes expertise meets a new statutory framework. The technical investigation (intrusive surveys, core sampling, BS 8414 compliance testing) must be coupled with a forensic document review that traces every specification change, every request for information, and every approval through the project lifecycle.",
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
      { id: "2", text: "Building Safety Act 2022, ss.116-125 and Schedule 8 (Remediation of certain defects).", url: "https://www.legislation.gov.uk/ukpga/2022/30/section/124" },
      { id: "3", text: "The Building Regulations 2010 (SI 2010/2214).", url: "https://www.legislation.gov.uk/uksi/2010/2214/contents" },
      { id: "4", text: "Defective Premises Act 1972, s.1 (as amended by Building Safety Act 2022, s.135, extending the limitation period to 30 years retrospectively).", url: "https://www.legislation.gov.uk/ukpga/1972/35/section/1" },
      { id: "5", text: "BS 8414-1:2015+A1:2017, Fire performance of external cladding systems. Test method for non-loadbearing external cladding systems applied to the masonry face of a building.", url: "https://knowledge.bsigroup.com/products/fire-performance-of-external-cladding-systems-test-method-for-non-loadbearing-external-cladding-systems-applied-to-the-masonry-face-of-a-building" },
      { id: "6", text: "HM Government, Approved Document B: Fire Safety, Volume 1: Dwellings (2019 edition incorporating amendments).", url: "https://www.gov.uk/government/publications/fire-safety-approved-document-b" },
      { id: "7", text: "Building Safety Act 2022, Schedule 8, paras 2-4 (Leaseholder protections: qualifying leaseholders of relevant buildings are protected from remediation costs).", url: "https://www.legislation.gov.uk/ukpga/2022/30/schedule/8" },
    ],
  },

  "ai-in-construction-disputes": {
    takeaways: [
      "Most tools marketed as 'AI for disputes' perform document processing, not forensic analysis. Useful, but not an opinion.",
      "Under CPR Part 35 and the Academy of Experts' 2026 guidance, AI use must be disclosed, and the expert remains personally responsible.",
      "The advantage goes to practitioners who use AI to build the evidence base while retaining full ownership of the professional judgment.",
    ],
    blocks: [
      {
        kind: "lead",
        text: "Every technology company in the construction disputes space is talking about artificial intelligence. The marketing materials promise automated delay analysis, instant quantum assessments, and AI-generated expert reports. The reality is more nuanced and, for practitioners who understand the difference, more useful.",
      },
      { kind: "heading", num: "01", text: "Processing is not analysis", id: "s1" },
      {
        kind: "para",
        text: "The first distinction to draw is between genuine analytical capability and simple document processing. Most tools marketed as 'AI for construction disputes' are performing document classification, keyword extraction, and basic pattern matching. These are useful functions: being able to rapidly sort one hundred thousand project documents into chronological, thematic, or party-based categories saves significant analyst time. But they are not performing forensic analysis.",
      },
      {
        kind: "para",
        text: "Forensic delay analysis requires an understanding of critical path methodology, the contractual framework governing extensions of time, and the factual matrix of the specific project. No current AI system can independently determine whether a delay event was on the critical path, whether concurrent delay applies, or whether the contractor's mitigation efforts were reasonable. These are matters of professional judgment that require human expertise.",
      },
      { kind: "heading", num: "02", text: "What the technology actually does", id: "s2" },
      {
        kind: "view",
        paragraphs: [
          "What AI can do, effectively, is prepare the evidence base for human analysis. At Meritus Via, our proprietary tools ingest programme data (Primavera P6, Asta Powerproject, Microsoft Project schedules) and automatically map the critical path, identify float consumption patterns, and flag schedule anomalies. The system cross-references correspondence dates with programme updates to highlight potential areas of interest. It does not produce conclusions. It produces a structured evidence base that our senior practitioners can interrogate.",
          "The same principle applies to quantum analysis. Our tools can parse bills of quantities, variation accounts, and cost reports to identify mathematical inconsistencies, duplicated claims, and unsupported figures. The output is a flagged dataset, not a damages assessment. The assessment remains the responsibility of the quantum expert who understands the contractual mechanism, the applicable formula for head office overheads, and the evidential burden for each head of claim.",
        ],
      },
      { kind: "heading", num: "03", text: "The disclosure test", id: "s3" },
      {
        kind: "para",
        text: "This distinction is critical because the output of any technology-assisted analysis must be disclosable. Under CPR Part 35.3,¹ the expert's overriding duty is to the court, and that duty extends to full transparency about methodology. Practice Direction 35² requires experts to state the substance of all material instructions and the methodology employed.",
      },
      {
        kind: "para",
        text: "The Academy of Experts' guidance on AI use (2026)³ makes clear that experts must disclose any use of AI tools and are personally responsible for all material produced in their name, regardless of AI involvement. An expert who relies on an opaque AI system to produce conclusions will face significant difficulties under cross-examination. An expert who uses technology to structure and accelerate their own analysis, and can demonstrate exactly how, has a significant advantage.",
      },
      {
        kind: "authority",
        name: "Expert Witnesses: Vital Participants in Civil Justice",
        citation: "Lord Justice Birss, EWI Annual Conference, 20 June 2025",
        court: "Courts & Tribunals Judiciary",
        point: "CPR 35.1 restricts expert evidence to that 'reasonably required to resolve the proceedings', a principle that demands focus and selectivity, not the indiscriminate volume that AI tools can generate.⁴",
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
        text: "The gap between what technology companies promise and what practitioners actually need is substantial. The practitioners who will benefit most from AI are not those who hand over their analysis to a machine. They are those who use AI to work faster, more accurately, and with a more complete evidence base, while retaining full ownership of their professional opinions.",
      },
    ],
    references: [
      { id: "1", text: "Civil Procedure Rules, Part 35.3, Experts: overriding duty to the court.", url: "https://www.justice.gov.uk/courts/procedure-rules/civil/rules/part35" },
      { id: "2", text: "Practice Direction 35, Experts and Assessors, para 3.2.", url: "https://www.justice.gov.uk/courts/procedure-rules/civil/rules/part35/pd_part35" },
      { id: "3", text: "The Academy of Experts, Guidance for Expert Witnesses on the Use of Artificial Intelligence (January 2026).", url: "https://academyofexperts.org/practising-as-expert/expert-witness-guidance/guidance-for-expert-witnesses-on-the-use-of-artificial-intelligence-ai/" },
      { id: "4", text: "Lord Justice Birss, 'Expert Witnesses: Vital Participants in Civil Justice', Speech to the Expert Witness Institute Annual Conference (20 June 2025).", url: "https://www.judiciary.uk/speech-by-lord-justice-birss-expert-witnesses-vital-participants-in-civil-justice/" },
      { id: "5", text: "Solicitors Regulation Authority, Code of Conduct for Solicitors, RELs and RFLs (as updated).", url: "https://www.sra.org.uk/solicitors/standards-regulations/code-conduct-solicitors/" },
    ],
  },

  "proving-disruption-claims": {
    takeaways: [
      "Disruption is lost productivity, not lost time. It can exist without any delay to completion, and it is recovered as loss and expense or damages, with the burden squarely on the claiming party.",
      "The measured mile remains the most persuasive method, but it demands a clean comparator. Where none exists, alternative methods succeed only when applied with the same bottom-up rigour.",
      "Tribunals reward causation built from contemporaneous records. Global assertions of overspend fail, however large the number and however sophisticated the presentation.",
    ],
    blocks: [
      {
        kind: "lead",
        text: "Ask any quantum practitioner which head of claim is hardest to prove and the answer rarely varies: disruption. It appears in nearly every substantial final account dispute, it is frequently the largest single figure on the schedule, and it fails more often than any other. The reason is structural. Disruption is a claim about productivity, and productivity is invisible until it is measured.",
      },
      { kind: "heading", num: "01", text: "Lost productivity, not lost time", id: "s1" },
      {
        kind: "para",
        text: "The two are routinely conflated, and the distinction matters. Delay is about time: the works finished later than they should have. Disruption is about efficiency: the works cost more to build than they should have, because labour and plant achieved less per hour than the contractor was entitled to expect. The SCL Delay and Disruption Protocol draws the line precisely, recognising that disruption can occur without any delay to completion at all.¹ A contractor can hold the completion date by flooding the site with additional resource and still carry a substantial disruption loss for the cost of doing so.",
      },
      {
        kind: "para",
        text: "That is also why the compensation route differs. There is no extension of time to claim. Disruption is recovered as loss and expense under the contract, or as damages for breach, and the claiming party bears the full burden of establishing cause, effect, and quantum.",
      },
      { kind: "heading", num: "02", text: "The measured mile and its limits", id: "s2" },
      {
        kind: "para",
        text: "The most persuasive method remains the measured mile: identify a period or section of the works unaffected by the events complained of, measure productivity there, and compare it with the impacted work. Done properly, the comparison strips out matters that sit at the contractor's own risk: tender optimism, poor supervision, defective workmanship. The logic has judicial pedigree reaching back to Whittall Builders v Chester-le-Street District Council, where output achieved in an undisrupted period provided the yardstick for valuing the disrupted one.²",
      },
      {
        kind: "para",
        text: "The difficulty is that the method presumes a clean comparator, and complex projects rarely offer one. Where the whole site was impacted from the first week, or the works are too heterogeneous to compare, the analysis must reach for alternatives: earned value analysis, work sampling, programme-based studies, or, at the bottom of the evidential hierarchy, published industry productivity factors.³ None of these is illegitimate. Each is judged by the same test: does it demonstrate, rather than assert, the causal link between the event and the lost productivity?",
      },
      { kind: "pull", text: "A disruption claim is won or lost in the project records, long before an expert touches it." },
      { kind: "heading", num: "03", text: "Where these claims die", id: "s3" },
      {
        kind: "para",
        text: "The case law is a catalogue of self-inflicted wounds. In Van Oord v Allseas, claims presented with apparent sophistication collapsed on contact with the contemporaneous record: the witness evidence was contradicted by the documents, and the quantum evidence had taken the pleaded figures largely on trust.⁴ The judgment remains the standard citation for what happens when a disruption claim is built top-down from the overspend rather than bottom-up from the records.",
      },
      {
        kind: "authority",
        name: "Walter Lilly & Company Ltd v Mackay",
        citation: "[2012] EWHC 1773 (TCC)",
        court: "Technology & Construction Court",
        point: "Akenhead J's treatment of global claims: a total-cost presentation is not automatically barred, but the claimant assumes the evidential risk that any significant cause of the overspend was its own responsibility. That risk materialises with regularity.⁵",
        url: "https://caselaw.nationalarchives.gov.uk/ewhc/tcc/2012/1773",
      },
      {
        kind: "para",
        text: "The pattern repeats because the arithmetic is seductive. Actual cost minus tender allowance equals claim. But that formula assumes the tender was adequate, the site was otherwise efficient, and every unproductive hour traces to the respondent. Tribunals do not extend that courtesy, and opposing experts are retained precisely to withhold it.",
      },
      { kind: "heading", num: "04", text: "Building the claim bottom-up", id: "s4" },
      {
        kind: "list",
        title: "What the evidence base requires",
        items: [
          "A baseline: tender build-ups, productivity norms, or an unimpacted comparator, established before the impacted analysis begins",
          "Resource records: allocation sheets, timesheets, and plant returns showing where labour actually went, week by week",
          "Cause-and-effect mapping: each disruptive event tied to the specific work fronts, trades, and periods it affected",
          "Contemporaneous corroboration: site diaries, progress photographs, and correspondence recording the disruption as it happened, not as reconstructed for the dispute",
        ],
      },
      {
        kind: "view",
        paragraphs: [
          "At Meritus Via, disruption analysis starts with the records, not the pleaded number. Our platforms ingest timesheets, allocation sheets, daily diaries, and progress data at scale, then reconstruct where resource was deployed and what it achieved, period by period. Where a measured mile exists, it is identified from the data rather than asserted from recollection.",
          "The result is a productivity analysis a tribunal can interrogate: every figure traced to a source document, every impacted period tied to a cause. Claims built this way settle more often than they fight, because the opposing expert can verify them rather than merely dispute them.",
        ],
      },
    ],
    references: [
      { id: "1", text: "Society of Construction Law, Delay and Disruption Protocol, 2nd Edition (February 2017), Part B guidance on disruption.", url: "https://www.scl.org.uk/resources/delay-disruption-protocol" },
      { id: "2", text: "Whittall Builders Co Ltd v Chester-le-Street District Council (1985) 40 BLR 82." },
      { id: "3", text: "AACE International, Recommended Practice No. 25R-03, Estimating Lost Labor Productivity in Construction Claims (2004).", url: "https://web.aacei.org/docs/default-source/toc/toc_25r-03.pdf" },
      { id: "4", text: "Van Oord UK Ltd v Allseas UK Ltd [2015] EWHC 3074 (TCC).", url: "https://caselaw.nationalarchives.gov.uk/ewhc/tcc/2015/3074" },
      { id: "5", text: "Walter Lilly & Company Ltd v Mackay [2012] EWHC 1773 (TCC).", url: "https://caselaw.nationalarchives.gov.uk/ewhc/tcc/2012/1773" },
    ],
  },

  "smash-and-grab-true-value": {
    takeaways: [
      "Section 111 makes the notified sum payable without deduction. Miss the payment notice and pay less notice windows and the application stands as the debt, merits notwithstanding.",
      "S&T v Grove confirmed the true-value counterweight, but it is subordinate to the immediate payment obligation. The sequencing rule is pay first, dispute second.",
      "Most smash-and-grab losses are administrative failures, not valuation disputes. Notice discipline is a system, and systems can be engineered.",
    ],
    blocks: [
      {
        kind: "lead",
        text: "The vocabulary is inelegant, but everyone in the industry understands it. A smash-and-grab adjudication seeks payment of the sum stated in an application not because the valuation is right, but because the paying party failed to serve a valid payment notice or pay less notice in time. For the better part of a decade the courts have been mapping the boundaries of that tactic and of its counterweight, the true-value adjudication. The map is now reasonably settled. The casualties are the parties who have not read it.",
      },
      { kind: "heading", num: "01", text: "The notified sum rule", id: "s1" },
      {
        kind: "stat",
        value: "5",
        suffix: "days",
        label: "The payment notice window",
        detail: "Under section 110A of the Construction Act, a payment notice must be given not later than five days after the payment due date. In its absence, a compliant application for payment can itself become the notified sum.",
      },
      {
        kind: "para",
        text: "The machinery is unforgiving by design. The Housing Grants, Construction and Regeneration Act 1996, as amended, requires the notified sum to be paid on or before the final date for payment.¹ A payer intending to pay less must say so in a valid pay less notice, served within the prescribed period and setting out the sum it considers due and the basis on which that sum is calculated.² Serve nothing, or serve something defective, and section 111 converts the payee's application into an enforceable debt. Adjudicators enforce it, and the TCC enforces the adjudicators.",
      },
      {
        kind: "para",
        text: "The reported cases turn on small administrative facts: a notice served a day late, a notice that states a figure without the basis of calculation, an application issued outside the contractual window, a due date miscalculated under a bespoke payment schedule. The valuation merits are irrelevant at this stage. That is not a defect in the regime; it is the point of it. Cash flow first, argument afterwards.",
      },
      { kind: "heading", num: "02", text: "The Grove counterweight", id: "s2" },
      {
        kind: "authority",
        name: "S&T (UK) Ltd v Grove Developments Ltd",
        citation: "[2018] EWCA Civ 2448",
        court: "Court of Appeal",
        point: "The employer who misses its notices must pay the notified sum, but may then commence its own adjudication on the true value of the works. The decision dismantled the idea that a missed notice fixes the valuation for good.³",
        url: "https://caselaw.nationalarchives.gov.uk/ewca/civ/2018/2448",
      },
      {
        kind: "para",
        text: "Grove restored balance, but on strict terms. The right to a true-value adjudication arises only once the section 111 obligation has been discharged. In M Davenport Builders v Greer, the court refused to let a paying party deploy a true-value decision as a set-off against an unpaid notified sum.⁴ In Bexheat v Essex Services Group, the point was put beyond argument: the immediate payment obligation must be performed before a true-value adjudication on the same cycle can be pursued.⁵",
      },
      { kind: "pull", text: "Pay now, argue later is not a slogan. It is the sequencing rule the courts actually enforce." },
      {
        kind: "para",
        text: "The margins still generate litigation, notably over when the right to refer a true valuation accrues and what happens to a reference launched prematurely, as in Henry Construction Projects v Alu-Fix.⁶ But the architecture is stable. The notified sum is a debt. The true value is a later question.",
      },
      { kind: "heading", num: "03", text: "Losses that were never about valuation", id: "s3" },
      {
        kind: "para",
        text: "Step back from the authorities and a pattern emerges: very few smash-and-grab defeats involve a genuine disagreement about what the works were worth. They involve paperwork. Payment administration is typically manual, distributed across a commercial team, and invisible until it fails; a payment calendar that quietly diverged from the contract after the works were varied is discovered only when the money has already moved.",
      },
      {
        kind: "list",
        title: "Where the machinery breaks",
        items: [
          "Due dates miscalculated under amended or bespoke payment schedules",
          "Payment notices served late, or without the required basis of calculation",
          "Pay less notices that respond to the wrong application or state a bare figure",
          "Applications for payment that are themselves invalid: served early, served late, or lacking the substantiation the contract demands",
        ],
      },
      { kind: "heading", num: "04", text: "Discipline as a system", id: "s4" },
      {
        kind: "view",
        paragraphs: [
          "At Meritus Via, we treat payment-cycle discipline as an engineering problem. Our deadline engines hold every live contract's payment calendar, from due dates to notice windows to final dates for payment, and track compliance in real time, so a five-day window is never discovered in retrospect. When a dispute crystallises, the notice chronology is already assembled and evidenced.",
          "The same discipline serves the referring party. A smash-and-grab succeeds or fails on the validity of the application and the invalidity of the response. Both are documentary questions, and both reward the party who can put a complete notice record in front of an adjudicator on day one.",
        ],
      },
      {
        kind: "para",
        text: "The payment regime exists to keep cash moving through the industry, and it does. But it rewards administrative precision over commercial merit, and it will keep transferring money from the disorganised to the organised until notices are treated with the seriousness the statute always intended.",
      },
    ],
    references: [
      { id: "1", text: "Housing Grants, Construction and Regeneration Act 1996, s.111, as substituted by the Local Democracy, Economic Development and Construction Act 2009, s.144.", url: "https://www.legislation.gov.uk/ukpga/2009/20/section/144" },
      { id: "2", text: "Housing Grants, Construction and Regeneration Act 1996, ss.110A and 110B (payment notices and payee's notices in default).", url: "https://www.legislation.gov.uk/ukpga/1996/53/section/110A" },
      { id: "3", text: "S&T (UK) Ltd v Grove Developments Ltd [2018] EWCA Civ 2448.", url: "https://caselaw.nationalarchives.gov.uk/ewca/civ/2018/2448" },
      { id: "4", text: "M Davenport Builders Ltd v Greer & Anor [2019] EWHC 318 (TCC).", url: "https://caselaw.nationalarchives.gov.uk/ewhc/tcc/2019/318" },
      { id: "5", text: "Bexheat Ltd v Essex Services Group Ltd [2022] EWHC 936 (TCC).", url: "https://caselaw.nationalarchives.gov.uk/ewhc/tcc/2022/936" },
      { id: "6", text: "Henry Construction Projects Ltd v Alu-Fix (UK) Ltd [2023] EWHC 2010 (TCC).", url: "https://caselaw.nationalarchives.gov.uk/ewhc/tcc/2023/2010" },
    ],
  },

  "expert-witness-independence": {
    takeaways: [
      "The expert's overriding duty is to the tribunal, not the instructing party, and the courts now enforce it by excluding evidence rather than merely discounting it.",
      "Credibility is rarely destroyed in cross-examination. It is destroyed earlier: undisclosed contact and site visits, solicitor-shaped opinions, positions that shift with the client's case.",
      "The strongest protection is a traceable evidence base: an opinion the expert can walk backwards, from conclusion to source document, without a gap.",
    ],
    blocks: [
      {
        kind: "lead",
        text: "Every expert report filed in the Technology and Construction Court carries the same declaration: that the expert understands the duty to the court and has complied with it. For years that declaration was treated as boilerplate. It is not treated as boilerplate now. The modern court reads it as a warranty, and it has shown itself willing to exclude expert evidence entirely where the warranty proves false.",
      },
      { kind: "heading", num: "01", text: "The duty, restated", id: "s1" },
      {
        kind: "para",
        text: "The content of the duty has been settled since The Ikarian Reefer: expert evidence should be, and be seen to be, the independent product of the expert, uninfluenced by the exigencies of litigation.¹ CPR Part 35 gives it procedural force. Expert evidence is restricted to what is reasonably required, the duty to the court overrides any obligation to the party paying the fee, and the report must state the substance of all material instructions.² And since Jones v Kaney, the expert who fails in that duty can no longer shelter behind immunity from suit.³",
      },
      {
        kind: "authority",
        name: "The Ikarian Reefer",
        citation: "[1993] 2 Lloyd's Rep 68",
        court: "Commercial Court",
        point: "Cresswell J's classic statement of the expert's obligations: independent assistance by way of objective, unbiased opinion, never the role of an advocate. Three decades on, it remains the standard against which construction experts are measured.",
      },
      { kind: "heading", num: "02", text: "From criticism to exclusion", id: "s2" },
      {
        kind: "para",
        text: "For a long time the sanction for partisanship was rhetorical: adverse comment in the judgment and diminished weight. That era has ended. In Dana UK Axle v Freudenberg, the TCC excluded a party's technical expert evidence in its entirety, mid-trial, after it emerged that the experts had made undisclosed site visits and enjoyed a free flow of information from their client that was never revealed in their reports.⁴ The message was structural: serious breaches of Practice Direction 35 go to admissibility, not merely to weight.",
      },
      {
        kind: "para",
        text: "Andrews v Kronospan runs on the same line. Where an expert had engaged in extensive undisclosed communications with the instructing solicitors while the experts' joint statement was being negotiated, the court revoked permission to rely on him altogether.⁵ The joint statement process, long treated by some as a private drafting exercise, is now firmly understood as a space in which the experts must be left alone.",
      },
      { kind: "pull", text: "An expert who argues the case stops assisting the tribunal. And tribunals have stopped pretending not to notice." },
      { kind: "heading", num: "03", text: "How credibility actually dies", id: "s3" },
      {
        kind: "para",
        text: "The construction authorities share an anatomy. In Imperial Chemical Industries v Merit Merrell Technology, the court restated the governing principles after finding that experts had approached their task as advocates for the party instructing them.⁶ In Beattie Passive Norse v Canham Consulting, an expert whose analysis departed from the contemporaneous record was dismantled in the judgment, and the claim substantially failed with him.⁷",
      },
      {
        kind: "para",
        text: "Note what these failures have in common. None was produced by a brilliant cross-examination. Each was latent in how the opinion was assembled: a selective document diet, conclusions formed early and defended late, positions that tracked the pleadings rather than the evidence. Cross-examination merely surfaced what the working method had already built in.",
      },
      { kind: "heading", num: "04", text: "Traceability as protection", id: "s4" },
      {
        kind: "para",
        text: "The practical question is how to make independence demonstrable rather than declaratory. The answer is architectural. An opinion is defensible when every figure, every date, and every causal statement can be walked backwards to a source document, and when the methodology, including any technology deployed in the analysis, is disclosed and repeatable.",
      },
      {
        kind: "view",
        paragraphs: [
          "At Meritus Via, every expert opinion sits on a structured evidence base. The documents relied on are indexed and sourced, the analysis connecting record to conclusion is traceable step by step, and the same platforms that accelerate the work produce, as a by-product, the audit trail that Practice Direction 35 demands. Nothing in the opinion rests on recollection or assertion.",
          "Independence is not a temperament. It is a working method, and it is visible in the work product. The expert who can show the tribunal exactly how the opinion was built has nothing to fear from the question that ends careers: who decided that?",
        ],
      },
    ],
    references: [
      { id: "1", text: "National Justice Compania Naviera SA v Prudential Assurance Co Ltd (The Ikarian Reefer) [1993] 2 Lloyd's Rep 68.", url: "https://www.uniset.ca/other/cs2/19932LLR68.html" },
      { id: "2", text: "Civil Procedure Rules, Part 35 and Practice Direction 35.", url: "https://www.justice.gov.uk/courts/procedure-rules/civil/rules/part35" },
      { id: "3", text: "Jones v Kaney [2011] UKSC 13.", url: "https://caselaw.nationalarchives.gov.uk/uksc/2011/13" },
      { id: "4", text: "Dana UK Axle Ltd v Freudenberg FST GmbH [2021] EWHC 1413 (TCC).", url: "https://caselaw.nationalarchives.gov.uk/ewhc/tcc/2021/1413" },
      { id: "5", text: "Andrews & Ors v Kronospan Ltd [2022] EWHC 479 (QB).", url: "https://caselaw.nationalarchives.gov.uk/ewhc/qb/2022/479" },
      { id: "6", text: "Imperial Chemical Industries Ltd v Merit Merrell Technology Ltd [2018] EWHC 1577 (TCC).", url: "https://caselaw.nationalarchives.gov.uk/ewhc/tcc/2018/1577" },
      { id: "7", text: "Beattie Passive Norse Ltd v Canham Consulting Ltd [2021] EWHC 1116 (TCC).", url: "https://caselaw.nationalarchives.gov.uk/ewhc/tcc/2021/1116" },
    ],
  },

  "concurrent-delay-entitlement": {
    takeaways: [
      "In England, true concurrent delay does not reduce the contractor's extension of time: Walter Lilly settled the point and rejected apportionment.",
      "Time and money diverge. The concurrent period carries no loss and expense unless the contractor can separate the costs caused by the employer delay from those caused by its own.",
      "Concurrency risk can be reallocated by express terms. After North Midland, the first question is not what the law says but what the clause says.",
    ],
    blocks: [
      { kind: "lead", text: "Concurrent delay takes up more space in delay submissions than any other doctrine, and it is misapplied in most of them. The English position is settled and deliberately asymmetric: where employer delay and contractor delay are truly concurrent, the contractor keeps its extension of time in full, but it recovers nothing for the concurrent period unless it can separate the money. Who keeps the time and who pays for it are different questions with different answers." },
      { kind: "heading", num: "01", text: "What concurrency actually means", id: "s1" },
      { kind: "para", text: "The working definition comes from Henry Boot Construction (UK) Ltd v Malmaison Hotel (Manchester) Ltd (1999) 70 Con LR 32.¹ Dyson J recorded the parties' agreed position: if there are two concurrent causes of delay, one of which is a relevant event and the other is not, the contractor is entitled to an extension of time for the period of delay caused by the relevant event, notwithstanding the concurrent effect of the other. The example given was exceptionally inclement weather stopping the works for a week while the contractor was, in the same week, short of labour: one cause a relevant event, one not, both operative." },
      { kind: "para", text: "Two decades of refinement have sharpened the concept rather than changed it. The definition now most often adopted is John Marrin QC's: a period of project overrun caused by two or more effective causes of delay of approximately equal causative potency, a formulation endorsed by the Court of Appeal in North Midland. The qualification matters. True concurrency requires two effective causes operating at the same time, each independently sufficient to delay completion. Delays that are sequential, delays on different paths, and contractor delay that merely coexists with an employer event without driving completion do not qualify." },
      { kind: "pull", text: "True concurrency is rare; asserted concurrency is everywhere." },
      { kind: "heading", num: "02", text: "Time: the full extension survives", id: "s2" },
      { kind: "para", text: "Walter Lilly & Company Ltd v Mackay [2012] EWHC 1773 (TCC) settled the English position on time.² Akenhead J held, at [370], that where delay is caused by two or more effective causes, one of which entitles the contractor to an extension of time as a relevant event, the contractor is entitled to a full extension of time. There is nothing in the JCT machinery that permits the extension to be discounted because the contractor was also in culpable delay: the clause asks whether a relevant event caused delay to completion, not whether it was the only cause." },
      { kind: "para", text: "The result is not generosity to contractors. It reflects the structure of the bargain: the employer accepts the risk of the events it has designated as relevant events, and the contractor cannot be held to a completion date that the employer's own acts helped to make unachievable. The Society of Construction Law Delay and Disruption Protocol, 2nd edition (February 2017), adopts the same position at Core Principle 10: concurrent contractor delay should not reduce the extension of time due.⁶" },
      { kind: "authority", name: "Walter Lilly & Company Ltd v Mackay", citation: "[2012] EWHC 1773 (TCC)", court: "Technology and Construction Court, Akenhead J", point: "Where delay is caused by two or more effective causes, one of which is a relevant event, the contractor is entitled to a full extension of time. Apportionment rejected as a matter of English law.", url: "https://caselaw.nationalarchives.gov.uk/ewhc/tcc/2012/1773" },
      { kind: "heading", num: "03", text: "The Scottish contrast", id: "s3" },
      { kind: "para", text: "City Inn Ltd v Shepherd Construction Ltd [2010] CSIH 68 took a different road.³ The Inner House of the Court of Session held, by a majority, that where two causes of delay are concurrent and neither can be identified as dominant, the decision-maker may apportion the delay between them in a fair and reasonable way, treating the exercise as one of judgment rather than strict causation." },
      { kind: "para", text: "City Inn is regularly cited in English adjudications and just as regularly overvalued. It is a Scottish decision, persuasive authority at most, and Akenhead J expressly declined to follow it in Walter Lilly. Apportionment of an extension of time forms no part of English law. A tribunal invited to split a concurrent period sixty-forty on a contract governed by English law is being invited into an exercise the authorities do not sanction, and a responding party should say so plainly." },
      { kind: "authority", name: "City Inn Ltd v Shepherd Construction Ltd", citation: "[2010] CSIH 68", court: "Inner House, Court of Session", point: "Where neither concurrent cause is dominant, delay may be apportioned between them on a fair and reasonable basis. A Scottish decision, expressly not followed in Walter Lilly; it does not represent English law.", url: "https://www.bailii.org/scot/cases/ScotCS/2010/2010CSIH68.html" },
      { kind: "heading", num: "04", text: "Money answers a different question", id: "s4" },
      { kind: "para", text: "The extension of time protects the contractor from liquidated damages. It does not carry loss and expense with it. De Beers UK Ltd v Atos Origin IT Services UK Ltd [2010] EWHC 3276 (TCC) states the general rule: where there is concurrent delay to completion caused by matters for which both employer and contractor are responsible, the contractor is entitled to an extension of time but cannot recover in respect of the loss caused by the delay.⁴" },
      { kind: "para", text: "The logic is straightforward causation. Loss and expense must be proved to have been caused by the employer event. If the contractor would have been on site for the same period in any event because of its own delay, the but-for test fails and the time-related loss is irrecoverable. Core Principle 14 of the SCL Protocol draws the same line: the contractor recovers compensation for a concurrent period only if it can separate the additional costs caused by the employer delay from those caused by its own.⁶ Untangling the compensable delay is not a pleading exercise; it is a records exercise, and it must be done head of loss by head of loss." },
      { kind: "pull", text: "The contractor keeps the time. It does not, without more, get the money." },
      { kind: "authority", name: "De Beers UK Ltd v Atos Origin IT Services UK Ltd", citation: "[2010] EWHC 3276 (TCC)", court: "Technology and Construction Court, Edwards-Stuart J", point: "The general rule for concurrent delay: extension of time yes, recovery of delay loss no. Compensation requires the contractor to separate the loss caused by the employer event from loss it would have suffered in any event.", url: "https://caselaw.nationalarchives.gov.uk/ewhc/tcc/2010/3276" },
      { kind: "heading", num: "05", text: "The parties can contract out", id: "s5" },
      { kind: "para", text: "All of the above is the default position, and North Midland Building Ltd v Cyden Homes Ltd [2018] EWCA Civ 1744 confirmed that it is no more than that.⁵ The contract, a JCT Design and Build form with bespoke amendments, provided that any delay caused by a relevant event which was concurrent with a delay for which the contractor was responsible would not be taken into account in assessing the extension of time. The contractor argued that the prevention principle rendered the clause ineffective. Coulson LJ disagreed: the clause was “crystal clear”, the parties were free to allocate the risk of concurrent delay as they wished, and the prevention principle is not an overriding rule of public or legal policy capable of defeating express terms." },
      { kind: "para", text: "The practical consequence is that concurrency is now as much a drafting question as a legal one. Bespoke amendments to JCT and NEC forms routinely shift concurrency risk to the contractor, and some define concurrency so loosely that they capture delay which is merely sequential. The first task in any concurrency dispute is therefore not Walter Lilly but the contract itself: establish what the clause says, whether it adopts or displaces the default position, and how it defines the concurrency it purports to exclude." },
      { kind: "authority", name: "North Midland Building Ltd v Cyden Homes Ltd", citation: "[2018] EWCA Civ 1744", court: "Court of Appeal, Coulson LJ", point: "Concurrency allocation clauses are valid. The prevention principle does not override express terms; the parties may agree whatever allocation of concurrent delay risk they wish.", url: "https://caselaw.nationalarchives.gov.uk/ewca/civ/2018/1744" },
      { kind: "para", text: "Wherever the contractual line falls, the dispute is decided on the records. Concurrency arguments collapse or succeed on the quality of the as-built evidence and the causal analysis built on it, and the party that can demonstrate what was actually driving completion, week by week, usually prevails." },
      { kind: "list", title: "What the records must show", items: [
        "The as-built sequence of the works, assembled from contemporaneous progress records rather than reconstructed programme logic.",
        "Which activities were driving completion when each delay event took effect, not which were critical at contract award.",
        "The start, duration and effect of each employer event, tied to instructions, correspondence and site diaries.",
        "The contractor's own delay, recorded with the same candour; an analysis that conceals it will not survive scrutiny.",
        "Cost records granular enough to separate time-related loss caused by the employer event from loss that would have been incurred in any event.",
      ] },
      { kind: "view", paragraphs: [
        "Concurrency is argued as a point of law and decided as a question of fact. The doctrine occupies a few paragraphs; the evidence that proves or destroys true concurrency runs to thousands of documents: programmes, progress updates, site diaries, labour returns and correspondence. Most concurrency arguments fail not because Walter Lilly was misread but because the as-built record was never assembled with the discipline the causation exercise demands.",
        "Meritus Via structures that evidence base at machine speed: programme data, progress records and correspondence ingested and mapped within hours of instruction, every conclusion traceable to source and every method disclosable. The causal analysis and the opinion remain where they belong, with senior practitioners, partner-led from first instruction through to testimony. We automate the preparation. Never the judgment.",
      ] },
    ],
    references: [
      { id: "1", text: "Henry Boot Construction (UK) Ltd v Malmaison Hotel (Manchester) Ltd (1999) 70 Con LR 32 (TCC, Dyson J)." },
      { id: "2", text: "Walter Lilly & Company Ltd v Mackay [2012] EWHC 1773 (TCC), Akenhead J at [370].", url: "https://caselaw.nationalarchives.gov.uk/ewhc/tcc/2012/1773" },
      { id: "3", text: "City Inn Ltd v Shepherd Construction Ltd [2010] CSIH 68 (Inner House, Court of Session).", url: "https://www.bailii.org/scot/cases/ScotCS/2010/2010CSIH68.html" },
      { id: "4", text: "De Beers UK Ltd v Atos Origin IT Services UK Ltd [2010] EWHC 3276 (TCC), Edwards-Stuart J.", url: "https://caselaw.nationalarchives.gov.uk/ewhc/tcc/2010/3276" },
      { id: "5", text: "North Midland Building Ltd v Cyden Homes Ltd [2018] EWCA Civ 1744, Coulson LJ.", url: "https://caselaw.nationalarchives.gov.uk/ewca/civ/2018/1744" },
      { id: "6", text: "Society of Construction Law, Delay and Disruption Protocol, 2nd edition (February 2017), Core Principles 10 and 14.", url: "https://www.scl.org.uk/resources/delay-disruption-protocol" },
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
