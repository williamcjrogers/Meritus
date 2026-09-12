import { describe, expect, it } from "vitest";
import { destinationFor, safeReturnPath } from "./destination";

describe("authorised destinations", () => {
  it("keeps each audience in its own experience", () => {
    expect(destinationFor("client", "/portal/research")).toBe("/client");
    expect(destinationFor("director", "/portal/actions?scope=mine")).toBe("/portal/actions?scope=mine");
    expect(destinationFor("client", "/client?receipt=recent")).toBe("/client?receipt=recent");
    expect(destinationFor(null, "/portal")).toBe("/access/denied");
  });
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "/api/portal", "/portalish", "/portal/../../api/portal", "/portal%2f..%2fapi", "/portal\n", "/portal/%5cevil", "/portal/%250a"])("rejects unsafe target %s", target => {
    expect(destinationFor("director", target)).toBe("/portal");
  });
  it("does not forward a staff member into the client shell", () => {
    expect(destinationFor("director", "/client")).toBe("/portal");
  });
  it("preserves safe local queries for recovery", () => {
    expect(safeReturnPath("/portal/actions?scope=mine")).toBe("/portal/actions?scope=mine");
    expect(safeReturnPath("https://evil.example")).toBeNull();
  });
});
