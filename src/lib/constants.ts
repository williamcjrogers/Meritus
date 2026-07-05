export const SITE_CONFIG = {
  name: "Meritus Via",
  tagline: "Expertise. Evolved.",
  secondaryTagline: "Built on merit.",
  legalTagline: "Built on merit.",
  description:
    "Senior-led construction disputes advisory. Forensic delay analysis, quantum, technical expert, and advisory services for high-value disputes.",
  url: "https://meritusvia.com",
  email: "enquiries@meritusvia.com",
  linkedin: "https://www.linkedin.com/company/meritusvia/about/",
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
      { label: "Technology", href: "/services#technology", desc: "The platforms we build in-house" },
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
      { label: "All Insights", href: "/insights", desc: "The full briefing archive" },
      { label: "Proving Disruption", href: "/insights/proving-disruption-claims", desc: "Evidencing productivity loss" },
      { label: "Smash-and-Grab v True Value", href: "/insights/smash-and-grab-true-value", desc: "Payment notices and cash flow" },
      { label: "Expert Independence", href: "/insights/expert-witness-independence", desc: "Duties, credibility, admissibility" },
    ],
  },
];

/* Section-specific content for the right rail of the header mega menu.
   Keyed by NAV_ITEMS label. The Insights rail additionally surfaces the
   latest briefing from INSIGHT_ARTICLES. */
export interface NavPanelInfo {
  eyebrow: string;
  body: string;
  linkLabel: string;
  stat?: { value: string; label: string };
  quote?: string;
}

export const NAV_PANEL_INFO: Record<string, NavPanelInfo> = {
  Services: {
    eyebrow: "The practice",
    body: "Senior-led advisory across delay, quantum, technical, and strategy, with platforms we build in-house. Five disciplines around one evidence base.",
    linkLabel: "Explore services",
    stat: { value: "05", label: "Disciplines. One evidence base." },
  },
  Sectors: {
    eyebrow: "Where we work",
    body: "From residential towers to rail, water, and generation: forensic experience across the full breadth of the built environment.",
    linkLabel: "View sectors",
    stat: { value: "03", label: "Sectors. One forensic discipline." },
  },
  Method: {
    eyebrow: "The principle",
    body: "Every output traceable, disclosable, and reviewed by a partner before it carries the firm's name.",
    linkLabel: "Read the method",
    quote: "We automate the preparation. Never the judgment.",
  },
  Insights: {
    eyebrow: "Current thinking",
    body: "Analysis of recent case law, statutory change, and the commercial realities of modern adjudication.",
    linkLabel: "All insights",
  },
};

export const FOOTER_NAV = {
  main: [
    { label: "Services", href: "/services" },
    { label: "Sectors", href: "/sectors" },
    { label: "Method", href: "/method" },
    { label: "Insights", href: "/insights" },
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
  {
    title: "Technology",
    output:
      "In-house platforms. Evidence intelligence. Sourced chronologies. Live deadline engines. 100GB structured in hours.",
    href: "/services#technology",
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
  {
    slug: "proving-disruption-claims",
    title:
      "Proving Disruption: The Hardest Claim in the Final Account",
    date: "May 2026",
    isoDate: "2026-05-14",
    readTime: "7 min",
    excerpt:
      "Disruption is pleaded in almost every major final account and proved in almost none. The difference between assertion and evidence decides where these claims land.",
    category: "The Measure",
    href: "/insights/proving-disruption-claims",
  },
  {
    slug: "smash-and-grab-true-value",
    title:
      "Smash-and-Grab, True Value, and the Price of a Missed Notice",
    date: "June 2026",
    isoDate: "2026-06-11",
    readTime: "6 min",
    excerpt:
      "Eight years after Grove, the payment battleground has a settled shape: the notified sum rules, and the true-value counterpunch waits behind it.",
    category: "The Ledger",
    href: "/insights/smash-and-grab-true-value",
  },
  {
    slug: "expert-witness-independence",
    title:
      "Independence on Trial: What the TCC Now Expects of Experts",
    date: "July 2026",
    isoDate: "2026-07-02",
    readTime: "7 min",
    excerpt:
      "The courts have moved from criticising partisan experts to excluding their evidence altogether. Independence is now an admissibility threshold, not professional etiquette.",
    category: "The Duty",
    href: "/insights/expert-witness-independence",
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
