import { describe, expect, it } from "vitest";
import {
  APPROACHABLE_TIERS,
  conflictTierHint,
  conflictTierLabel,
  defaultOutreach,
  isProspectView,
  prospectViewDescription,
  prospectViewLabel,
  scoreBarWidth,
} from "./model";
import seed from "./bree-seed.json";

describe("prospect ranking model", () => {
  it("defaults ranked firms to unworked and non-clients to do not approach", () => {
    expect(defaultOutreach("latent_conflict")).toBe("unworked");
    expect(defaultOutreach("hard_conflict")).toBe("unworked");
    expect(defaultOutreach("related_party")).toBe("unworked");
    expect(defaultOutreach("other")).toBe("unworked");
    expect(defaultOutreach("competitor")).toBe("do_not_approach");
    expect(defaultOutreach("excluded")).toBe("do_not_approach");
  });

  it("labels ranking categories without BREE conflict language", () => {
    expect(conflictTierLabel("latent_conflict")).toBe("Ranked");
    expect(conflictTierLabel("hard_conflict")).toBe("Ranked");
    expect(conflictTierLabel("related_party")).toBe("Ranked");
    expect(conflictTierLabel("competitor")).toBe("Competitor / adviser");
    expect(prospectViewLabel("approachable")).toBe("Approachable");
    expect(prospectViewDescription("approachable")).toMatch(/need, gap, capacity and access/);
    for (const tier of [
      "hard_conflict",
      "latent_conflict",
      "related_party",
      "competitor",
      "excluded",
      "other",
    ] as const) {
      expect(conflictTierHint(tier)).not.toMatch(/BREE/i);
      expect(conflictTierHint(tier)).not.toMatch(/conflict check/i);
    }
  });

  it("accepts only the three list views", () => {
    expect(isProspectView("approachable")).toBe(true);
    expect(isProspectView("all")).toBe(true);
    expect(isProspectView("excluded")).toBe(true);
    expect(isProspectView("conflicted")).toBe(false);
    expect(isProspectView("leads")).toBe(false);
  });

  it("scales score bars against a 0-5 judgement", () => {
    expect(scoreBarWidth(5)).toBe("100%");
    expect(scoreBarWidth(0)).toBe("0%");
    expect(scoreBarWidth(null)).toBe("0%");
  });

  it("keeps one row per organisation and ranks former tracker-conflict firms as approachable", () => {
    const rows = seed.prospects;
    expect(rows).toHaveLength(144);
    expect(new Set(rows.map((row) => row.organisation)).size).toBe(144);
    expect(rows.filter((row) => row.conflictTier === "hard_conflict")).toHaveLength(0);
    expect(rows.filter((row) => row.conflictTier === "related_party")).toHaveLength(0);
    expect(
      rows.filter((row) =>
        (APPROACHABLE_TIERS as readonly string[]).includes(row.conflictTier)
      )
    ).toHaveLength(127);
    expect(rows.filter((row) => row.conflictTier === "competitor")).toHaveLength(2);
    expect(rows.filter((row) => row.sourceList === "excluded")).toHaveLength(15);
    const lq = rows.find((row) => row.id === "l-q-london-and-quadrant-housing-trust");
    expect(lq?.conflictTier).toBe("latent_conflict");
    expect(lq?.valueScore).toBe(92);
    expect(seed.title).toBe("Meritus prospect ranking");
    const blob = JSON.stringify(seed);
    expect(blob).not.toMatch(/BREE prospect ranking/);
    expect(blob).not.toMatch(/BREE is adverse/i);
    expect(blob).not.toMatch(/conflict check required/i);
    expect(blob).not.toMatch(/internal work rather than a prospect/i);
    expect(blob).not.toMatch(/Reachable only after the BREE portfolio/i);
    expect(blob).not.toMatch(/instructed on the BREE side/i);
    expect(blob).not.toMatch(/BREE-lineage/i);
    expect(blob).not.toMatch(/treat as conflicted/i);
    expect(blob).not.toMatch(/Latent conflict via/i);
  });
});
