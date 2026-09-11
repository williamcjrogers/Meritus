"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import {
  invitationErrorMessage,
  isReusableInvitationError,
  parseClientInviteInput,
} from "@/lib/client/invite";
import { createClientDomain, deleteClientDomain, findClientDomain } from "@/lib/db/client-domains";
import { allowlistPageNote, tryAllowlistClientDomain, type AllowlistOutcome } from "./clerk-allowlist";
import { requireActionUser } from "./auth";
import { clientDomainErrorMessage, parseClientDomain } from "./domains";
import { __resetDirectorsCache } from "./directors";
import { CLIENT_INVITE_REDIRECT_URL } from "./invites";

export type AddClientDomainState =
  | { ok: true; allowlist: AllowlistOutcome; allowlistNote: string | null }
  | { ok: false; error: string }
  | null;

export type InviteClientState = { ok: true } | { ok: false; error: string } | null;

type Failure = { ok: false; error: string };

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function refresh(): void {
  __resetDirectorsCache();
  revalidatePath("/portal", "layout");
  revalidatePath("/portal/clients");
  revalidatePath("/client");
}

export async function addClientDomainAction(
  _prev: AddClientDomainState,
  formData: FormData
): Promise<AddClientDomainState> {
  const user = await requireActionUser();
  if (!user.ok) return user;

  const parsed = parseClientDomain(String(formData.get("domain") ?? ""));
  if (!parsed.ok) return { ok: false, error: clientDomainErrorMessage(parsed.error) };

  const existing = await findClientDomain(parsed.domain);
  if (existing) return { ok: false, error: "That domain is already listed" };

  try {
    await createClientDomain({
      domain: parsed.domain,
      vericaseWorkspaceId: emptyToNull(formData.get("vericaseWorkspaceId")),
      vericaseWorkspaceName: emptyToNull(formData.get("vericaseWorkspaceName")),
      createdBy: user.userId,
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "That domain is already listed" };
    console.error("[portal] addClientDomain failed", error);
    return { ok: false, error: "Something went wrong, try again" };
  }

  const allowlist = await tryAllowlistClientDomain(parsed.domain);
  refresh();
  return { ok: true, allowlist, allowlistNote: allowlistPageNote(allowlist) };
}

export async function removeClientDomainAction(formData: FormData): Promise<Failure | { ok: true }> {
  const user = await requireActionUser();
  if (!user.ok) return user;

  const id = String(formData.get("id") ?? "");
  if (!id || id.length > 64) return { ok: false, error: "That domain is no longer listed" };

  try {
    await deleteClientDomain(id);
  } catch (error) {
    console.error("[portal] removeClientDomain failed", error);
    return { ok: false, error: "Something went wrong, try again" };
  }

  refresh();
  return { ok: true };
}

export async function removeClientDomain(id: string): Promise<Failure | { ok: true }> {
  const data = new FormData();
  data.set("id", id);
  return removeClientDomainAction(data);
}

export async function inviteClient(input: { email: string }): Promise<{ ok: true } | Failure> {
  const user = await requireActionUser();
  if (!user.ok) return user;

  const parsed = parseClientInviteInput(input);
  if (!parsed.ok) return parsed;

  try {
    const client = await clerkClient();
    await client.invitations.createInvitation({
      emailAddress: parsed.email,
      publicMetadata: { role: "client" },
      notify: true,
      redirectUrl: CLIENT_INVITE_REDIRECT_URL,
    });
  } catch (error) {
    if (!isReusableInvitationError(error)) {
      console.error("[portal] inviteClient Clerk invitation failed", error);
      return { ok: false, error: invitationErrorMessage(error) };
    }
  }

  refresh();
  return { ok: true };
}

export async function inviteClientAction(
  _prev: InviteClientState,
  formData: FormData
): Promise<InviteClientState> {
  return inviteClient({
    email: String(formData.get("email") ?? ""),
  });
}
