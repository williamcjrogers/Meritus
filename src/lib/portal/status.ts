import type { LeadStatus, NoteSource } from "@/lib/db/schema";

export const LEAD_STATUSES: readonly LeadStatus[] = [
  "new",
  "researching",
  "conflict_check",
  "instructed",
  "declined",
  "parked",
] as const;

export function isLeadStatus(value: string): value is LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(value);
}

export function leadStatusLabel(status: LeadStatus): string {
  switch (status) {
    case "new":
      return "New";
    case "researching":
      return "Researching";
    case "conflict_check":
      return "Conflict check";
    case "instructed":
      return "Instructed";
    case "declined":
      return "Declined";
    case "parked":
      return "Parked";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export function noteSourceLabel(source: NoteSource): string {
  switch (source) {
    case "human":
      return "Note";
    case "research":
      return "Research";
    case "chat":
      return "Chat";
    default: {
      const exhaustive: never = source;
      return exhaustive;
    }
  }
}

export function isOpenLeadStatus(status: LeadStatus): boolean {
  switch (status) {
    case "new":
    case "researching":
    case "conflict_check":
    case "parked":
      return true;
    case "instructed":
    case "declined":
      return false;
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}
