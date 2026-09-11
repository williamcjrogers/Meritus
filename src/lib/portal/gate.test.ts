import { describe, expect, it } from "vitest";
import { isAuthGatedPath, shouldSendClientToDesk } from "./gate";

describe("isAuthGatedPath", () => {
  it("protects the desk and its APIs", () => {
    expect(isAuthGatedPath("/portal")).toBe(true);
    expect(isAuthGatedPath("/portal/clients")).toBe(true);
    expect(isAuthGatedPath("/api/portal/library")).toBe(true);
    expect(isAuthGatedPath("/client")).toBe(true);
  });

  it("leaves Clerk widgets and the public site open", () => {
    expect(isAuthGatedPath("/client/sign-in")).toBe(false);
    expect(isAuthGatedPath("/client/sign-up")).toBe(false);
    expect(isAuthGatedPath("/sign-in")).toBe(false);
    expect(isAuthGatedPath("/")).toBe(false);
  });
});

describe("shouldSendClientToDesk", () => {
  it("sends a client away from /portal and /api/portal", () => {
    expect(shouldSendClientToDesk("client", "/portal")).toBe(true);
    expect(shouldSendClientToDesk("client", "/portal/clients")).toBe(true);
    expect(shouldSendClientToDesk("client", "/api/portal/library")).toBe(true);
  });

  it("leaves directors and unknown actors on /portal", () => {
    expect(shouldSendClientToDesk("director", "/portal")).toBe(false);
    expect(shouldSendClientToDesk(null, "/portal")).toBe(false);
    expect(shouldSendClientToDesk("client", "/client")).toBe(false);
  });
});
