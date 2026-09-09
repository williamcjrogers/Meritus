/**
 * Pure helpers over the directors list. This module has no server dependency,
 * so client components may import it. The Clerk-backed loader lives in
 * "./directors", which re-exports everything here for server code.
 */

export type Director = { id: string; name: string; email: string; initials: string };

/** Placeholder initials for a pursuit nobody owns (an en dash, never an em dash). */
export const UNASSIGNED_INITIALS = "–";
export const UNASSIGNED_NAME = "Unassigned";

function firstLetter(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed.charAt(0) : "";
}

/**
 * First letters of the first and last names (a single letter when only one is
 * known), else the first two letters of the email's local part, upper-cased.
 */
export function initialsFor(user: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}): string {
  const fromNames = `${firstLetter(user.firstName)}${firstLetter(user.lastName)}`;
  if (fromNames) return fromNames.toUpperCase();
  const localPart = (user.email ?? "").trim().split("@")[0] ?? "";
  return localPart.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2).toUpperCase();
}

function findDirector(directors: Director[], id: string | null | undefined): Director | null {
  if (!id) return null;
  return directors.find((director) => director.id === id) ?? null;
}

export function directorInitials(directors: Director[], id: string | null | undefined): string {
  return findDirector(directors, id)?.initials || UNASSIGNED_INITIALS;
}

export function directorName(directors: Director[], id: string | null | undefined): string {
  return findDirector(directors, id)?.name || UNASSIGNED_NAME;
}
