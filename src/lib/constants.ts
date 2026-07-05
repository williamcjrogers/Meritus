export const SITE_CONFIG = {
  name: "Meritus Via",
  tagline: "Expertise. Evolved.",
  secondaryTagline: "Built on merit.",
  legalTagline: "Built on merit.",
  description:
    "Senior-led construction disputes advisory. Forensic delay analysis, quantum, technical expert, and advisory services for high-value disputes.",
  url: "https://meritusvia.com",
  email: "enquiries@meritusvia.com",
  linkedin: "https://linkedin.com/company/meritus-via",
  legalName: "Meritus Via LLP",
  copyright: `\u00a9 ${new Date().getFullYear()} Meritus Via. All rights reserved.`,
  legalFooter:
    "Meritus Via is a trading name of Meritus Via LLP.",
} as const;

export interface NavChild {
  label: string;
  href: string;
  desc?: string;
  divider?: boolean;
}

export interface NavItem {
  label: string;
  href: string;
  children?: readonly NavChild[];
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    label: "Services",
    href: "/services",
    children: [
      { label: "Delay", href: "/services#delay", desc: "Forensic programme analysis" },
      { label: "Quantum", href: "/services#quantum", desc: "Valuation and damages assessment" },
      { label: "Technical", href: "/services#technical", desc: "Defects, design, and causation" },
      { label: "Advisory", href: "/services#advisory", desc: "Strategy and adjudication support" },
      { label: "Technology", href: "/services#technology", desc: "The platforms we build in-house", divider: true },
    ],
  },
  {
    label: "Sectors",
    href: "/sectors",
    children: [
      { label: "Buildings", href: "/sectors#buildings", desc: "Residential, commercial, healthcare" },
      { label: "Infrastructure", href: "/sectors#infrastructure", desc: "Rail, highways, water, tunnelling" },
      { label: "Energy", href: "/sectors#energy", desc: "Generation, renewables, industrial" },
    ],
  },
  {
    label: "Method",
    href: "/method",
    children: [
      { label: "The Principle", href: "/method#principle", desc: "Preparation automated, judgment human" },
      { label: "Capabilities", href: "/method#capabilities", desc: "Evidence structuring to testimony" },
      { label: "Governance", href: "/method#governance", desc: "Traceable, disclosable, reviewed" },
    ],
  },
  {
    label: "Insights",
    href: "/insights",
    children: [
      { label: "All Insights", href: "/insights" },
      { label: "Delay Analysis in Adjudications", href: "/insights/delay-analysis-adjudications", divider: true },
      { label: "The Building Safety Act", href: "/insights/building-safety-act-remediation" },
      { label: "AI in Construction Disputes", href: "/insights/ai-in-construction-disputes" },
    ],
  },
];

export const FOOTER_NAV = {
  main: [
    { label: "Services", href: "/services" },
    { label: "Sectors", href: "/sectors" },
    { label: "Method", href: "/method" },
    { label: "Insights", href: "/insights" },
    { label: "Contact", href: "/contact" },
    { label: "Claims Intelligence", href: "/claims-intelligence" },
  ],
  legal: [
    { label: "Privacy", href: "/privacy-policy" },
    { label: "Terms", href: "/terms" },
    { label: "Accessibility", href: "/accessibility" },
  ],
} as const;

export const CREDIBILITY_LINE = "Partner-led · Independent · High-value disputes" as const;

export const SERVICE_PILLARS = [
  {
    title: "Delay",
    output:
      "Forensic retrospective analysis. Windows analysis. TIA. Narratives that survive cross-examination.",
    href: "/services#delay",
  },
  {
    title: "Quantum",
    output:
      "Commercial valuation. Damages assessment. Prolongation. Final account defence.",
    href: "/services#quantum",
  },
  {
    title: "Technical",
    output:
      "Engineering intelligence. Root cause analysis. Defect causation. Building Safety Act remediation.",
    href: "/services#technical",
  },
  {
    title: "Advisory",
    output:
      "Strategy, merits assessment, adjudication support, and rapid evidence structuring.",
    href: "/services#advisory",
  },
] as const;

export const INSIGHT_ARTICLES = [
  {
    slug: "delay-analysis-adjudications",
    title:
      "Why Traditional Delay Analysis Fails in 28-Day Adjudications",
    date: "February 2026",
    isoDate: "2026-02-15",
    readTime: "6 min",
    excerpt:
      "The standard approach to forensic programme analysis was designed for litigation timescales. Adjudication demands a fundamentally different discipline.",
    category: "The Trap",
    href: "/insights/delay-analysis-adjudications",
  },
  {
    slug: "building-safety-act-remediation",
    title:
      "The Building Safety Act: The New Frontier of Remediation Claims",
    date: "March 2026",
    isoDate: "2026-03-12",
    readTime: "8 min",
    excerpt:
      "Multi-party liability, complex causation, and extended limitation periods are creating a distinct class of construction dispute.",
    category: "The Shift",
    href: "/insights/building-safety-act-remediation",
  },
  {
    slug: "ai-in-construction-disputes",
    title:
      "Beyond the Hype: What AI Actually Looks Like in a Dispute",
    date: "April 2026",
    isoDate: "2026-04-09",
    readTime: "5 min",
    excerpt:
      "The gap between what technology companies promise and what practitioners need is substantial. Here is what actually works.",
    category: "The Tech",
    href: "/insights/ai-in-construction-disputes",
  },
] as const;

export const CONTACT_FORM_OPTIONS = {
  disputeNature: [
    "Extension of time / delay dispute",
    "Quantum / final account dispute",
    "Technical / defects dispute",
    "Adjudication (referral or response)",
    "Expert appointment (party or tribunal)",
    "Building Safety Act remediation",
    "General advisory",
    "Credentials request",
  ],
  approximateValue: [
    "Under \u00a31m",
    "\u00a31m \u2013 \u00a35m",
    "\u00a35m \u2013 \u00a320m",
    "\u00a320m \u2013 \u00a3100m",
    "Over \u00a3100m",
    "Not yet quantified",
  ],
  forum: [
    "Adjudication",
    "Arbitration",
    "Litigation",
    "Mediation",
    "Not yet determined",
  ],
} as const;
