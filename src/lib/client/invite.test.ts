import { describe, expect, it } from "vitest";
import { clerkPrimaryEmail, normaliseClientEmail } from "./invite";

describe("normaliseClientEmail", () => {
  it("trims and lower-cases", () => {
    expect(normaliseClientEmail(" Jane@Firm.COM ")).toBe("jane@firm.com");
  });
});

describe("clerkPrimaryEmail", () => {
  it("prefers the primary address", () => {
    expect(
      clerkPrimaryEmail({
        primaryEmailAddress: { emailAddress: " Jane@Firm.COM " },
        emailAddresses: [{ emailAddress: "other@firm.com" }],
      })
    ).toBe("jane@firm.com");
  });

  it("falls back to the first address", () => {
    expect(clerkPrimaryEmail({ emailAddresses: [{ emailAddress: "Other@Firm.com" }] })).toBe(
      "other@firm.com"
    );
  });

  it("is empty when nothing is known", () => {
    expect(clerkPrimaryEmail(null)).toBe("");
    expect(clerkPrimaryEmail({})).toBe("");
  });
});
