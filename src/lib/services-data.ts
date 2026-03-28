export interface ServicePage {
  slug: string;
  title: string;
  heroStatement: string;
  challenge: string;
  deliverables: string[];
  methodology: { step: string; description: string }[];
  technologyHelps: string;
  typicalMatters: string[];
  metaTitle: string;
  metaDescription: string;
}

export const SERVICES: ServicePage[] = [
  {
    slug: "delay",
    title: "Delay",
    heroStatement:
      "Forensic programme analysis by practitioners who have analysed delays on the UK\u2019s most complex infrastructure programmes.",
    challenge:
      "Programme disputes are rarely straightforward. Competing delay narratives, incomplete records, concurrent causes, and evolving programmes create a forensic challenge that demands both technical depth and analytical rigour. The quality of the delay analysis often determines the outcome.",
    deliverables: [
      "Contemporaneous delay analysis using the appropriate methodology for the dispute",
      "Time Impact Analysis (TIA)",
      "Windows Analysis",
      "As-Planned vs As-Built",
      "Collapsed As-Built",
      "Critical path identification and narrative",
      "NEC3/NEC4 compensation event assessment",
      "Expert reports (CPR Part 35 compliant)",
      "Adjudication-ready exhibits and submission support",
      "Primavera P6, Asta Powerproject, Microsoft Project analysis",
    ],
    methodology: [
      {
        step: "Scope and understand",
        description:
          "Partner-led review of the programme, records, and dispute context. We identify the right methodology before we start analysis, not after.",
      },
      {
        step: "Ingest and classify",
        description:
          "Proprietary document review technology accelerates the identification of relevant correspondence, instructions, and delay events across large document sets.",
      },
      {
        step: "Analyse",
        description:
          "Forensic programme analysis combining expert judgment with technology-assisted pattern identification. Every conclusion traceable to source.",
      },
      {
        step: "Deliver",
        description:
          "Clear, defensible expert reports. Exhibit packs structured for adjudication, arbitration, or litigation. Testimony-ready positions.",
      },
    ],
    technologyHelps:
      "Our proprietary tools accelerate document ingestion and correspondence classification, tasks that traditionally consume weeks of analyst time. This means our experts spend more time on judgment and less time on mechanics. The result is faster delivery without compromising depth.",
    typicalMatters: [
      "Major rail infrastructure programme, delay and disruption analysis across a 5-year programme with multiple interfaces and concurrent causes",
      "Highway improvement scheme, NEC4 compensation event assessment and time impact analysis for a multi-party dispute",
      "Mixed-use development, contractor\u2019s extension of time claim and employer\u2019s counterclaim for liquidated damages",
    ],
    metaTitle: "Delay Analysis Expert UK | Meritus Via",
    metaDescription:
      "Forensic programme analysis and delay expert services. Time Impact Analysis, Windows Analysis, NEC delay assessment. Senior-led, technology-augmented.",
  },
  {
    slug: "quantum",
    title: "Quantum & Valuation",
    heroStatement:
      "Rigorous financial analysis of construction claims, from final account disputes to multi-million-pound prolongation and disruption claims.",
    challenge:
      "Quantum disputes require more than arithmetic. Defensible quantification demands an understanding of how costs actually behave on construction projects, the relationship between programme delay and financial consequence, the distinction between genuine loss and contractual entitlement, and the forensic skill to unpick inflated or poorly substantiated claims.",
    deliverables: [
      "Claim valuation and damages assessment",
      "Final account preparation and defence",
      "Prolongation cost analysis (site and head office overheads)",
      "Disruption and loss of productivity assessment",
      "Variation valuation disputes",
      "Measured works disputes",
      "Forensic cost modelling",
      "Critique of opposing quantum positions",
      "Expert reports (CPR Part 35 compliant)",
    ],
    methodology: [
      {
        step: "Assess the landscape",
        description:
          "Understand the contractual basis, the factual matrix, and the quantum in dispute. Identify where the real value lies, and where the weaknesses are.",
      },
      {
        step: "Build the model",
        description:
          "Forensic financial analysis grounded in contemporaneous records, cost data, and programme information. Every figure sourced and auditable.",
      },
      {
        step: "Test and refine",
        description:
          "Internal peer review. Stress-test assumptions. Anticipate the opposing position.",
      },
      {
        step: "Deliver",
        description:
          "Clear quantum reports with transparent methodology. Supporting schedules and appendices structured for the dispute forum.",
      },
    ],
    technologyHelps:
      "Document classification and cost record analysis benefit significantly from technology-assisted review, particularly on large instructions where thousands of invoices, applications, and valuations need systematic treatment. Our tools bring structure and speed to this process.",
    typicalMatters: [
      "Complex M&E subcontract, final account dispute involving extensive measured works, variations, and prolongation across multiple building phases",
      "Infrastructure programme, contractor\u2019s prolongation and disruption claim exceeding \u00a320m, requiring forensic analysis of preliminaries, labour productivity, and head office overheads",
      "Commercial development, employer\u2019s defence of an inflated loss and expense claim, including critique of opposing expert\u2019s methodology",
    ],
    metaTitle: "Quantum Expert Construction UK | Meritus Via",
    metaDescription:
      "Construction claims valuation and quantum expert services. Prolongation, disruption, final account disputes. Defensible quantification by senior practitioners.",
  },
  {
    slug: "technical",
    title: "Technical",
    heroStatement:
      "Independent technical expertise across building defects, design issues, and complex engineering disputes.",
    challenge:
      "Technical disputes require experts who understand both the engineering and the law. Causation, design liability, specification compliance, and defect analysis demand precise technical opinion, not generic commentary. Building Safety Act remediation has added an entirely new dimension of complexity.",
    deliverables: [
      "Defect investigation and causation analysis",
      "Design liability assessment",
      "Building safety and cladding remediation claims",
      "Fire safety compliance review",
      "Specification and standard compliance assessment",
      "Interface and coordination failure analysis",
      "Technical evidence packs for adjudication, arbitration, and litigation",
      "Expert reports (CPR Part 35 compliant)",
    ],
    methodology: [
      {
        step: "Investigate",
        description:
          "Site inspection, document review, and technical assessment. Understand what happened and why, not just what went wrong.",
      },
      {
        step: "Establish causation",
        description:
          "Rigorous cause-and-effect analysis. Distinguish between design failure, workmanship deficiency, specification ambiguity, and supervision gaps.",
      },
      {
        step: "Quantify consequence",
        description:
          "Work with quantum specialists (internally) to link technical findings to financial impact.",
      },
      {
        step: "Report",
        description:
          "Independent technical opinion that stands up to cross-examination.",
      },
    ],
    technologyHelps:
      "Large-scale defect and remediation disputes generate extensive technical documentation, survey reports, test results, specification references, correspondence. Our document review tools bring structure to this volume, allowing our experts to focus on the technical judgment that matters.",
    typicalMatters: [
      "High-rise residential, cladding and fire safety remediation claim under the Building Safety Act, involving multiple responsible parties and complex causation",
      "Commercial office development, curtain walling defect investigation and design liability assessment",
      "Industrial facility, MEP system performance failure, requiring forensic analysis of design, installation, and commissioning records",
    ],
    metaTitle: "Construction Technical Expert UK | Meritus Via",
    metaDescription:
      "Independent technical expertise for building defects, design liability, and Building Safety Act claims. Forensic causation analysis by senior practitioners.",
  },
  {
    slug: "advisory",
    title: "Advisory",
    heroStatement:
      "Strategic advisory for adjudication, arbitration, and litigation, built for the pace that construction disputes demand.",
    challenge:
      "Construction disputes operate on timelines that most professional services aren\u2019t designed for. A 28-day adjudication referral doesn\u2019t wait for committee approvals, internal resource allocation, or junior staff familiarisation. You need senior expertise mobilised immediately, with the discipline and structure to deliver under pressure.",
    deliverables: [
      "Adjudication strategy and merits assessment",
      "Referral and response drafting support (working alongside solicitors)",
      "Evidence architecture: document control, chronology, exhibit structuring",
      "Expert report preparation (CPR Part 35 compliant)",
      "Party-appointed and tribunal-appointed expert roles",
      "Arbitration and litigation support",
      "Expert witness testimony preparation and cross-examination readiness",
      "Decision enforcement support",
    ],
    methodology: [
      {
        step: "Assess the position",
        description:
          "Rapid merits review, where are you strong, where are you exposed, and what evidence do you need?",
      },
      {
        step: "Structure the case",
        description:
          "Evidence architecture, document control, and submission planning. We bring order to complexity.",
      },
      {
        step: "Deliver under pressure",
        description:
          "Partner-led, daily cadence during active adjudications. Direct access. No chasing.",
      },
      {
        step: "Stand behind it",
        description:
          "Our experts give evidence that withstands cross-examination. Testimony-ready from the outset, not as an afterthought.",
      },
    ],
    technologyHelps:
      "The 28-day timeline rewards preparation speed. Our document ingestion and classification tools mean we spend less time organising records and more time building the case. On larger instructions, this advantage compounds, weeks of document review compressed to days.",
    typicalMatters: [
      "Complex multi-party adjudication, simultaneous referral and response management across delay, quantum, and technical issues",
      "High Court enforcement, supporting solicitors on adjudication decision enforcement and jurisdictional challenge defence",
      "International arbitration, quantum and delay expert reports for ICC proceedings on an infrastructure programme",
    ],
    metaTitle: "Adjudication Advisory Services UK | Meritus Via",
    metaDescription:
      "Construction adjudication support, expert reporting, and dispute resolution advisory. 28-day adjudication specialists. Senior-led, responsive, structured.",
  },
];

export const SERVICES_HUB = [
  {
    title: "Delay",
    description:
      "Forensic programme analysis by practitioners who have worked on the UK\u2019s most complex infrastructure programmes. Time Impact Analysis, Windows, As-Planned vs As-Built, and NEC compensation event assessment.",
    href: "/services/delay-analysis",
  },
  {
    title: "Quantum",
    description:
      "Rigorous financial analysis, from final account disputes to multi-million-pound prolongation and disruption claims. Defensible quantification that withstands scrutiny.",
    href: "/services/quantum",
  },
  {
    title: "Technical",
    description:
      "Independent technical expertise across building defects, design liability, specification compliance, and complex engineering causation. Building Safety Act claims.",
    href: "/services/technical-advisory",
  },
  {
    title: "Advisory",
    description:
      "Strategic advisory built for the pace that construction disputes demand. 28-day adjudication support, expert reporting, testimony, and dispute resolution strategy.",
    href: "/services/adjudication-advisory",
  },
];
