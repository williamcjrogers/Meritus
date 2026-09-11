import { describe, expect, it } from "vitest";
import { runProgrammeFile, shouldReuseReport } from "./run";

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe("runProgrammeFile", () => {
  it("returns a complete report for a structured CSV and surfaces ingest errors", () => {
    const ok = runProgrammeFile(
      "rev.csv",
      bytes("id,name,start,finish,duration,predecessors\nA,Prelims,2020-01-06,2020-01-10,5,\nB,Frame,2020-01-13,2020-01-24,10,A (FS)\n"),
      new Date("2026-09-11T12:00:00Z")
    );
    expect(ok.error).toBeNull();
    expect(ok.report?.progress.stage).toBe("complete");
    expect(ok.report?.figures.find((fig) => fig.id === "fig.activities")?.value).toBe(2);
    expect(ok.cacheKey).toHaveLength(64);

    const bad = runProgrammeFile("x.csv", bytes("foo,bar\n1,2"));
    expect(bad.report).toBeNull();
    expect(bad.error).toMatch(/id or name/i);
    expect(bad.progress.stage).toBe("failed");
  });

  it("reuses a report only when the cache key matches and recompute is off", () => {
    expect(shouldReuseReport("abc", "abc", false)).toBe(true);
    expect(shouldReuseReport("abc", "abc", true)).toBe(false);
    expect(shouldReuseReport("abc", "def", false)).toBe(false);
    expect(shouldReuseReport(null, "abc", false)).toBe(false);
  });
});
