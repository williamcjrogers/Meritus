import { describe, expect, it } from "vitest";
import {
  clerkPrimaryEmail,
  invitationErrorMessage,
  isReusableInvitationError,
  normaliseClientEmail,
  parseClientInviteInput,
} from "./invite";

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

describe("parseClientInviteInput", () => {
  it("normalises a company email", () => {
    expect(parseClientInviteInput({ email: " Jane@BREE.co.uk " })).toEqual({
      ok: true,
      email: "jane@bree.co.uk",
    });
  });

  it("refuses a missing email", () => {
    expect(parseClientInviteInput({ email: " " })).toEqual({
      ok: false,
      error: "Enter the client’s email address.",
    });
  });

  it("refuses public mailboxes and meritusvia.com", () => {
    expect(parseClientInviteInput({ email: "jane@gmail.com" })).toEqual({
      ok: false,
      error: "Public mailbox addresses cannot be invited.",
    });
    expect(parseClientInviteInput({ email: "mateo@meritusvia.com" })).toEqual({
      ok: false,
      error: "meritusvia.com is reserved for directors.",
    });
  });
});

describe("invitation errors", () => {
  it("treats a duplicate invite as reusable", () => {
    expect(isReusableInvitationError(new Error("Invitation already exists"))).toBe(true);
    expect(isReusableInvitationError(new Error("network"))).toBe(false);
  });

  it("surfaces the Clerk message when present", () => {
    expect(invitationErrorMessage(new Error("Quota exceeded"))).toBe("Quota exceeded");
    expect(invitationErrorMessage("nope")).toBe(
      "Clerk could not send the invitation. Check the email and try again."
    );
  });
});
