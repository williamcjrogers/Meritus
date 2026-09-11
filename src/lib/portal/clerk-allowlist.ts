import { clerkClient } from "@clerk/nextjs/server";
import { isClerkConfigured } from "@/lib/env";

export const ALLOWLIST_STATUSES = ["added", "exists", "unavailable"] as const;
export type AllowlistStatus = (typeof ALLOWLIST_STATUSES)[number];

export type AllowlistOutcome =
  | { status: "added" }
  | { status: "exists" }
  | { status: "unavailable"; reason: string };

function clerkStatus(error: unknown): number | null {
  if (error && typeof error === "object" && "status" in error && typeof error.status === "number") {
    return error.status;
  }
  return null;
}

function clerkCodes(error: unknown): string[] {
  if (!error || typeof error !== "object" || !("errors" in error) || !Array.isArray(error.errors)) {
    return [];
  }
  return error.errors
    .map((entry) => (entry && typeof entry === "object" && "code" in entry ? String(entry.code) : ""))
    .filter(Boolean);
}

function isDuplicate(error: unknown): boolean {
  const codes = clerkCodes(error);
  if (codes.some((code) => code.includes("duplicate") || code.includes("exists") || code === "identifier_exists")) {
    return true;
  }
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("already") || message.includes("duplicate");
}

export function allowlistIdentifierFor(domain: string): string {
  return `*@${domain}`;
}

/**
 * Best-effort Clerk allowlist for a company domain. Invite-only stays on;
 * a 402 or any other failure is reported so the Clients page can say
 * first-time users still need an invite.
 */
export async function tryAllowlistClientDomain(domain: string): Promise<AllowlistOutcome> {
  if (!isClerkConfigured()) {
    return { status: "unavailable", reason: "Clerk is not configured" };
  }
  try {
    const client = await clerkClient();
    await client.allowlistIdentifiers.createAllowlistIdentifier({
      identifier: allowlistIdentifierFor(domain),
      notify: false,
    });
    return { status: "added" };
  } catch (error) {
    if (isDuplicate(error)) return { status: "exists" };
    const status = clerkStatus(error);
    const reason = error instanceof Error ? error.message : "Allowlist request failed";
    if (status === 402) {
      return { status: "unavailable", reason: "Clerk allowlist is not enabled on this plan" };
    }
    return { status: "unavailable", reason };
  }
}

export function allowlistPageNote(outcome: AllowlistOutcome): string | null {
  switch (outcome.status) {
    case "added":
    case "exists":
      return null;
    case "unavailable":
      return "Clerk did not accept a domain allowlist identifier. First-time users still need a Clerk invite (or an allowlist) until that is enabled. Partner invite-only is unchanged.";
    default: {
      const exhaustive: never = outcome;
      return exhaustive;
    }
  }
}
