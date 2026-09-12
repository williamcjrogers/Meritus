/**
 * A client gets in with a Clerk sign-in token: single use, thirty minutes, delivered by Resend.
 * The Clerk user is created on first request with a password nobody sees, so the instance's
 * password requirement is met without a form. Server only.
 */

import { randomBytes } from "node:crypto";
import { clerkClient } from "@clerk/nextjs/server";
import { SITE_CONFIG } from "@/lib/constants";

export const ACCESS_LINK_TTL_SECONDS = 30 * 60;

export type IssueResult =
  | { ok: true; url: string; userId: string }
  | { ok: false; reason: "director" | "unmatched" | "clerk_error" };

export function accessLinkOrigin(): string {
  const raw = process.env.ACCESS_LINK_ORIGIN?.trim() || SITE_CONFIG.url;
  return raw.replace(/\/+$/, "");
}

export function continueUrl(origin: string, token: string): string {
  return `${origin}/access/continue?ticket=${encodeURIComponent(token)}`;
}

export function randomPassword(): string {
  return randomBytes(32).toString("base64url");
}

export async function issueAccessLink(input: {
  email: string;
  domain: string;
  origin?: string;
}): Promise<IssueResult> {
  const email = input.email.trim().toLowerCase();
  const origin = input.origin ?? accessLinkOrigin();
  const metadata = { role: "client", domain: input.domain, email };
  try {
    const client = await clerkClient();
    const { data } = await client.users.getUserList({ emailAddress: [email], limit: 1 });
    const existing = data[0];
    let userId: string;
    if (existing) {
      const meta = (existing.publicMetadata ?? {}) as Record<string, unknown>;
      if (meta.role === "director") return { ok: false, reason: "director" };
      // Only the account whose primary, verified address is the typed one may be reused. A signed-in
      // client can add an unverified address to their own account, so anything else is refused.
      const primary = (existing.emailAddresses ?? []).find((entry) => entry.id === existing.primaryEmailAddressId);
      if (!primary || primary.emailAddress.toLowerCase() !== email || primary.verification?.status !== "verified") {
        return { ok: false, reason: "unmatched" };
      }
      if (meta.role !== "client" || meta.domain !== input.domain) {
        await client.users.updateUserMetadata(existing.id, { publicMetadata: metadata });
      }
      userId = existing.id;
    } else {
      const created = await client.users.createUser({
        emailAddress: [email],
        password: randomPassword(),
        skipPasswordChecks: true,
        publicMetadata: metadata,
      });
      userId = created.id;
    }
    const token = await client.signInTokens.createSignInToken({
      userId,
      expiresInSeconds: ACCESS_LINK_TTL_SECONDS,
    });
    return { ok: true, url: continueUrl(origin, token.token), userId };
  } catch (error) {
    // Clerk error bodies can quote the address, so only the error name is logged.
    console.warn("Access: Clerk unavailable", error instanceof Error ? error.name : "unknown");
    return { ok: false, reason: "clerk_error" };
  }
}
