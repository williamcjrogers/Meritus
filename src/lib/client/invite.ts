export function normaliseClientEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function clerkPrimaryEmail(
  user:
    | {
        primaryEmailAddress?: { emailAddress: string } | null;
        emailAddresses?: ReadonlyArray<{ emailAddress: string }>;
      }
    | null
    | undefined
): string {
  const primary = user?.primaryEmailAddress?.emailAddress?.trim();
  if (primary) return normaliseClientEmail(primary);
  const first = user?.emailAddresses?.[0]?.emailAddress?.trim();
  return first ? normaliseClientEmail(first) : "";
}
