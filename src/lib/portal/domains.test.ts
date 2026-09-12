import { describe, expect, it } from "vitest";
import {
  PUBLIC_MAILBOX_DOMAINS,
  clientDomainErrorMessage,
  domainFromEmail,
  isReservedDirectorDomain,
  normaliseDomain,
  parseClientDomain,
} from "./domains";

describe("normaliseDomain", () => {
  it("trims, lower-cases and strips a leading @", () => {
    expect(normaliseDomain("  @Example-Firm.co.uk  ")).toBe("example-firm.co.uk");
  });
});

describe("domainFromEmail", () => {
  it("returns the host of an address", () => {
    expect(domainFromEmail("Jane@Example-Firm.co.uk")).toBe("example-firm.co.uk");
  });
  it("returns null for nothing, a bare word, or a missing local part", () => {
    expect(domainFromEmail(null)).toBeNull();
    expect(domainFromEmail("")).toBeNull();
    expect(domainFromEmail("not-an-email")).toBeNull();
    expect(domainFromEmail("@example-firm.co.uk")).toBeNull();
  });
});

describe("parseClientDomain", () => {
  it("accepts a plain domain and an address", () => {
    expect(parseClientDomain("example-firm.co.uk")).toEqual({ ok: true, domain: "example-firm.co.uk" });
    expect(parseClientDomain("jane@example-firm.co.uk")).toEqual({ ok: true, domain: "example-firm.co.uk" });
  });
  it("refuses every public mailbox on the list", () => {
    for (const host of PUBLIC_MAILBOX_DOMAINS) {
      expect(parseClientDomain(host)).toEqual({ ok: false, error: "public_mailbox" });
    }
  });
  it("refuses a subdomain of a public mailbox provider", () => {
    expect(parseClientDomain("mail.gmail.com")).toEqual({ ok: false, error: "public_mailbox" });
  });
  it("refuses the firm's own domain and its subdomains", () => {
    expect(parseClientDomain("meritusvia.com")).toEqual({ ok: false, error: "firm_domain" });
    expect(parseClientDomain("mail.meritusvia.com")).toEqual({ ok: false, error: "firm_domain" });
  });
  it("refuses empty and malformed input", () => {
    expect(parseClientDomain("   ")).toEqual({ ok: false, error: "empty" });
    expect(parseClientDomain("localhost")).toEqual({ ok: false, error: "invalid" });
    expect(parseClientDomain("not a domain")).toEqual({ ok: false, error: "invalid" });
  });
});

describe("isReservedDirectorDomain", () => {
  it("is true only for meritusvia.com and its subdomains", () => {
    expect(isReservedDirectorDomain("meritusvia.com")).toBe(true);
    expect(isReservedDirectorDomain("x.meritusvia.com")).toBe(true);
    expect(isReservedDirectorDomain("meritusvia.co.uk")).toBe(false);
  });
});

describe("clientDomainErrorMessage", () => {
  it("names the example domain and never mentions BREE", () => {
    const messages = (["empty", "invalid", "public_mailbox", "firm_domain"] as const).map(clientDomainErrorMessage);
    expect(messages.join(" ")).toMatch(/example-firm\.co\.uk/);
    expect(messages.join(" ")).not.toMatch(/bree/i);
  });
});
