import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TIME_ZONE,
  dateTime,
  daysInStage,
  dueLabel,
  fullDate,
  isOverdue,
  longDayDate,
  relativeLabel,
  shortDate,
  todayIso,
} from "./dates";

const NOW = new Date("2026-09-09T10:00:00Z");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function ago(ms: number): Date {
  return new Date(NOW.getTime() - ms);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("TIME_ZONE", () => {
  it("is Europe/London", () => {
    expect(TIME_ZONE).toBe("Europe/London");
  });
});

describe("todayIso", () => {
  it("gives the London date for the current time by default", () => {
    expect(todayIso()).toBe("2026-09-09");
  });

  it("follows the London date, not UTC, late in the evening during British Summer Time", () => {
    expect(todayIso(new Date("2026-09-09T23:30:00Z"))).toBe("2026-09-10");
  });

  it("follows UTC in winter when London is on GMT", () => {
    expect(todayIso(new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-15");
  });
});

describe("isOverdue", () => {
  it("is true for yesterday", () => {
    expect(isOverdue("2026-09-08")).toBe(true);
  });

  it("is false for today", () => {
    expect(isOverdue("2026-09-09")).toBe(false);
  });

  it("is false for tomorrow", () => {
    expect(isOverdue("2026-09-10")).toBe(false);
  });

  it("is false when there is no due date", () => {
    expect(isOverdue(null)).toBe(false);
    expect(isOverdue(undefined)).toBe(false);
    expect(isOverdue("")).toBe(false);
  });

  it("uses the London date of the supplied moment", () => {
    expect(isOverdue("2026-09-09", new Date("2026-09-09T23:30:00Z"))).toBe(true);
  });
});

describe("daysInStage", () => {
  it("is 0 for a change made just now", () => {
    expect(daysInStage(NOW)).toBe(0);
  });

  it("is 3 for a change made three days ago", () => {
    expect(daysInStage(ago(3 * DAY))).toBe(3);
  });

  it("counts London calendar days", () => {
    expect(daysInStage(new Date("2026-09-08T23:30:00Z"), new Date("2026-09-09T00:30:00Z"))).toBe(0);
    expect(daysInStage(new Date("2026-09-08T22:30:00Z"), new Date("2026-09-09T00:30:00Z"))).toBe(1);
  });

  it("is never negative", () => {
    expect(daysInStage(new Date(NOW.getTime() + 5 * DAY))).toBe(0);
  });
});

describe("relativeLabel", () => {
  it("says just now under a minute", () => {
    expect(relativeLabel(ago(30 * 1000))).toBe("just now");
  });

  it("counts minutes under an hour", () => {
    expect(relativeLabel(ago(5 * 60 * 1000))).toBe("5 minutes ago");
    expect(relativeLabel(ago(60 * 1000))).toBe("1 minute ago");
  });

  it("counts hours under a day", () => {
    expect(relativeLabel(ago(3 * HOUR))).toBe("3 hours ago");
    expect(relativeLabel(ago(1 * HOUR))).toBe("1 hour ago");
  });

  it("says yesterday for the previous London day", () => {
    expect(relativeLabel(ago(26 * HOUR))).toBe("yesterday");
  });

  it("stays in hours when a full day ago is still today in London, as when the clocks go back", () => {
    const early = new Date("2026-10-24T23:10:00Z"); // 00:10 BST on Sunday 25 October
    const late = new Date("2026-10-25T23:20:00Z"); // 23:20 GMT the same Sunday, 24 hours and 10 minutes on
    expect(relativeLabel(early, late)).toBe("24 hours ago");
    expect(daysInStage(early, late)).toBe(0);
  });

  it("counts days under a week", () => {
    expect(relativeLabel(ago(3 * DAY))).toBe("3 days ago");
  });

  it("falls back to the full date from a week on", () => {
    expect(relativeLabel(ago(10 * DAY))).toBe("30 August 2026");
    expect(relativeLabel(ago(7 * DAY))).toBe("02 September 2026");
  });

  it("accepts an explicit reference moment", () => {
    expect(relativeLabel(new Date("2026-09-09T09:00:00Z"), new Date("2026-09-09T12:00:00Z"))).toBe(
      "3 hours ago"
    );
  });
});

describe("formatting", () => {
  it("fullDate gives day month year with a zero-padded day", () => {
    expect(fullDate(NOW)).toBe("09 September 2026");
  });

  it("shortDate abbreviates the month to three letters", () => {
    expect(shortDate(NOW)).toBe("09 Sep 2026");
    expect(shortDate(new Date("2026-03-04T12:00:00Z"))).toBe("04 Mar 2026");
  });

  it("dateTime gives day, short month and London clock time", () => {
    expect(dateTime(new Date("2026-09-09T13:02:00Z"))).toBe("09 Sep 14:02");
    expect(dateTime(new Date("2026-01-15T00:05:00Z"))).toBe("15 Jan 00:05");
  });

  it("dueLabel gives weekday, day and short month from an ISO date", () => {
    expect(dueLabel("2026-09-11")).toBe("Fri 11 Sep");
    expect(dueLabel("2026-09-12")).toBe("Sat 12 Sep");
    expect(dueLabel("2026-09-01")).toBe("Tue 01 Sep");
  });

  it("dueLabel returns the input untouched when it is not an ISO date", () => {
    expect(dueLabel("soon")).toBe("soon");
  });

  it("longDayDate gives the weekday in full", () => {
    expect(longDayDate(NOW)).toBe("Wednesday 09 September 2026");
  });
});
