/**
 * Date helpers for the desk. Every calculation is made in Europe/London through
 * Intl.DateTimeFormat parts, so the machine zone never affects the result.
 * Month and weekday names come from tables here rather than from ICU, whose
 * en-GB data abbreviates September as "Sept".
 */

export const TIME_ZONE = "Europe/London";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

type Civil = { year: number; month: number; day: number; hour: number; minute: number };

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** The London civil date and clock time of a moment. */
function civil(date: Date): Civil {
  const parts = partsFormatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Whole days since the epoch for a civil date, so two civil dates can be subtracted. */
function dayNumber(c: Pick<Civil, "year" | "month" | "day">): number {
  return Math.round(Date.UTC(c.year, c.month - 1, c.day) / DAY);
}

function weekdayOf(c: Pick<Civil, "year" | "month" | "day">): string {
  return WEEKDAYS[new Date(Date.UTC(c.year, c.month - 1, c.day)).getUTCDay()];
}

function isoOf(c: Pick<Civil, "year" | "month" | "day">): string {
  return `${c.year}-${pad(c.month)}-${pad(c.day)}`;
}

function parseIso(iso: string): Pick<Civil, "year" | "month" | "day"> | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** Today's London date as "YYYY-MM-DD". */
export function todayIso(now: Date = new Date()): string {
  return isoOf(civil(now));
}

/** True when the due date (an ISO date string) is before today in London. */
export function isOverdue(due: string | null | undefined, now: Date = new Date()): boolean {
  if (!due) return false;
  const dueDate = parseIso(due);
  if (!dueDate) return false;
  return isoOf(dueDate) < todayIso(now);
}

/** Whole London calendar days since the stage changed, never negative. */
export function daysInStage(stageChangedAt: Date, now: Date = new Date()): number {
  const days = dayNumber(civil(now)) - dayNumber(civil(stageChangedAt));
  return Math.max(0, days);
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
}

/**
 * "just now" under a minute, then minutes and hours, "yesterday" for the previous
 * London day, "n days ago" under a week and the full date from a week on.
 */
export function relativeLabel(date: Date, now: Date = new Date()): string {
  const elapsed = now.getTime() - date.getTime();
  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return plural(Math.floor(elapsed / MINUTE), "minute");
  // A London day runs to 25 hours when the clocks go back, so a moment a full day
  // ago can still fall on today's date; it stays in hours rather than "yesterday".
  const days = dayNumber(civil(now)) - dayNumber(civil(date));
  if (elapsed < DAY || days < 1) return plural(Math.floor(elapsed / HOUR), "hour");
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return fullDate(date);
}

/** "09 September 2026" */
export function fullDate(date: Date): string {
  const c = civil(date);
  return `${pad(c.day)} ${MONTHS[c.month - 1]} ${c.year}`;
}

/** "09 Sep 2026" */
export function shortDate(date: Date): string {
  const c = civil(date);
  return `${pad(c.day)} ${MONTHS[c.month - 1].slice(0, 3)} ${c.year}`;
}

/** "09 Sep 14:02" in London time. */
export function dateTime(date: Date): string {
  const c = civil(date);
  return `${pad(c.day)} ${MONTHS[c.month - 1].slice(0, 3)} ${pad(c.hour)}:${pad(c.minute)}`;
}

/** "Fri 11 Sep" from an ISO date string; the input is returned untouched when it is not one. */
export function dueLabel(iso: string): string {
  const c = parseIso(iso);
  if (!c) return iso;
  return `${weekdayOf(c).slice(0, 3)} ${pad(c.day)} ${MONTHS[c.month - 1].slice(0, 3)}`;
}

/** "Wednesday 09 September 2026" */
export function longDayDate(date: Date): string {
  const c = civil(date);
  return `${weekdayOf(c)} ${pad(c.day)} ${MONTHS[c.month - 1]} ${c.year}`;
}
