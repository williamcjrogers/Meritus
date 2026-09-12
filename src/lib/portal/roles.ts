/** Server-only identity authority. Session claims and cross-request caches never grant access. */
import { clerkClient } from "@clerk/nextjs/server";

export const ROLES = ["director", "client"] as const;
export type Role = (typeof ROLES)[number];
export type Identity = { userId: string; role: Role | null; domain: string | null; email: string | null };
export const IDENTITY_TIMEOUT_MS = 8_000;

export class IdentityUnavailableError extends Error {
  readonly status = 503;
  readonly code = "IDENTITY_UNAVAILABLE";
  constructor() {
    super("We could not verify your access. Please try again.");
    this.name = "IdentityUnavailableError";
  }
}

export function roleFromMetadata(value: unknown): Role | null {
  return value === "director" || value === "client" ? value : null;
}

/** Each protected operation gets current backend metadata, including background worker rechecks. */
export async function resolveIdentity(userId: string, _claims?: unknown): Promise<Identity> {
  void _claims; // Kept for existing callers; claims cannot grant current access.
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const user = await Promise.race([
      (async () => (await clerkClient()).users.getUser(userId))(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new IdentityUnavailableError()), IDENTITY_TIMEOUT_MS);
      }),
    ]);
    const meta = user.publicMetadata ?? {};
    const addresses = user.emailAddresses ?? [];
    const primary = addresses.find(entry => entry.id === user.primaryEmailAddressId);
    return {
      userId,
      role: roleFromMetadata(meta.role),
      domain: typeof meta.domain === "string" && meta.domain ? meta.domain : null,
      email: primary?.verification?.status === "verified" ? primary.emailAddress : null,
    };
  } catch (error) {
    // A confirmed missing account has no entitlement; transport and service errors are unavailable.
    if (error && typeof error === "object" && "status" in error && error.status === 404) {
      return { userId, role: null, domain: null, email: null };
    }
    // Do not log provider bodies: they may contain addresses or ticket values.
    console.warn("Access identity lookup unavailable", error instanceof Error ? error.name : "unknown");
    throw new IdentityUnavailableError();
  } finally {
    clearTimeout(timer);
  }
}
