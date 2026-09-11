import { describe, expect, it } from "vitest";
import {
  conflictTierLabel,
  defaultOutreach,
  isProspectView,
  prospectViewLabel,
  scoreBarWidth,
} from "./model";
import seed from "./bree-seed.json";

describe("prospect ranking model", () => {
  it("defaults latent conflicts to unworked and the rest to do not approach", () => {
    expect(defaultOutreach("latent_conflict")).toBe("unworked");
    expect(defaultOutreach("hard_conflict")).toBe("do_not_approach");
    expect(defaultOutreach("competitor")).toBe("do_not_approach");
    expect(defaultOutreach("related_party")).toBe("do_not_approach");
    expect(defaultOutreach("excluded")).toBe("do_not_approach");
  });

  it("labels the BREE conflict tiers", () => {
    expect(conflictTierLabel("latent_conflict")).toBe("Latent conflict");
    expect(conflictTierLabel("hard_conflict")).toBe("Hard conflict");
    expect(prospectViewLabel("approachable")).toBe("Approachable");
  });

  it("accepts only the four list views", () => {
    expect(isProspectView("approachable")).toBe(true);
    expect(isProspectView("leads")).toBe(false);
  });

  it("scales score bars against a 0-5 judgement", () => {
    expect(scoreBarWidth(5)).toBe("100%");
    expect(scoreBarWidth(0)).toBe("0%");
    expect(scoreBarWidth(null)).toBe("0%");
  });

  it("keeps the BREE seed as one row per organisation with the expected split", () => {
    const rows = seed.prospects;
    expect(rows).toHaveLength(144);
    expect(new Set(rows.map((row) => row.organisation)).size).toBe(144);
    expect(rows.filter((row) => row.conflictTier === "latent_conflict")).toHaveLength(62);
    expect(rows.filter((row) => row.conflictTier === "hard_conflict")).toHaveLength(63);
    expect(rows.filter((row) => row.sourceList === "excluded")).toHaveLength(15);
    const lq = rows.find((row) => row.id === "l-q-london-and-quadrant-housing-trust");
    expect(lq?.conflictTier).toBe("latent_conflict");
    expect(lq?.valueScore).toBe(92);
  });
});
