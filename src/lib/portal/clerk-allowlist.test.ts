import { describe, expect, it } from "vitest";
import { allowlistIdentifierFor, allowlistPageNote } from "./clerk-allowlist";

describe("allowlistIdentifierFor", () => {
  it("builds a Clerk domain identifier", () => {
    expect(allowlistIdentifierFor("bree.co.uk")).toBe("*@bree.co.uk");
  });
});

describe("allowlistPageNote", () => {
  it("is silent when the identifier was accepted", () => {
    expect(allowlistPageNote({ status: "added" })).toBeNull();
    expect(allowlistPageNote({ status: "exists" })).toBeNull();
  });

  it("tells directors first-time users still need an invite when Clerk refuses", () => {
    expect(allowlistPageNote({ status: "unavailable", reason: "402" })).toMatch(
      /invite \(or an allowlist\)/i
    );
  });
});
