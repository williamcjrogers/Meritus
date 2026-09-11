import { SITE_CONFIG } from "@/lib/constants";
import type { ActorKind } from "./roles";

/** Invitation landing pages on this site. Do not send people to another hostname. */
export const CLIENT_INVITE_REDIRECT_URL = `${SITE_CONFIG.url}/client/sign-up`;
export const DIRECTOR_INVITE_REDIRECT_URL = `${SITE_CONFIG.url}/sign-up`;

export function inviteRedirectUrl(kind: ActorKind): string {
  switch (kind) {
    case "client":
      return CLIENT_INVITE_REDIRECT_URL;
    case "director":
      return DIRECTOR_INVITE_REDIRECT_URL;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}
