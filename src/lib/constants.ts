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

export const NAV_ITEMS = [
  { label: "Services", href: "/services" },
  { label: "Sectors", href: "/sectors" },
  { label: "Method", href: "/method" },
  { label: "Insights", href: "/insights" },
] as const;

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
    date: "February 2026",
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
    date: "February 2026",
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
