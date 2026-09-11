import { parseClientDomain } from "@/lib/portal/domains";

export function normaliseClientEmail(value: string): string {
  return value.trim().toLowerCase();
}

export type ClientInviteParseResult = { ok: true; email: string } | { ok: false; error: string };

export function parseClientInviteInput(input: { email: string }): ClientInviteParseResult {
  const email = normaliseClientEmail(input.email);
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Enter the client’s email address." };
  }
  const domain = parseClientDomain(email.slice(email.indexOf("@") + 1));
  if (!domain.ok) {
    switch (domain.error) {
      case "empty":
      case "invalid":
        return { ok: false, error: "Enter a valid company email address." };
      case "public_mailbox":
        return { ok: false, error: "Public mailbox addresses cannot be invited." };
      case "firm_domain":
        return { ok: false, error: "meritusvia.com is reserved for directors." };
      default: {
        const exhaustive: never = domain.error;
        return exhaustive;
      }
    }
  }

  return { ok: true, email };
}

type ClerkEmail = { emailAddress: string; id?: string };

export function clerkPrimaryEmail(
  user:
    | {
        primaryEmailAddress?: { emailAddress: string } | null;
        emailAddresses?: ReadonlyArray<ClerkEmail>;
        primaryEmailAddressId?: string | null;
      }
    | null
    | undefined
): string {
  const primary = user?.primaryEmailAddress?.emailAddress?.trim();
  if (primary) return normaliseClientEmail(primary);
  const addresses = user?.emailAddresses ?? [];
  const byId = addresses.find((address) => address.id && address.id === user?.primaryEmailAddressId);
  const raw = byId?.emailAddress ?? addresses[0]?.emailAddress ?? "";
  return raw ? normaliseClientEmail(raw) : "";
}

export function isReusableInvitationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("already exists") ||
    message.includes("already invited") ||
    message.includes("duplicate") ||
    message.includes("pending invitation")
  );
}

export function invitationErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "Clerk could not send the invitation. Check the email and try again.";
}
