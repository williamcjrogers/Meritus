import { emailMatchesClientDomain } from "./domains";

export const ACTOR_KINDS = ["director", "client"] as const;
export type ActorKind = (typeof ACTOR_KINDS)[number];

/**
 * Clerk public_metadata.role. Existing users have no role and are directors.
 * Clients may also be invited with { role: "client" }. Company domains are
 * the membership list; metadata is the explicit override.
 */
export function actorKindFromMetadata(role: unknown): ActorKind {
  if (role === "client") return "client";
  if (role === "director" || role == null || role === "") return "director";
  return "director";
}

export function isClientRole(role: unknown): boolean {
  return actorKindFromMetadata(role) === "client";
}

/**
 * Client if the Clerk role is client or the email host is on client_domains.
 * meritusvia.com never matches a domain, so directors stay on /portal.
 */
export function actorKindFromSignals(input: {
  role: unknown;
  email?: string | null;
  clientDomains: readonly string[];
}): ActorKind {
  if (isClientRole(input.role)) return "client";
  if (emailMatchesClientDomain(input.email, input.clientDomains)) return "client";
  return "director";
}

export function actorKindLabel(kind: ActorKind): string {
  switch (kind) {
    case "director":
      return "Director";
    case "client":
      return "Client";
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

/**
 * Clients never use the pursuit desk. Null (Clerk down, unknown user) must not
 * lock directors out of /portal.
 */
export function allowPortalAccess(kind: ActorKind | null): boolean {
  return kind !== "client";
}
