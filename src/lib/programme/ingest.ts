/**
 * Programme ingest: detect the file, map WBS / activities / links / calendars,
 * and return a parse result with explicit issues. Native Asta .pp files are
 * SQLite containers (VeriCase: asta_pp_sqlite_v1); this portal inspects the
 * container and schema. Activity-level CPM needs an XML, CSV, XER or JSON export.
 */

import { extensionOf } from "@/lib/portal/files";
import type {
  Activity,
  Calendar,
  EvidenceGrade,
  LinkType,
  LogicLink,
  ParseResult,
  ProgrammeFormat,
  ProgrammeIssue,
  ProgrammeType,
  Schedule,
} from "./types";
import { assertNever } from "./types";

export const ASTA_PP_ENGINE = "asta_pp_sqlite_inspect_v1";
export const STRUCTURED_ENGINE = "meritus_structured_v1";
export const PDF_ENGINE = "meritus_pdf_markup_v1";

const SQLITE_MAGIC = "SQLite format 3";
const DEFAULT_CALENDAR: Calendar = { id: "cal-5d", name: "Five-day week", workingDays: [1, 2, 3, 4, 5] };

const ASTA_TABLE_HINTS = [
  "BAR",
  "TASK",
  "LINK",
  "CALENDAR",
  "CALDAY",
  "PROJECT",
  "WBS",
  "CODELIB",
  "PERMANENT_RESOURCE",
  "EXPANDED_TASK",
];

const COLUMN_ALIASES: Record<string, keyof Activity | "predecessors" | "critical"> = {
  id: "id",
  activity_id: "id",
  task_id: "id",
  uid: "id",
  task_code: "id",
  code: "id",
  name: "name",
  activity: "name",
  task_name: "name",
  description: "name",
  title: "name",
  wbs: "wbs",
  wbs_id: "wbs",
  wbs_code: "wbs",
  calendar: "calendarId",
  calendar_id: "calendarId",
  calendar_name: "calendarId",
  start: "start",
  start_date: "start",
  early_start: "start",
  planned_start: "start",
  target_start: "start",
  finish: "finish",
  finish_date: "finish",
  end: "finish",
  early_finish: "finish",
  planned_finish: "finish",
  target_finish: "finish",
  actual_start: "actualStart",
  act_start: "actualStart",
  actual_finish: "actualFinish",
  act_finish: "actualFinish",
  duration: "durationDays",
  orig_dur: "durationDays",
  original_duration: "durationDays",
  total_float: "totalFloatDays",
  totalfloat: "totalFloatDays",
  tf: "totalFloatDays",
  free_float: "freeFloatDays",
  percent: "percentComplete",
  percent_complete: "percentComplete",
  pct: "percentComplete",
  type: "type",
  task_type: "type",
  predecessors: "predecessors",
  preds: "predecessors",
  pred: "predecessors",
  critical: "critical",
  is_critical: "critical",
};

export function ingestProgramme(fileName: string, bytes: Uint8Array): ParseResult {
  const format = detectFormat(fileName, bytes);
  switch (format) {
    case "asta_pp":
      return inspectAstaPp(fileName, bytes);
    case "asta_xml":
    case "msp_xml":
      return parseXml(fileName, bytes, format);
    case "p6_xer":
      return parseXer(fileName, bytes);
    case "csv":
      return parseCsv(fileName, bytes);
    case "json":
      return parseJson(fileName, bytes);
    case "pdf":
      return parsePdfMarkup(fileName, bytes);
    case "unknown":
      return failed(fileName, "unknown", [
        issue("unrecognised_format", "high", "Unrecognised programme file", "Expected Asta .pp or XML, P6 .xer, MSP XML, CSV, JSON, or a programme PDF."),
      ]);
    default:
      return assertNever(format, `Unhandled programme format: ${String(format)}`);
  }
}

export function detectFormat(fileName: string, bytes: Uint8Array): ProgrammeFormat {
  const ext = extensionOf(fileName);
  const textHead = decodeHead(bytes, 4096);
  if (looksLikeSqlite(bytes) || ext === ".pp") {
    if (looksLikeSqlite(bytes) || /elecosoft|asta|powerproject/i.test(textHead)) return "asta_pp";
    if (ext === ".pp" && looksLikeXml(textHead)) return "asta_xml";
    if (ext === ".pp") return "asta_pp";
  }
  if (ext === ".xer" || /^%T\t/m.test(textHead) || textHead.startsWith("ERMHDR")) return "p6_xer";
  if (ext === ".json" || textHead.trimStart().startsWith("{") || textHead.trimStart().startsWith("[")) return "json";
  if (ext === ".csv") return "csv";
  if (ext === ".pdf" || textHead.startsWith("%PDF")) return "pdf";
  if (ext === ".xml" || looksLikeXml(textHead)) {
    return /schemas\.microsoft\.com\/project/i.test(textHead) ? "msp_xml" : "asta_xml";
  }
  if (ext === ".txt") {
    if (/^%T\t/m.test(textHead) || textHead.startsWith("ERMHDR")) return "p6_xer";
    if (looksLikeXml(textHead)) return /schemas\.microsoft\.com\/project/i.test(textHead) ? "msp_xml" : "asta_xml";
    if (looksLikeCsv(textHead)) return "csv";
  }
  return "unknown";
}

export function looksLikeSqlite(bytes: Uint8Array): boolean {
  if (bytes.length < 16) return false;
  return decoder().decode(bytes.subarray(0, 15)) === SQLITE_MAGIC;
}

function inspectAstaPp(fileName: string, bytes: Uint8Array): ParseResult {
  const issues: ProgrammeIssue[] = [];
  if (!looksLikeSqlite(bytes)) {
    return failed(fileName, "asta_pp", [
      issue(
        "asta_pp_not_sqlite",
        "high",
        "Asta .pp is not a SQLite container",
        "A .pp file should begin with SQLite format 3 (Elecosoft Powerproject). This file does not. Export XML or CSV from Powerproject."
      ),
    ]);
  }

  const tables = extractSqliteCreateTables(bytes);
  const astaTables = tables.filter((table) => ASTA_TABLE_HINTS.includes(table.name.toUpperCase()));
  const tableList = (astaTables.length ? astaTables : tables).map((table) => table.name).slice(0, 24);
  const hasBar = tables.some((table) => /^(BAR|TASK|EXPANDED_TASK)$/i.test(table.name));
  const hasLink = tables.some((table) => /^LINK$/i.test(table.name));
  const hasCalendar = tables.some((table) => /CALENDAR/i.test(table.name));

  if (tables.length === 0) {
    issues.push(
      issue(
        "asta_pp_schema_unreadable",
        "high",
        "Asta schema not readable",
        "The SQLite header is present but no CREATE TABLE statements could be read. The file may be truncated or encrypted."
      )
    );
  } else {
    issues.push(
      issue(
        "asta_pp_export_required",
        "high",
        "Native Asta .pp container",
        `SQLite Powerproject file detected (${bytes.length} bytes). Tables: ${tableList.join(", ") || "none named"}. This portal inspects the container; it does not extract row-level CPM from the proprietary schema. Export XML or CSV from Powerproject for activity-level analysis. VeriCase native ingest uses asta_pp_sqlite_v1.`
      )
    );
  }

  if (!hasBar) {
    issues.push(issue("missing_activities", "high", "No activity table", "Expected BAR, TASK or EXPANDED_TASK in the Asta schema."));
  }
  if (!hasLink) {
    issues.push(issue("missing_links", "medium", "No link table", "LINK was not found. Network logic cannot be mapped from this container."));
  }
  if (!hasCalendar) {
    issues.push(issue("missing_calendars", "medium", "No calendar table", "CALENDAR was not found. Working-day calendars are unmapped."));
  }
  if (bytes.length < 2048) {
    issues.push(issue("truncated_file", "high", "File looks truncated", "The container is unusually small for a Powerproject file."));
  }

  const schedule = emptySchedule(fileName, "asta_pp", "none");
  const status = tables.length === 0 ? "failed" : "partial";
  return {
    status,
    engine: ASTA_PP_ENGINE,
    confidence: status === "failed" ? 10 : hasBar && hasLink ? 55 : 35,
    format: "asta_pp",
    schedule,
    issues,
  };
}

function parseXml(fileName: string, bytes: Uint8Array, format: "asta_xml" | "msp_xml"): ParseResult {
  const xml = decodeText(bytes);
  if (!looksLikeXml(xml)) {
    return failed(fileName, format, [issue("xml_unreadable", "high", "XML unreadable", "The file does not look like XML.")]);
  }

  const issues: ProgrammeIssue[] = [];
  const activities: Activity[] = [];
  const links: LogicLink[] = [];
  const calendars: Calendar[] = [];
  const seen = new Set<string>();

  const taskBlocks = collectElements(xml, ["Task", "Activity", "Bar", "TASK", "ACTIVITY"]);
  for (const block of taskBlocks) {
    const summary = childText(block, "Summary") === "1" || childText(block, "IsSummary") === "1";
    if (summary) continue;
    const id = firstChild(block, ["UID", "ID", "Id", "UniqueID", "Code", "GUID"]) || "";
    const name = firstChild(block, ["Name", "Title", "Description", "TaskName"]) || "";
    if (!id && !name) continue;
    const activityId = id || `row-${activities.length + 1}`;
    if (seen.has(activityId)) {
      issues.push(issue("duplicate_ids", "medium", "Duplicate activity id", `More than one task used id ${activityId}.`));
      continue;
    }
    seen.add(activityId);
    const duration = parseDuration(firstChild(block, ["Duration", "OrigDuration", "OriginalDuration"]));
    const milestone = truthy(firstChild(block, ["Milestone", "IsMilestone"])) || duration === 0;
    activities.push({
      id: activityId,
      name: stripLeadingSemicolon(name || activityId, issues),
      wbs: firstChild(block, ["WBS", "WBSCode", "OutlineNumber"]) ?? undefined,
      calendarId: firstChild(block, ["CalendarUID", "CalendarID", "Calendar"]) ?? undefined,
      start: parseDate(firstChild(block, ["Start", "StartDate", "EarlyStart", "PlannedStart"])),
      finish: parseDate(firstChild(block, ["Finish", "FinishDate", "EarlyFinish", "PlannedFinish"])),
      actualStart: parseDate(firstChild(block, ["ActualStart", "ActStart"])),
      actualFinish: parseDate(firstChild(block, ["ActualFinish", "ActFinish"])),
      durationDays: duration,
      totalFloatDays: parseNumber(firstChild(block, ["TotalSlack", "TotalFloat", "Total_Float"])),
      freeFloatDays: parseNumber(firstChild(block, ["FreeSlack", "FreeFloat"])),
      percentComplete: parseNumber(firstChild(block, ["PercentComplete", "PercentWorkComplete"])),
      milestone,
      suppliedCritical: truthy(firstChild(block, ["Critical", "IsCritical"])) || undefined,
      type: firstChild(block, ["Type", "TaskType"]) ?? undefined,
    });

    for (const pred of collectElements(block, ["PredecessorLink", "Predecessor", "Pred"])) {
      const predecessorId = firstChild(pred, ["PredecessorUID", "PredecessorID", "UID", "ID"]);
      if (!predecessorId) continue;
      links.push({
        predecessorId,
        successorId: activityId,
        type: mapLinkType(firstChild(pred, ["Type", "LinkType", "PredType"])),
        lagDays: parseNumber(firstChild(pred, ["LinkLag", "Lag"])) ?? 0,
      });
    }
  }

  for (const link of collectElements(xml, ["Link", "Relationship", "LINK"])) {
    const predecessorId = firstChild(link, ["PredecessorUID", "PredUID", "From", "pred_task_id"]);
    const successorId = firstChild(link, ["SuccessorUID", "SuccUID", "To", "task_id"]);
    if (!predecessorId || !successorId) continue;
    links.push({
      predecessorId,
      successorId,
      type: mapLinkType(firstChild(link, ["Type", "LinkType", "pred_type"])),
      lagDays: parseNumber(firstChild(link, ["Lag", "LinkLag"])) ?? 0,
    });
  }

  for (const cal of collectElements(xml, ["Calendar", "CALENDAR"])) {
    const id = firstChild(cal, ["UID", "ID", "GUID"]) || `cal-${calendars.length + 1}`;
    const name = firstChild(cal, ["Name", "Title"]) || id;
    const week = childBlock(cal, "WeekDays") ?? childBlock(cal, "WeekDay");
    const workingDays = week ? workingDaysFromXml(week) : [1, 2, 3, 4, 5];
    calendars.push({ id, name, workingDays });
  }

  return finishStructured(fileName, format, activities, links, calendars.length ? calendars : [DEFAULT_CALENDAR], issues, "structured_export");
}

function parseXer(fileName: string, bytes: Uint8Array): ParseResult {
  const text = decodeText(bytes);
  const issues: ProgrammeIssue[] = [];
  const tables = parseXerTables(text);
  const taskRows = tables.TASK ?? [];
  const predRows = tables.TASKPRED ?? [];
  const calRows = tables.CALENDAR ?? [];

  if (taskRows.length === 0) {
    return failed(fileName, "p6_xer", [
      issue("xer_no_tasks", "high", "No TASK table", "A P6 XER file should contain %T TASK rows. Export the XER again from Primavera."),
    ]);
  }

  const activities: Activity[] = taskRows.map((row, index) => {
    const id = row.task_code || row.task_id || `task-${index + 1}`;
    const rawName = row.task_name || id;
    return {
      id,
      name: stripLeadingSemicolon(rawName, issues),
      wbs: row.wbs_id,
      calendarId: row.clndr_id,
      start: parseDate(row.target_start_date || row.early_start_date || row.act_start_date),
      finish: parseDate(row.target_end_date || row.early_end_date || row.act_end_date),
      actualStart: parseDate(row.act_start_date),
      actualFinish: parseDate(row.act_end_date),
      durationDays: parseNumber(row.target_drtn_hr_cnt) != null ? hoursToDays(parseNumber(row.target_drtn_hr_cnt)) : parseNumber(row.remain_drtn_hr_cnt) != null ? hoursToDays(parseNumber(row.remain_drtn_hr_cnt)) : undefined,
      totalFloatDays: parseNumber(row.total_float_hr_cnt) != null ? hoursToDays(parseNumber(row.total_float_hr_cnt)) : undefined,
      freeFloatDays: parseNumber(row.free_float_hr_cnt) != null ? hoursToDays(parseNumber(row.free_float_hr_cnt)) : undefined,
      percentComplete: parseNumber(row.phys_complete_pct),
      milestone: /TT_Mile|TT_FinMile|TT_StartMile/i.test(row.task_type ?? ""),
      suppliedCritical: row.driving_path_flag === "Y" || undefined,
      type: row.task_type,
    };
  });

  const idByTaskId = new Map<string, string>();
  for (const row of taskRows) {
    if (row.task_id && row.task_code) idByTaskId.set(row.task_id, row.task_code);
  }

  const links: LogicLink[] = predRows
    .map((row) => {
      const predecessorId = idByTaskId.get(row.pred_task_id ?? "") ?? row.pred_task_id;
      const successorId = idByTaskId.get(row.task_id ?? "") ?? row.task_id;
      if (!predecessorId || !successorId) return null;
      return {
        predecessorId,
        successorId,
        type: mapLinkType(row.pred_type),
        lagDays: parseNumber(row.lag_hr_cnt) != null ? hoursToDays(parseNumber(row.lag_hr_cnt)) ?? 0 : 0,
      };
    })
    .filter((link): link is LogicLink => Boolean(link));

  const calendars: Calendar[] = calRows.map((row, index) => ({
    id: row.clndr_id || `cal-${index + 1}`,
    name: row.clndr_name || row.clndr_id || `Calendar ${index + 1}`,
    workingDays: [1, 2, 3, 4, 5],
  }));

  return finishStructured(fileName, "p6_xer", activities, links, calendars.length ? calendars : [DEFAULT_CALENDAR], issues, "structured_export");
}

function parseCsv(fileName: string, bytes: Uint8Array): ParseResult {
  const text = decodeText(bytes).replace(/^\uFEFF/, "");
  const rows = splitCsv(text);
  if (rows.length < 2) {
    return failed(fileName, "csv", [issue("csv_empty", "high", "CSV has no data rows", "A header and at least one activity row are required.")]);
  }

  const header = rows[0].map((cell) => normaliseHeader(cell));
  const mapped = header.map((cell) => COLUMN_ALIASES[cell] ?? null);
  if (!mapped.some((col) => col === "id" || col === "name")) {
    return failed(fileName, "csv", [
      issue(
        "csv_columns_unmapped",
        "high",
        "CSV columns not recognised",
        `Need an id or name column. Found: ${rows[0].join(", ")}. Typical headers: id, name, start, finish, duration, predecessors, total_float, wbs, calendar.`
      ),
    ]);
  }

  const issues: ProgrammeIssue[] = [];
  const activities: Activity[] = [];
  const links: LogicLink[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every((cell) => !cell.trim())) continue;
    const raw: Partial<Activity> & { predecessors?: string; critical?: string } = {};
    mapped.forEach((key, index) => {
      if (!key) return;
      const value = row[index]?.trim() ?? "";
      if (!value) return;
      if (key === "predecessors") raw.predecessors = value;
      else if (key === "critical") raw.critical = value;
      else if (key === "durationDays" || key === "totalFloatDays" || key === "freeFloatDays" || key === "percentComplete") {
        raw[key] = parseNumber(value);
      } else if (key === "start" || key === "finish" || key === "actualStart" || key === "actualFinish") {
        raw[key] = parseDate(value);
      } else if (key === "milestone") {
        raw.milestone = truthy(value);
      } else if (key === "id" || key === "name" || key === "wbs" || key === "calendarId" || key === "type") {
        raw[key] = value;
      }
    });

    const id = raw.id || `row-${i}`;
    if (seen.has(id)) {
      issues.push(issue("duplicate_ids", "medium", "Duplicate activity id", `Row ${i + 1} repeats id ${id}.`));
      continue;
    }
    seen.add(id);
    const name = stripLeadingSemicolon(raw.name || id, issues);
    const duration = raw.durationDays;
    activities.push({
      id,
      name,
      wbs: raw.wbs,
      calendarId: raw.calendarId,
      start: raw.start,
      finish: raw.finish,
      actualStart: raw.actualStart,
      actualFinish: raw.actualFinish,
      durationDays: duration,
      totalFloatDays: raw.totalFloatDays,
      freeFloatDays: raw.freeFloatDays,
      percentComplete: raw.percentComplete,
      milestone: raw.type ? /mile/i.test(raw.type) : duration === 0,
      suppliedCritical: raw.critical ? truthy(raw.critical) : undefined,
      type: raw.type,
    });

    if (raw.predecessors) {
      for (const token of raw.predecessors.split(/[;,]/)) {
        const match = token.trim().match(/^(.+?)(?:\s*\(\s*(FS|SS|FF|SF)\s*(?:([+-]?\d+))?\s*\))?$/i);
        if (!match) continue;
        const predecessorId = match[1].trim();
        if (!predecessorId) continue;
        links.push({
          predecessorId,
          successorId: id,
          type: mapLinkType(match[2]),
          lagDays: parseNumber(match[3]) ?? 0,
        });
      }
    }
  }

  return finishStructured(fileName, "csv", activities, links, [DEFAULT_CALENDAR], issues, "structured_export");
}

function parseJson(fileName: string, bytes: Uint8Array): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeText(bytes));
  } catch {
    return failed(fileName, "json", [issue("json_invalid", "high", "JSON is invalid", "The file could not be parsed as JSON.")]);
  }

  const root = asRecord(parsed);
  const list = Array.isArray(parsed) ? parsed : root?.activities ?? root?.tasks ?? root?.schedule;
  const rows = Array.isArray(list) ? list : null;
  if (!rows) {
    return failed(fileName, "json", [
      issue("json_shape", "high", "JSON shape not recognised", "Expected { activities, links?, calendars? } or an activity array."),
    ]);
  }

  const issues: ProgrammeIssue[] = [];
  const activities: Activity[] = [];
  const seen = new Set<string>();
  for (const [index, item] of rows.entries()) {
    const row = asRecord(item);
    if (!row) continue;
    const id = str(row.id ?? row.activity_id ?? row.task_id ?? row.uid) || `row-${index + 1}`;
    if (seen.has(id)) {
      issues.push(issue("duplicate_ids", "medium", "Duplicate activity id", `JSON repeated id ${id}.`));
      continue;
    }
    seen.add(id);
    activities.push({
      id,
      name: stripLeadingSemicolon(str(row.name ?? row.task_name ?? row.title) || id, issues),
      wbs: str(row.wbs ?? row.wbs_id) || undefined,
      calendarId: str(row.calendarId ?? row.calendar) || undefined,
      start: parseDate(str(row.start ?? row.start_date)),
      finish: parseDate(str(row.finish ?? row.finish_date)),
      actualStart: parseDate(str(row.actualStart ?? row.actual_start)),
      actualFinish: parseDate(str(row.actualFinish ?? row.actual_finish)),
      durationDays: num(row.durationDays ?? row.duration),
      totalFloatDays: num(row.totalFloatDays ?? row.total_float),
      freeFloatDays: num(row.freeFloatDays ?? row.free_float),
      percentComplete: num(row.percentComplete ?? row.percent),
      milestone: Boolean(row.milestone) || /mile/i.test(str(row.type) ?? ""),
      suppliedCritical: row.suppliedCritical === true || row.critical === true || undefined,
      type: str(row.type) || undefined,
    });
  }

  const linkRows = Array.isArray(root?.links) ? root.links : [];
  const links: LogicLink[] = linkRows
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const predecessorId = str(row.predecessorId ?? row.pred ?? row.from);
      const successorId = str(row.successorId ?? row.succ ?? row.to);
      if (!predecessorId || !successorId) return null;
      return {
        predecessorId,
        successorId,
        type: mapLinkType(str(row.type)),
        lagDays: num(row.lagDays ?? row.lag) ?? 0,
      };
    })
    .filter((link): link is LogicLink => Boolean(link));

  const calendars: Calendar[] = (Array.isArray(root?.calendars) ? root.calendars : [])
    .map((item, index) => {
      const row = asRecord(item);
      if (!row) return null;
      const workingDays = Array.isArray(row.workingDays) ? row.workingDays.filter((d): d is number => typeof d === "number") : [1, 2, 3, 4, 5];
      return {
        id: str(row.id) || `cal-${index + 1}`,
        name: str(row.name) || `Calendar ${index + 1}`,
        workingDays,
      };
    })
    .filter((cal): cal is Calendar => Boolean(cal));

  const result = finishStructured(fileName, "json", activities, links, calendars.length ? calendars : [DEFAULT_CALENDAR], issues, "structured_export");
  if (str(root?.dataDate)) result.schedule.dataDate = parseDate(str(root?.dataDate));
  if (str(root?.name)) result.schedule.name = str(root?.name) || result.schedule.name;
  const type = str(root?.programmeType ?? root?.type);
  if (type === "baseline" || type === "interim" || type === "as_built") result.schedule.programmeType = type;
  if (Array.isArray(root?.impactEvents)) {
    result.schedule.impactEvents = root.impactEvents.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  return result;
}

function parsePdfMarkup(fileName: string, bytes: Uint8Array): ParseResult {
  const text = extractPdfLatinText(bytes);
  const issues: ProgrammeIssue[] = [
    issue(
      "pdf_not_schedule_evidence",
      "high",
      "PDF is mark-up, not a schedule",
      "Float, critical path and delay days are not computed from a Gantt PDF. Provide the native programme or a structured export (Asta XML/CSV, P6 XER, MSP XML, JSON)."
    ),
  ];
  if (!text.trim()) {
    return {
      status: "failed",
      engine: PDF_ENGINE,
      confidence: 5,
      format: "pdf",
      schedule: emptySchedule(fileName, "pdf", "none"),
      issues: [
        ...issues,
        issue("pdf_no_text", "high", "No extractable text", "The PDF has no readable text layer. It cannot be used as programme evidence."),
      ],
    };
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const dateHits = lines.filter((line) => /\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/.test(line));
  if (dateHits.length) {
    issues.push(
      issue(
        "pdf_dates_unmapped",
        "medium",
        "Printed dates are not mapped",
        `${dateHits.length} line(s) look like they contain dates. They are not treated as activity start/finish evidence.`
      )
    );
  }

  return {
    status: "partial",
    engine: PDF_ENGINE,
    confidence: 15,
    format: "pdf",
    schedule: emptySchedule(fileName, "pdf", "markup_only"),
    issues,
  };
}

function finishStructured(
  fileName: string,
  format: ProgrammeFormat,
  activities: Activity[],
  links: LogicLink[],
  calendars: Calendar[],
  issues: ProgrammeIssue[],
  evidence: EvidenceGrade
): ParseResult {
  const known = new Set(activities.map((activity) => activity.id));
  const keptLinks: LogicLink[] = [];
  let missingEnds = 0;
  for (const link of links) {
    if (!known.has(link.predecessorId) || !known.has(link.successorId)) {
      missingEnds += 1;
      continue;
    }
    keptLinks.push(link);
  }
  if (missingEnds) {
    issues.push(
      issue("missing_link_ends", "medium", "Links to unknown activities", `${missingEnds} link(s) pointed at an id that is not in the activity list and were dropped.`)
    );
  }

  for (const activity of activities) {
    if (activity.start && activity.finish && activity.start > activity.finish) {
      issues.push(issue("reverse_dates", "medium", "Finish before start", `${activity.id} (${activity.name}) finishes before it starts.`));
    }
    if (!activity.milestone && activity.durationDays === 0) {
      issues.push(issue("zero_duration_non_milestone", "low", "Zero-duration task", `${activity.id} has zero duration and is not marked as a milestone.`));
    }
    if ((activity.durationDays ?? 0) > 365) {
      issues.push(issue("very_long_activity", "low", "Very long activity", `${activity.id} is longer than 365 days.`));
    }
  }

  if (activities.length === 0) {
    issues.push(issue("no_activities", "high", "No activities mapped", "The file was read but no activity rows were found."));
    return {
      status: "empty",
      engine: STRUCTURED_ENGINE,
      confidence: 20,
      format,
      schedule: emptySchedule(fileName, format, "none"),
      issues,
    };
  }

  const dated = activities.filter((activity) => activity.start || activity.finish).length;
  const schedule: Schedule = {
    name: fileName,
    format,
    programmeType: inferProgrammeType(activities),
    evidence,
    projectStart: minDate(activities.map((activity) => activity.start ?? activity.actualStart)),
    projectFinish: maxDate(activities.map((activity) => activity.finish ?? activity.actualFinish)),
    activities,
    links: keptLinks,
    calendars,
    impactEvents: [],
  };

  const status: ParseResult["status"] = issues.some((item) => item.severity === "high") ? "partial" : "parsed";
  const confidence = Math.max(40, Math.min(95, 70 + Math.min(20, dated) - issues.filter((item) => item.severity !== "low").length * 5));
  return { status, engine: STRUCTURED_ENGINE, confidence, format, schedule, issues };
}

function inferProgrammeType(activities: Activity[]): ProgrammeType {
  const withActual = activities.filter((activity) => activity.actualStart || activity.actualFinish).length;
  if (withActual === 0) return "baseline";
  if (withActual >= activities.length * 0.8) return "as_built";
  return "interim";
}

function emptySchedule(name: string, format: ProgrammeFormat, evidence: EvidenceGrade): Schedule {
  return {
    name,
    format,
    programmeType: "unknown",
    evidence,
    activities: [],
    links: [],
    calendars: [],
    impactEvents: [],
  };
}

function failed(fileName: string, format: ProgrammeFormat, issues: ProgrammeIssue[]): ParseResult {
  return {
    status: "failed",
    engine: format === "asta_pp" ? ASTA_PP_ENGINE : format === "pdf" ? PDF_ENGINE : STRUCTURED_ENGINE,
    confidence: 0,
    format,
    schedule: emptySchedule(fileName, format, "none"),
    issues,
  };
}

function issue(code: string, severity: ProgrammeIssue["severity"], title: string, detail: string): ProgrammeIssue {
  return { code, severity, title, detail };
}

function stripLeadingSemicolon(name: string, issues: ProgrammeIssue[]): string {
  if (!name.startsWith(";")) return name;
  if (!issues.some((item) => item.code === "semicolon_prefix_names")) {
    issues.push(
      issue("semicolon_prefix_names", "low", "Leading semicolon stripped", "One or more row names carried a leading ';' marker (stripped).")
    );
  }
  return name.replace(/^;+/, "").trim();
}

export function extractSqliteCreateTables(bytes: Uint8Array): { name: string; sql: string }[] {
  const text = decodeHead(bytes, Math.min(bytes.length, 2_000_000));
  const tables: { name: string; sql: string }[] = [];
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?([A-Za-z0-9_]+)["'`]?\s*\(/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    tables.push({ name: match[1], sql: match[0] });
  }
  return tables;
}

function parseXerTables(text: string): Record<string, Record<string, string>[]> {
  const tables: Record<string, Record<string, string>[]> = {};
  let current: string | null = null;
  let fields: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\u0000/g, "");
    if (line.startsWith("%T")) {
      current = line.slice(2).trim().split(/\s+/)[0] ?? null;
      fields = [];
      if (current && !tables[current]) tables[current] = [];
      continue;
    }
    if (line.startsWith("%F") && current) {
      fields = line.slice(2).trim().split("\t").map((field) => field.trim());
      continue;
    }
    if (line.startsWith("%R") && current && fields.length) {
      const values = line.slice(2).replace(/^\t/, "").split("\t");
      const row: Record<string, string> = {};
      fields.forEach((field, index) => {
        row[field] = values[index] ?? "";
      });
      tables[current].push(row);
    }
  }
  return tables;
}

function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function collectElements(xml: string, tags: string[]): string[] {
  const blocks: string[] = [];
  for (const tag of tags) {
    const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
    let match: RegExpExecArray | null;
    while ((match = re.exec(xml))) {
      blocks.push(match[1]);
    }
  }
  return blocks;
}

function childBlock(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  return xml.match(re)?.[1] ?? null;
}

function childText(xml: string, tag: string): string | null {
  const block = childBlock(xml, tag);
  if (block == null) return null;
  return block.replace(/<[^>]+>/g, "").trim() || null;
}

function firstChild(xml: string, tags: string[]): string | null {
  for (const tag of tags) {
    const value = childText(xml, tag);
    if (value) return value;
  }
  return null;
}

function workingDaysFromXml(xml: string): number[] {
  const days: number[] = [];
  const blocks = collectElements(xml, ["WeekDay", "Day"]);
  for (const block of blocks) {
    const dayType = parseNumber(childText(block, "DayType") ?? childText(block, "Type"));
    const day = parseNumber(childText(block, "DayType") ? childText(block, "DayType") : childText(block, "Day"));
    if (day != null && dayType !== 0) days.push(((day % 7) + 7) % 7);
  }
  return days.length ? [...new Set(days)] : [1, 2, 3, 4, 5];
}

function mapLinkType(value: string | null | undefined): LinkType {
  const raw = (value ?? "").trim().toUpperCase();
  if (raw === "0" || raw === "FF" || raw.includes("FF")) return "FF";
  if (raw === "2" || raw === "SF" || raw.includes("SF")) return "SF";
  if (raw === "3" || raw === "SS" || raw.includes("SS")) return "SS";
  if (raw === "1" || raw === "FS" || raw.includes("FS") || raw.includes("PR_FS")) return "FS";
  return "FS";
}

function parseDuration(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const iso = value.match(/P(?:(\d+)D)?(?:T(?:(\d+)H)?)?/i);
  if (iso && (iso[1] || iso[2])) {
    const days = iso[1] ? Number(iso[1]) : 0;
    const hours = iso[2] ? Number(iso[2]) : 0;
    return days + hours / 8;
  }
  return parseNumber(value.replace(/days?|d\b/gi, "").trim());
}

function hoursToDays(hours: number | undefined): number | undefined {
  if (hours == null) return undefined;
  return Math.round((hours / 8) * 100) / 100;
}

function parseNumber(value: string | number | null | undefined): number | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(String(value).replace(/,/g, "").replace(/%$/, ""));
  return Number.isFinite(n) ? n : undefined;
}

function parseDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const iso = value.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const uk = value.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (uk) {
    const year = uk[3].length === 2 ? `20${uk[3]}` : uk[3];
    return `${year}-${uk[2].padStart(2, "0")}-${uk[1].padStart(2, "0")}`;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return undefined;
  return new Date(parsed).toISOString().slice(0, 10);
}

function truthy(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^(1|y|yes|true|critical)$/i.test(value.trim());
}

function minDate(values: (string | undefined)[]): string | undefined {
  const dates = values.filter((value): value is string => Boolean(value)).sort();
  return dates[0];
}

function maxDate(values: (string | undefined)[]): string | undefined {
  const dates = values.filter((value): value is string => Boolean(value)).sort();
  return dates[dates.length - 1];
}

function normaliseHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/%/g, "percent")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function looksLikeXml(text: string): boolean {
  const head = text.trimStart();
  return head.startsWith("<") || head.startsWith("<?xml");
}

function looksLikeCsv(text: string): boolean {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  return first.includes(",") && /(id|name|start|finish|activity|task)/i.test(first);
}

function decodeText(bytes: Uint8Array): string {
  return decoder().decode(bytes);
}

function decodeHead(bytes: Uint8Array, max: number): string {
  return decoder().decode(bytes.subarray(0, Math.min(bytes.length, max)));
}

function decoder(): TextDecoder {
  return new TextDecoder("utf-8", { fatal: false });
}

function extractPdfLatinText(bytes: Uint8Array): string {
  const raw = decodeHead(bytes, Math.min(bytes.length, 1_500_000));
  const chunks: string[] = [];
  const re = /\((?:\\.|[^\\)]){2,}\)(?:\s*Tj|\s*TJ)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) {
    const inner = match[0].slice(1, match[0].lastIndexOf(")"));
    const text = inner.replace(/\\n/g, "\n").replace(/\\r/g, "\n").replace(/\\(.)/g, "$1");
    if (/[A-Za-z]{3,}/.test(text)) chunks.push(text);
  }
  if (chunks.length) return chunks.join("\n");
  return raw
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function num(value: unknown): number | undefined {
  return parseNumber(typeof value === "number" || typeof value === "string" ? value : undefined);
}
