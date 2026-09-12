import { todayIso } from "@/lib/portal/dates";
import type { DateWindow } from "./types";

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function dateWindow(now: Date): DateWindow {
  const today = todayIso(now);
  return {
    today,
    upcomingEnd: shiftDate(today, 7),
    agendaEnd: shiftDate(today, 14),
    recentStart: shiftDate(today, -6),
  };
}

export function displayDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}
