import { describe, expect, it } from "vitest";
import { dateWindow, displayDate, shiftDate, validDate } from "./dates";

describe("action dates", () => {
  it("uses the London calendar at midnight and clock changes", () => {
    expect(dateWindow(new Date("2026-09-12T23:30:00Z")).today).toBe("2026-09-13");
    expect(dateWindow(new Date("2026-03-29T23:30:00Z")).today).toBe("2026-03-30");
    expect(dateWindow(new Date("2026-10-25T23:30:00Z")).today).toBe("2026-10-25");
  });

  it("rejects impossible and non-canonical dates", () => {
    expect(validDate("2026-02-29")).toBe(false);
    expect(validDate("2026-9-12")).toBe(false);
    expect(validDate("2028-02-29")).toBe(true);
  });

  it("shifts dates across month boundaries and displays British dates", () => {
    expect(shiftDate("2026-09-30", 1)).toBe("2026-10-01");
    expect(displayDate("2026-09-12")).toBe("12 September 2026");
  });
});
