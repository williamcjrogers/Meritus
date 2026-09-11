import { describe, expect, it } from "vitest";
import {
  clientDomainErrorMessage,
  domainFromEmail,
  domainInput,
  emailMatchesClientDomain,
  isPublicMailboxDomain,
  isReservedDirectorDomain,
  normaliseDomain,
  parseClientDomain,
} from "./domains";

describe("normaliseDomain", () => {
  it("strips a leading @, lowercases and trims", () => {
    expect(normaliseDomain("  @BREE.co.uk  ")).toBe("bree.co.uk");
    expect(normaliseDomain("bree.co.uk")).toBe("bree.co.uk");
    expect(normaliseDomain("@bree.co.uk")).toBe("bree.co.uk");
  });
});

describe("domainInput", () => {
  it("treats a bare host and an @host as the same", () => {
    expect(domainInput("bree.co.uk")).toBe("bree.co.uk");
    expect(domainInput("@bree.co.uk")).toBe("bree.co.uk");
  });

  it("takes the host from a full email", () => {
    expect(domainInput("Jane@BREE.co.uk")).toBe("bree.co.uk");
  });
});

describe("domainFromEmail", () => {
  it("returns the host in lowercase", () => {
    expect(domainFromEmail("Jane@BREE.co.uk")).toBe("bree.co.uk");
  });

  it("is null when there is no usable host", () => {
    expect(domainFromEmail(null)).toBeNull();
    expect(domainFromEmail("")).toBeNull();
    expect(domainFromEmail("not-an-email")).toBeNull();
    expect(domainFromEmail("@bree.co.uk")).toBeNull();
  });
});

describe("parseClientDomain", () => {
  it("accepts a company domain", () => {
    expect(parseClientDomain("@bree.co.uk")).toEqual({ ok: true, domain: "bree.co.uk" });
  });

  it("refuses public mailbox domains", () => {
    for (const domain of [
      "gmail.com",
      "googlemail.com",
      "outlook.com",
      "hotmail.com",
      "live.com",
      "yahoo.com",
      "icloud.com",
      "me.com",
      "aol.com",
      "proton.me",
      "protonmail.com",
    ]) {
      expect(parseClientDomain(domain)).toEqual({ ok: false, error: "public_mailbox" });
      expect(isPublicMailboxDomain(domain)).toBe(true);
    }
  });

  it("refuses meritusvia.com so directors cannot be classified as clients", () => {
    expect(parseClientDomain("meritusvia.com")).toEqual({ ok: false, error: "firm_domain" });
    expect(parseClientDomain("@meritusvia.com")).toEqual({ ok: false, error: "firm_domain" });
    expect(parseClientDomain("mail.meritusvia.com")).toEqual({ ok: false, error: "firm_domain" });
    expect(isReservedDirectorDomain("meritusvia.com")).toBe(true);
  });

  it("refuses empty or shapeless input", () => {
    expect(parseClientDomain("")).toEqual({ ok: false, error: "empty" });
    expect(parseClientDomain("   ")).toEqual({ ok: false, error: "empty" });
    expect(parseClientDomain("localhost")).toEqual({ ok: false, error: "invalid" });
    expect(parseClientDomain("not a domain")).toEqual({ ok: false, error: "invalid" });
  });
});

describe("emailMatchesClientDomain", () => {
  it("matches a listed company domain", () => {
    expect(emailMatchesClientDomain("jane@bree.co.uk", ["bree.co.uk"])).toBe(true);
    expect(emailMatchesClientDomain("jane@other.co.uk", ["bree.co.uk"])).toBe(false);
  });

  it("never matches meritusvia.com even if it appears on the list", () => {
    expect(emailMatchesClientDomain("mateo@meritusvia.com", ["meritusvia.com"])).toBe(false);
  });
});

describe("clientDomainErrorMessage", () => {
  it("names each refusal", () => {
    expect(clientDomainErrorMessage("empty")).toMatch(/domain/i);
    expect(clientDomainErrorMessage("invalid")).toMatch(/bree\.co\.uk/);
    expect(clientDomainErrorMessage("public_mailbox")).toMatch(/Public mailbox/);
    expect(clientDomainErrorMessage("firm_domain")).toMatch(/meritusvia\.com/);
  });
});
