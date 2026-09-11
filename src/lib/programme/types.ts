/**
 * Programme schedule, ingest issues, and block-analysis report types.
 * Figures in a report always cite a block on the engine so a reader can
 * trace a number back to the calculation that produced it.
 */

export const ENGINE_ID = "meritus_block_v1";

export const PROGRAMME_FORMATS = [
  "asta_pp",
  "asta_xml",
  "msp_xml",
  "p6_xer",
  "csv",
  "json",
  "pdf",
  "unknown",
] as const;
export type ProgrammeFormat = (typeof PROGRAMME_FORMATS)[number];

export const PARSE_STATUSES = ["parsed", "partial", "failed", "empty"] as const;
export type ParseStatus = (typeof PARSE_STATUSES)[number];

export const LINK_TYPES = ["FS", "SS", "FF", "SF"] as const;
export type LinkType = (typeof LINK_TYPES)[number];

export const DELAY_METHODS = [
  "as_planned_vs_as_built",
  "windows",
  "tia",
  "cab",
  "planned_network",
  "health_only",
  "not_selected",
] as const;
export type DelayMethod = (typeof DELAY_METHODS)[number];

export const PROGRAMME_TYPES = ["baseline", "interim", "as_built", "unknown"] as const;
export type ProgrammeType = (typeof PROGRAMME_TYPES)[number];

export const ISSUE_SEVERITIES = ["low", "medium", "high"] as const;
export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number];

export const EVIDENCE_GRADES = ["native_schedule", "structured_export", "markup_only", "none"] as const;
export type EvidenceGrade = (typeof EVIDENCE_GRADES)[number];

export type ProgrammeIssue = {
  code: string;
  severity: IssueSeverity;
  title: string;
  detail: string;
};

export type Calendar = {
  id: string;
  name: string;
  workingDays: number[];
};

export type Activity = {
  id: string;
  name: string;
  wbs?: string;
  calendarId?: string;
  start?: string;
  finish?: string;
  actualStart?: string;
  actualFinish?: string;
  durationDays?: number;
  totalFloatDays?: number;
  freeFloatDays?: number;
  percentComplete?: number;
  milestone?: boolean;
  suppliedCritical?: boolean;
  type?: string;
};

export type LogicLink = {
  predecessorId: string;
  successorId: string;
  type: LinkType;
  lagDays: number;
};

export type Schedule = {
  name: string;
  format: ProgrammeFormat;
  programmeType: ProgrammeType;
  evidence: EvidenceGrade;
  dataDate?: string;
  projectStart?: string;
  projectFinish?: string;
  activities: Activity[];
  links: LogicLink[];
  calendars: Calendar[];
  impactEvents: string[];
};

export type ParseResult = {
  status: ParseStatus;
  engine: string;
  confidence: number;
  format: ProgrammeFormat;
  schedule: Schedule;
  issues: ProgrammeIssue[];
};

export type HygieneMetrics = {
  totalActivities: number;
  datedActivities: number;
  actualDatedActivities: number;
  milestones: number;
  links: number;
  calendars: number;
  duplicateIds: number;
  missingIds: number;
  reverseDateActivities: number;
  zeroDurationNonMilestone: number;
  veryLongActivities: number;
  negativeFloat: number;
  openStarts: number;
  suppliedCritical: number;
};

export type CriticalPathResult = {
  computed: boolean;
  reason: string;
  criticalIds: string[];
  negativeFloatIds: string[];
  totalFloatById: Record<string, number>;
};

export type MethodDecision = {
  selected: DelayMethod;
  alternativesConsidered: DelayMethod[];
  criteria: string[];
  assumptions: string[];
  limitations: string[];
};

export type CitedFigure = {
  id: string;
  label: string;
  value: number | string;
  unit: string | null;
  blockId: string;
  basis: string;
};

export type ReportFence = {
  id: string;
  title: string;
  text: string;
};

export type ReportBlock = {
  id: string;
  title: string;
  findings: string[];
};

export type ReportProgress = {
  stage: string;
  percent: number;
};

export type ProgrammeReport = {
  engine: typeof ENGINE_ID;
  generatedAt: string;
  cacheKey: string;
  parse: {
    status: ParseStatus;
    confidence: number;
    engine: string;
    format: ProgrammeFormat;
  };
  method: MethodDecision;
  fences: ReportFence[];
  health: {
    score: number;
    level: "good" | "fair" | "poor" | "empty";
    metrics: HygieneMetrics;
  };
  criticalPath: CriticalPathResult;
  figures: CitedFigure[];
  blocks: ReportBlock[];
  progress: ReportProgress;
};

export function assertNever(value: never, message: string): never {
  throw new Error(message);
}
