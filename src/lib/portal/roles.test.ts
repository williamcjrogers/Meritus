import { describe, expect, it } from "vitest";
import { actorKindFromMetadata, actorKindFromSignals, actorKindLabel, allowPortalAccess, isClientRole } from "./roles";

describe("actorKindFromMetadata", () => {
  it("treats an explicit client role as a client", () => {
    expect(actorKindFromMetadata("client")).toBe("client");
    expect(isClientRole("client")).toBe(true);
  });

  it("treats missing or director metadata as a director", () => {
    expect(actorKindFromMetadata(undefined)).toBe("director");
    expect(actorKindFromMetadata(null)).toBe("director");
    expect(actorKindFromMetadata("")).toBe("director");
    expect(actorKindFromMetadata("director")).toBe("director");
    expect(isClientRole(undefined)).toBe(false);
  });
});

describe("actorKindFromSignals", () => {
  it("treats a listed company domain as a client", () => {
    expect(
      actorKindFromSignals({ role: undefined, email: "jane@bree.co.uk", clientDomains: ["bree.co.uk"] })
    ).toBe("client");
  });

  it("treats an explicit client role as a client even without a listed domain", () => {
    expect(
      actorKindFromSignals({ role: "client", email: "jane@firm.com", clientDomains: [] })
    ).toBe("client");
  });

  it("keeps meritusvia.com directors on the desk even if the domain is listed", () => {
    expect(
      actorKindFromSignals({
        role: undefined,
        email: "mateo@meritusvia.com",
        clientDomains: ["meritusvia.com"],
      })
    ).toBe("director");
  });

  it("keeps a director whose domain is not on the list", () => {
    expect(
      actorKindFromSignals({ role: undefined, email: "william@meritusvia.com", clientDomains: ["bree.co.uk"] })
    ).toBe("director");
  });
});

describe("actorKindLabel", () => {
  it("names each kind", () => {
    expect(actorKindLabel("director")).toBe("Director");
    expect(actorKindLabel("client")).toBe("Client");
  });
});

describe("allowPortalAccess", () => {
  it("lets directors through", () => {
    expect(allowPortalAccess("director")).toBe(true);
  });

  it("lets an unknown kind through so a Clerk outage does not lock the desk", () => {
    expect(allowPortalAccess(null)).toBe(true);
  });

  it("keeps clients off the pursuit desk", () => {
    expect(allowPortalAccess("client")).toBe(false);
  });
});
