/**
 * Block analysis engine. Every figure cites a block id. Method choice follows
 * the records that are present (SCL Protocol 2nd Ed: no single preferred method).
 * The engine does not invent float or a critical path from PDF mark-up, and it
 * does not convert EOT days into money.
 */

import { createHash } from "node:crypto";
import type {
  Activity,
  CitedFigure,
  CriticalPathResult,
  DelayMethod,
  HygieneMetrics,
  LogicLink,
  MethodDecision,
  ParseResult,
  ProgrammeReport,
  ReportBlock,
  ReportFence,
  Schedule,
} from "./types";
import { assertNever, ENGINE_ID } from "./types";

export const REPORT_BUDGET_MS = 8_000;
export const MAX_NETWORK_ACTIVITIES = 25_000;

const METHOD_LABELS: Record<DelayMethod, string> = {
  as_planned_vs_as_built: "As-planned versus as-built",
  windows: "Windows analysis",
  tia: "Time impact analysis",
  cab: "Collapsed as-built",
  planned_network: "Planned network (no as-built)",
  health_only: "Programme health only",
  not_selected: "No delay method selected",
};

export function cacheKeyFor(parse: ParseResult): string {
  return createHash("sha256")
    .update(ENGINE_ID)
    .update("\n")
    .update(JSON.stringify(canonicalSchedule(parse.schedule)))
    .update("\n")
    .update(parse.status)
    .update(parse.engine)
    .digest("hex");
}

export function analyseProgramme(parse: ParseResult, now = new Date(), budgetMs = REPORT_BUDGET_MS): ProgrammeReport {
  const started = Date.now();
  const timedOut = () => Date.now() - started > budgetMs;
  const schedule = parse.schedule;
  const metrics = hygiene(schedule);
  const method = selectMethod(parse, metrics);
  const criticalPath = timedOut()
    ? skippedPath("Analysis budget exhausted before the network pass.")
    : computeCriticalPath(parse, metrics);
  const health = scoreHealth(parse, metrics);
  const fences = buildFences(parse, method);
  const figures = buildFigures(parse, metrics, criticalPath, health.score, method);
  const blocks = buildBlocks(parse, metrics, criticalPath, method);
  return {
    engine: ENGINE_ID,
    generatedAt: now.toISOString(),
    cacheKey: cacheKeyFor(parse),
    parse: {
      status: parse.status,
      confidence: parse.confidence,
      engine: parse.engine,
      format: parse.format,
    },
    method,
    fences,
    health,
    criticalPath,
    figures,
    blocks,
    progress: { stage: "complete", percent: 100 },
  };
}

export function selectMethod(parse: ParseResult, metrics: HygieneMetrics = hygiene(parse.schedule)): MethodDecision {
  const schedule = parse.schedule;
  const alternatives: DelayMethod[] = ["as_planned_vs_as_built", "windows", "tia", "cab", "planned_network", "health_only"];
  const criteria: string[] = [
    "SCL Delay and Disruption Protocol (2nd Edition, 2017): no single methodology is preferred; the method must fit the records and the forum.",
    "Meritus practice (delay-analysis-adjudications): choose the method the contemporaneous programmes will actually support; do not compress a method the files cannot carry.",
  ];
  const assumptions: string[] = [];
  const limitations: string[] = [];

  if (schedule.evidence === "markup_only" || parse.format === "pdf") {
    limitations.push("PDF / Gantt mark-up is not schedule evidence. Critical path and float are refused.");
    return decision("not_selected", alternatives, criteria, assumptions, limitations);
  }
  if (parse.format === "asta_pp") {
    limitations.push(
      "The Asta .pp container was recognised but activity rows were not extracted. Export XML or CSV from Powerproject for activity-level analysis."
    );
    return decision("not_selected", alternatives, criteria, assumptions, limitations);
  }
  if (parse.status === "failed" || parse.status === "empty" || metrics.totalActivities === 0 || schedule.evidence === "none") {
    limitations.push("No activity-level schedule was mapped, so no delay method can be selected.");
    return decision("not_selected", alternatives, criteria, assumptions, limitations);
  }

  const hasLogic = metrics.links > 0;
  const hasPlanned = metrics.datedActivities > 0;
  const hasActual = metrics.actualDatedActivities > 0;
  const hasWindows = Boolean(schedule.dataDate) && hasActual && hasPlanned;
  const hasImpacts = schedule.impactEvents.length > 0;
  const asBuiltShare = metrics.totalActivities ? metrics.actualDatedActivities / metrics.totalActivities : 0;

  criteria.push(
    `Records: ${metrics.totalActivities} activities, ${metrics.links} links, ${metrics.datedActivities} planned dates, ${metrics.actualDatedActivities} actual dates, ${schedule.impactEvents.length} impact events.`
  );

  if (!hasLogic) {
    assumptions.push("Dates are compared without network logic. A computed critical path is not available.");
  } else {
    assumptions.push("Working time uses the mapped calendar where present; otherwise a five-day week is assumed.");
  }

  if (hasImpacts && hasLogic && hasPlanned) {
    assumptions.push("Impact events are treated as fragnets for a TIA-style interrogation only where they appear in the file. None are invented.");
    return decision("tia", alternatives, criteria, assumptions, limitations);
  }
  if (hasWindows && hasLogic) {
    assumptions.push(`A data date of ${schedule.dataDate} is treated as a window boundary. Periodisation is not invented beyond dates present on the activities.`);
    return decision("windows", alternatives, criteria, assumptions, limitations);
  }
  if (hasPlanned && hasActual && asBuiltShare >= 0.8 && hasLogic) {
    assumptions.push("Most activities carry actual dates, so a collapsed as-built reading of the network is available. This is a factual reconstruction, not a legal holding.");
    return decision("cab", alternatives, criteria, assumptions, limitations);
  }
  if (hasPlanned && hasActual) {
    assumptions.push("Planned and actual dates are compared where both exist. Variance is not treated as entitlement.");
    if (!hasLogic) limitations.push("Without links, as-planned versus as-built is a date comparison only.");
    return decision("as_planned_vs_as_built", alternatives, criteria, assumptions, limitations);
  }
  if (hasLogic && hasPlanned) {
    limitations.push("As-built dates are absent. The network can be interrogated but delay cannot be quantified against progress.");
    return decision("planned_network", alternatives, criteria, assumptions, limitations);
  }

  limitations.push("The mapped rows are not enough for a named delay method. Health and hygiene only.");
  return decision("health_only", alternatives, criteria, assumptions, limitations);
}

function decision(
  selected: DelayMethod,
  alternatives: DelayMethod[],
  criteria: string[],
  assumptions: string[],
  limitations: string[]
): MethodDecision {
  return {
    selected,
    alternativesConsidered: alternatives.filter((method) => method !== selected),
    criteria,
    assumptions,
    limitations,
  };
}

export function hygiene(schedule: Schedule): HygieneMetrics {
  const ids = schedule.activities.map((activity) => activity.id);
  const unique = new Set(ids);
  const reverse = schedule.activities.filter((activity) => activity.start && activity.finish && activity.start > activity.finish).length;
  const zero = schedule.activities.filter((activity) => !activity.milestone && activity.durationDays === 0).length;
  const long = schedule.activities.filter((activity) => (activity.durationDays ?? 0) > 365).length;
  const known = unique;
  const openStarts = schedule.activities.filter((activity) => !schedule.links.some((link) => link.successorId === activity.id)).length;
  return {
    totalActivities: schedule.activities.length,
    datedActivities: schedule.activities.filter((activity) => activity.start || activity.finish).length,
    actualDatedActivities: schedule.activities.filter((activity) => activity.actualStart || activity.actualFinish).length,
    milestones: schedule.activities.filter((activity) => activity.milestone).length,
    links: schedule.links.length,
    calendars: schedule.calendars.length,
    duplicateIds: ids.length - unique.size,
    missingIds: schedule.links.filter((link) => !known.has(link.predecessorId) || !known.has(link.successorId)).length,
    reverseDateActivities: reverse,
    zeroDurationNonMilestone: zero,
    veryLongActivities: long,
    negativeFloat: schedule.activities.filter((activity) => (activity.totalFloatDays ?? 0) < 0).length,
    openStarts,
    suppliedCritical: schedule.activities.filter((activity) => activity.suppliedCritical).length,
  };
}

export function computeCriticalPath(parse: ParseResult, metrics: HygieneMetrics): CriticalPathResult {
  const schedule = parse.schedule;
  if (schedule.evidence === "markup_only" || parse.format === "pdf") {
    return skippedPath("Critical path is refused: the source is a PDF mark-up, not a schedule.");
  }
  if (metrics.totalActivities === 0) {
    return skippedPath("No activities were mapped.");
  }
  if (metrics.totalActivities > MAX_NETWORK_ACTIVITIES) {
    return skippedPath(`Network exceeds ${MAX_NETWORK_ACTIVITIES} activities; the pass was not run.`);
  }
  if (schedule.links.length === 0) {
    if (metrics.suppliedCritical > 0 && schedule.evidence === "native_schedule") {
      const criticalIds = schedule.activities.filter((activity) => activity.suppliedCritical).map((activity) => activity.id);
      return {
        computed: false,
        reason: "No links. Supplied critical flags from a native schedule are listed but not recomputed.",
        criticalIds,
        negativeFloatIds: [],
        totalFloatById: {},
      };
    }
    return skippedPath("No logic links. Float and a critical path are not invented from bar dates alone.");
  }

  const byId = new Map(schedule.activities.map((activity) => [activity.id, activity]));
  const outgoing = new Map<string, LogicLink[]>();
  const incoming = new Map<string, LogicLink[]>();
  for (const activity of schedule.activities) {
    outgoing.set(activity.id, []);
    incoming.set(activity.id, []);
  }
  for (const link of schedule.links) {
    if (!byId.has(link.predecessorId) || !byId.has(link.successorId)) continue;
    outgoing.get(link.predecessorId)?.push(link);
    incoming.get(link.successorId)?.push(link);
  }

  const order = topo(schedule.activities, outgoing);
  if (!order) {
    return skippedPath("The network contains a cycle; a forward/backward pass was not run.");
  }

  const earlyStart = new Map<string, number>();
  const earlyFinish = new Map<string, number>();
  for (const id of order) {
    const activity = byId.get(id);
    if (!activity) continue;
    const duration = activityDuration(activity);
    const incomingLinks = incoming.get(id) ?? [];
    let es = 0;
    if (incomingLinks.length === 0) {
      es = 0;
    } else {
      es = Math.max(
        0,
        ...incomingLinks.map((link) => constraintEarly(link, earlyStart.get(link.predecessorId) ?? 0, earlyFinish.get(link.predecessorId) ?? 0, duration))
      );
    }
    earlyStart.set(id, es);
    earlyFinish.set(id, es + duration);
  }

  const projectEnd = Math.max(0, ...[...earlyFinish.values()]);
  const lateFinish = new Map<string, number>();
  const lateStart = new Map<string, number>();
  for (const id of [...order].reverse()) {
    const activity = byId.get(id);
    if (!activity) continue;
    const duration = activityDuration(activity);
    const outgoingLinks = outgoing.get(id) ?? [];
    let lf = projectEnd;
    if (outgoingLinks.length > 0) {
      lf = Math.min(
        ...outgoingLinks.map((link) => constraintLate(link, lateStart.get(link.successorId) ?? projectEnd, lateFinish.get(link.successorId) ?? projectEnd, duration))
      );
    }
    lateFinish.set(id, lf);
    lateStart.set(id, lf - duration);
  }

  const totalFloatById: Record<string, number> = {};
  const criticalIds: string[] = [];
  const negativeFloatIds: string[] = [];
  for (const activity of schedule.activities) {
    const tf = (lateStart.get(activity.id) ?? 0) - (earlyStart.get(activity.id) ?? 0);
    totalFloatById[activity.id] = tf;
    if (tf < 0) negativeFloatIds.push(activity.id);
    if (tf <= 0) criticalIds.push(activity.id);
  }

  return {
    computed: true,
    reason: "Forward and backward pass on mapped finish-to-start and related links, using activity durations.",
    criticalIds,
    negativeFloatIds,
    totalFloatById,
  };
}

function activityDuration(activity: Activity): number {
  if (activity.milestone) return 0;
  if (activity.durationDays != null && Number.isFinite(activity.durationDays)) return Math.max(0, activity.durationDays);
  if (activity.start && activity.finish) {
    const days = calendarDays(activity.start, activity.finish);
    return days == null ? 1 : Math.max(0, days);
  }
  return 1;
}

function constraintEarly(link: LogicLink, predEs: number, predEf: number, _succDuration: number): number {
  const lag = link.lagDays;
  switch (link.type) {
    case "FS":
      return predEf + lag;
    case "SS":
      return predEs + lag;
    case "FF":
      return predEf + lag - _succDuration;
    case "SF":
      return predEs + lag - _succDuration;
    default:
      return assertNever(link.type, `Unhandled link type ${String(link.type)}`);
  }
}

function constraintLate(link: LogicLink, succLs: number, succLf: number, predDuration: number): number {
  const lag = link.lagDays;
  switch (link.type) {
    case "FS":
      return succLs - lag;
    case "SS":
      return succLs - lag + predDuration;
    case "FF":
      return succLf - lag;
    case "SF":
      return succLf - lag + predDuration;
    default:
      return assertNever(link.type, `Unhandled link type ${String(link.type)}`);
  }
}

function topo(activities: Activity[], outgoing: Map<string, LogicLink[]>): string[] | null {
  const indegree = new Map<string, number>();
  for (const activity of activities) indegree.set(activity.id, 0);
  for (const links of outgoing.values()) {
    for (const link of links) {
      indegree.set(link.successorId, (indegree.get(link.successorId) ?? 0) + 1);
    }
  }
  const queue = activities.filter((activity) => (indegree.get(activity.id) ?? 0) === 0).map((activity) => activity.id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift();
    if (!id) break;
    order.push(id);
    for (const link of outgoing.get(id) ?? []) {
      const next = (indegree.get(link.successorId) ?? 0) - 1;
      indegree.set(link.successorId, next);
      if (next === 0) queue.push(link.successorId);
    }
  }
  return order.length === activities.length ? order : null;
}

function skippedPath(reason: string): CriticalPathResult {
  return { computed: false, reason, criticalIds: [], negativeFloatIds: [], totalFloatById: {} };
}

function scoreHealth(parse: ParseResult, metrics: HygieneMetrics): ProgrammeReport["health"] {
  if (metrics.totalActivities === 0) {
    return { score: 0, level: "empty", metrics };
  }
  let score = 100;
  score -= metrics.duplicateIds * 8;
  score -= metrics.missingIds * 6;
  score -= metrics.reverseDateActivities * 5;
  score -= Math.min(20, metrics.zeroDurationNonMilestone);
  score -= Math.min(10, metrics.veryLongActivities);
  score -= metrics.negativeFloat * 4;
  if (metrics.links === 0) score -= 15;
  if (parse.status === "partial") score -= 10;
  if (parse.status === "failed") score = Math.min(score, 20);
  score = Math.max(0, Math.min(100, score));
  const level = score >= 80 ? "good" : score >= 60 ? "fair" : "poor";
  return { score, level, metrics };
}

function buildFences(parse: ParseResult, method: MethodDecision): ReportFence[] {
  const fences: ReportFence[] = [
    {
      id: "eot_not_money",
      title: "EOT is not money",
      text: "An extension of time, or a delay in days, is not a loss-and-expense or liquidated-damages figure. SCL Core Principle 4: time entitlement and money entitlement are separate. This report does not convert days into sterling.",
    },
    {
      id: "concurrency_is_fact",
      title: "Concurrency is a question of fact",
      text: "Overlapping critical delay is recorded as a factual observation from the dates and logic that were mapped. It is not a holding on Malmaison, Royal Brompton or Walter Lilly, and it is not a preferred legal test.",
    },
    {
      id: "no_universal_method",
      title: "No universal forensic method",
      text: `Selected method: ${METHOD_LABELS[method.selected]}. The Protocol treats method choice as a function of the records and the dispute, not a hierarchy.`,
    },
  ];
  if (parse.schedule.evidence === "markup_only" || parse.format === "pdf") {
    fences.push({
      id: "no_pdf_critical_path",
      title: "No critical path from mark-up",
      text: "A printed Gantt or PDF mark-up is not used to invent float, a critical path, or delay days.",
    });
  }
  return fences;
}

function buildFigures(
  parse: ParseResult,
  metrics: HygieneMetrics,
  path: CriticalPathResult,
  score: number,
  method: MethodDecision
): CitedFigure[] {
  const plannedVsActual = asPlannedVarianceDays(parse.schedule);
  return [
    figure("fig.health_score", "Health score", score, "points", "blk.hygiene", "100 minus deductions for duplicate ids, reverse dates, missing link ends, missing logic and parse defects."),
    figure("fig.activities", "Activities mapped", metrics.totalActivities, "activities", "blk.hygiene", "Count of activity rows after ingest mapping."),
    figure("fig.critical", "Critical activities", path.criticalIds.length, "activities", "blk.critical_path", path.computed ? "Activities with computed total float ≤ 0." : path.reason),
    figure("fig.milestones", "Milestones", metrics.milestones, "milestones", "blk.hygiene", "Rows marked milestone or zero-duration typed as milestone."),
    figure("fig.links", "Logic links", metrics.links, "links", "blk.network", "Predecessor/successor rows kept after dropping unknown ends."),
    figure("fig.actuals", "Activities with actual dates", metrics.actualDatedActivities, "activities", "blk.as_built", "Rows with actual start or actual finish."),
    figure("fig.method", "Selected method", METHOD_LABELS[method.selected], null, "blk.method", method.criteria[0] ?? "Method selected from available records."),
    figure(
      "fig.planned_vs_actual_finish",
      "Finish variance (as-planned vs as-built)",
      plannedVsActual == null ? "not computed" : plannedVsActual,
      plannedVsActual == null ? null : "calendar days",
      "blk.as_planned_vs_as_built",
      plannedVsActual == null
        ? "Needs a planned finish and an actual finish on at least one activity."
        : "Latest actual finish minus latest planned finish, in calendar days. Not an EOT and not money."
    ),
  ];
}

function figure(id: string, label: string, value: number | string, unit: string | null, blockId: string, basis: string): CitedFigure {
  return { id, label, value, unit, blockId, basis };
}

function asPlannedVarianceDays(schedule: Schedule): number | null {
  const planned = maxIso(schedule.activities.map((activity) => activity.finish));
  const actual = maxIso(schedule.activities.map((activity) => activity.actualFinish));
  if (!planned || !actual) return null;
  return calendarDays(planned, actual);
}

function buildBlocks(
  parse: ParseResult,
  metrics: HygieneMetrics,
  path: CriticalPathResult,
  method: MethodDecision
): ReportBlock[] {
  const issues = parse.issues.map((item) => `${item.title}: ${item.detail}`);
  return [
    {
      id: "blk.method",
      title: "Method and assumptions",
      findings: [
        `Selected: ${METHOD_LABELS[method.selected]}.`,
        ...method.criteria,
        ...method.assumptions.map((line) => `Assumption: ${line}`),
        ...method.limitations.map((line) => `Limitation: ${line}`),
      ],
    },
    {
      id: "blk.hygiene",
      title: "Float and data hygiene",
      findings: [
        `${metrics.totalActivities} activities, ${metrics.datedActivities} with planned dates, ${metrics.actualDatedActivities} with actual dates.`,
        metrics.duplicateIds ? `${metrics.duplicateIds} duplicate id(s).` : "No duplicate ids.",
        metrics.reverseDateActivities ? `${metrics.reverseDateActivities} activity(ies) finish before they start.` : "No reverse dates.",
        metrics.zeroDurationNonMilestone ? `${metrics.zeroDurationNonMilestone} zero-duration non-milestone(s).` : "No zero-duration non-milestones.",
        metrics.veryLongActivities ? `${metrics.veryLongActivities} activity(ies) longer than 365 days.` : "No activities longer than 365 days.",
        ...issues.slice(0, 8),
      ],
    },
    {
      id: "blk.network",
      title: "Network logic",
      findings: [
        `${metrics.links} kept links across ${metrics.calendars} calendar(s).`,
        metrics.missingIds ? `${metrics.missingIds} link(s) pointed at unknown activities.` : "All kept links resolve to mapped activities.",
        `${metrics.openStarts} activit${metrics.openStarts === 1 ? "y has" : "ies have"} no predecessor.`,
      ],
    },
    {
      id: "blk.critical_path",
      title: "Critical path",
      findings: [
        path.reason,
        path.computed
          ? `${path.criticalIds.length} activit${path.criticalIds.length === 1 ? "y is" : "ies are"} critical (total float ≤ 0).`
          : "No computed critical path.",
        path.negativeFloatIds.length ? `${path.negativeFloatIds.length} activit${path.negativeFloatIds.length === 1 ? "y has" : "ies have"} negative float.` : "No negative float on the computed pass.",
      ],
    },
    {
      id: "blk.as_planned_vs_as_built",
      title: "As-planned versus as-built",
      findings: varianceFindings(parse.schedule, method.selected),
    },
    {
      id: "blk.as_built",
      title: "As-built coverage",
      findings: [
        `${metrics.actualDatedActivities} of ${metrics.totalActivities} activities carry actual dates.`,
        parse.schedule.programmeType === "unknown" ? "Programme type was not classified." : `Inferred programme type: ${parse.schedule.programmeType.replace(/_/g, " ")}.`,
      ],
    },
    {
      id: "blk.concurrency",
      title: "Concurrency (factual only)",
      findings: concurrencyFindings(parse.schedule, path),
    },
  ];
}

function varianceFindings(schedule: Schedule, method: DelayMethod): string[] {
  if (method === "not_selected") {
    return ["No as-planned versus as-built comparison: a delay method was not selected."];
  }
  const pairs = schedule.activities.filter((activity) => activity.finish && activity.actualFinish);
  if (pairs.length === 0) {
    return ["No activity has both a planned finish and an actual finish, so finish variance is not computed."];
  }
  const slips = pairs
    .map((activity) => ({ id: activity.id, name: activity.name, days: calendarDays(activity.finish as string, activity.actualFinish as string) ?? 0 }))
    .filter((row) => row.days !== 0)
    .sort((a, b) => Math.abs(b.days) - Math.abs(a.days))
    .slice(0, 8);
  const finishVar = asPlannedVarianceDays(schedule);
  return [
    `${pairs.length} activity(ies) have both planned and actual finish dates.`,
    finishVar == null ? "Project-level finish variance was not computed." : `Latest actual finish is ${finishVar} calendar day(s) from the latest planned finish. This is not an EOT and not money.`,
    ...slips.map((row) => `${row.id} (${row.name}): ${row.days} calendar day(s) planned-to-actual finish.`),
  ];
}

function concurrencyFindings(schedule: Schedule, path: CriticalPathResult): string[] {
  if (!path.computed) {
    return ["Overlapping critical delay is not asserted without a computed critical path."];
  }
  const critical = schedule.activities.filter((activity) => path.criticalIds.includes(activity.id) && activity.start && activity.finish);
  if (critical.length < 2) {
    return ["Fewer than two dated critical activities; no overlapping-period observation is made."];
  }
  let overlaps = 0;
  for (let i = 0; i < critical.length; i++) {
    for (let j = i + 1; j < critical.length; j++) {
      const a = critical[i];
      const b = critical[j];
      if (a.start && a.finish && b.start && b.finish && a.start <= b.finish && b.start <= a.finish) overlaps += 1;
    }
  }
  return [
    `${overlaps} dated critical-activity pair(s) overlap in calendar time. That is a factual observation from the mapped dates, not a concurrency holding.`,
  ];
}

function calendarDays(from: string, to: string): number | null {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

function maxIso(values: (string | undefined)[]): string | undefined {
  const dates = values.filter((value): value is string => Boolean(value)).sort();
  return dates[dates.length - 1];
}

function canonicalSchedule(schedule: Schedule) {
  return {
    name: schedule.name,
    format: schedule.format,
    programmeType: schedule.programmeType,
    evidence: schedule.evidence,
    dataDate: schedule.dataDate ?? null,
    activities: [...schedule.activities].sort((a, b) => a.id.localeCompare(b.id)),
    links: [...schedule.links].sort((a, b) => `${a.predecessorId}:${a.successorId}`.localeCompare(`${b.predecessorId}:${b.successorId}`)),
    calendars: [...schedule.calendars].sort((a, b) => a.id.localeCompare(b.id)),
    impactEvents: [...schedule.impactEvents].sort(),
  };
}

export function methodLabel(method: DelayMethod): string {
  return METHOD_LABELS[method];
}

export function emptyProgress(stage = "queued"): { stage: string; percent: number } {
  return { stage, percent: stage === "complete" ? 100 : stage === "failed" ? 0 : 10 };
}
