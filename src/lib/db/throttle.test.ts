// @vitest-environment node
import { describe, expect, it } from "vitest";
import { EMAIL_CAP, GLOBAL_CAP, IP_CAP, decideThrottle } from "./throttle";

describe("decideThrottle", () => {
  it("allows everything at the caps", () => {
    expect(decideThrottle({ email: EMAIL_CAP, ip: IP_CAP, global: GLOBAL_CAP })).toEqual({
      emailAllowed: true,
      ipAllowed: true,
      alertAllowed: true,
    });
  });

  it("blocks the email one above its daily cap", () => {
    expect(decideThrottle({ email: EMAIL_CAP + 1, ip: 1, global: 1 }).emailAllowed).toBe(false);
  });

  it("blocks the address one above its hourly cap", () => {
    expect(decideThrottle({ email: 1, ip: IP_CAP + 1, global: 1 }).ipAllowed).toBe(false);
  });

  it("only withholds the alert above the global cap", () => {
    const verdict = decideThrottle({ email: 1, ip: 1, global: GLOBAL_CAP + 1 });
    expect(verdict).toEqual({ emailAllowed: true, ipAllowed: true, alertAllowed: false });
  });

  it("fixes the caps at 5, 20 and 60", () => {
    expect([EMAIL_CAP, IP_CAP, GLOBAL_CAP]).toEqual([5, 20, 60]);
  });
});
