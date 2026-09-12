import { describe, expect, it } from "vitest";
import { decideGate, isClientPath, isPortalPath } from "./gate";

describe("path matchers", () => {
  it("match the portal and its api, and the client desk and its api", () => {
    expect(isPortalPath("/portal")).toBe(true);
    expect(isPortalPath("/portal/clients")).toBe(true);
    expect(isPortalPath("/api/portal/documents/x")).toBe(true);
    expect(isPortalPath("/portfolio")).toBe(false);
    expect(isClientPath("/client")).toBe(true);
    expect(isClientPath("/api/client/uploads")).toBe(true);
    expect(isClientPath("/clients")).toBe(false);
    expect(isClientPath("/access")).toBe(false);
  });
});

describe("decideGate", () => {
  it("lets public paths through whoever asks", () => {
    expect(decideGate({ pathname: "/access", signedIn: false, role: null })).toEqual({ kind: "next" });
    expect(decideGate({ pathname: "/", signedIn: true, role: "client" })).toEqual({ kind: "next" });
  });

  it("sends signed-out visitors to the right door", () => {
    expect(decideGate({ pathname: "/portal", signedIn: false, role: null })).toEqual({ kind: "redirect", to: "/sign-in" });
    expect(decideGate({ pathname: "/client", signedIn: false, role: null })).toEqual({ kind: "redirect", to: "/access" });
    expect(decideGate({ pathname: "/api/portal/library", signedIn: false, role: null })).toEqual({ kind: "json", status: 401, error: "Unauthorized" });
    expect(decideGate({ pathname: "/api/client/uploads", signedIn: false, role: null })).toEqual({ kind: "json", status: 401, error: "Unauthorized" });
  });

  it("admits directors everywhere", () => {
    expect(decideGate({ pathname: "/portal/clients", signedIn: true, role: "director" })).toEqual({ kind: "next" });
    expect(decideGate({ pathname: "/client", signedIn: true, role: "director" })).toEqual({ kind: "next" });
    expect(decideGate({ pathname: "/api/client/uploads", signedIn: true, role: "director" })).toEqual({ kind: "next" });
  });

  it("keeps clients out of the portal and sends them to their desk", () => {
    expect(decideGate({ pathname: "/portal", signedIn: true, role: "client" })).toEqual({ kind: "redirect", to: "/client" });
    expect(decideGate({ pathname: "/api/portal/library", signedIn: true, role: "client" })).toEqual({ kind: "json", status: 403, error: "Directors only" });
    expect(decideGate({ pathname: "/client", signedIn: true, role: "client" })).toEqual({ kind: "next" });
  });

  it("dead-ends a signed-in user with no role", () => {
    expect(decideGate({ pathname: "/portal", signedIn: true, role: null })).toEqual({ kind: "redirect", to: "/access/denied" });
    expect(decideGate({ pathname: "/client", signedIn: true, role: null })).toEqual({ kind: "redirect", to: "/access/denied" });
    expect(decideGate({ pathname: "/api/client/uploads", signedIn: true, role: null })).toEqual({ kind: "json", status: 403, error: "No access" });
  });
});
