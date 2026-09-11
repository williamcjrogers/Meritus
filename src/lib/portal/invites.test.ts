import { describe, expect, it } from "vitest";
import {
  CLIENT_INVITE_REDIRECT_URL,
  DIRECTOR_INVITE_REDIRECT_URL,
  inviteRedirectUrl,
} from "./invites";

describe("inviteRedirectUrl", () => {
  it("keeps invitations on www.meritusvia.com", () => {
    expect(inviteRedirectUrl("client")).toBe(CLIENT_INVITE_REDIRECT_URL);
    expect(inviteRedirectUrl("director")).toBe(DIRECTOR_INVITE_REDIRECT_URL);
    expect(CLIENT_INVITE_REDIRECT_URL).toBe("https://www.meritusvia.com/client/sign-up");
    expect(DIRECTOR_INVITE_REDIRECT_URL).toBe("https://www.meritusvia.com/sign-up");
  });
});
