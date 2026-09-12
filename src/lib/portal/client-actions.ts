"use server";

import { revalidatePath } from "next/cache";
import {
  findClientDomainByName,
  insertClientDomain,
  reactivateClientDomain,
  removeClientDomain,
  setClientDomainPursuit,
} from "@/lib/db/client-domains";
import { getPursuit } from "@/lib/db/pursuits";
import { requireActionUser } from "./auth";
import { clientDomainErrorMessage, parseClientDomain } from "./domains";
import type { ActionResult } from "./types";

export type AddClientDomainState = { ok: true; domain: string } | { ok: false; error: string } | null;

const GONE = "That domain is no longer listed";

function refresh(): void {
  revalidatePath("/portal", "layout");
  revalidatePath("/client");
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 64;
}

export async function addClientDomainAction(_prev: AddClientDomainState, formData: FormData): Promise<AddClientDomainState> {
  try {
    const user = await requireActionUser();
    if (!user.ok) return { ok: false, error: user.error };

    const parsed = parseClientDomain(String(formData.get("domain") ?? ""));
    if (!parsed.ok) return { ok: false, error: clientDomainErrorMessage(parsed.error) };
    const firm = String(formData.get("firm") ?? "").trim().slice(0, 200);
    if (!firm) return { ok: false, error: "Enter the firm's name" };
    const pursuitRaw = String(formData.get("pursuitId") ?? "").trim();
    const pursuitId = pursuitRaw ? pursuitRaw : null;
    if (pursuitId && !(await getPursuit(pursuitId))) return { ok: false, error: "That pursuit no longer exists" };

    const existing = await findClientDomainByName(parsed.domain);
    if (existing && !existing.removedAt) return { ok: false, error: "That domain is already listed" };
    if (existing) {
      await reactivateClientDomain(existing.id, { firm, pursuitId });
    } else {
      await insertClientDomain({ id: crypto.randomUUID(), domain: parsed.domain, firm, pursuitId, createdBy: user.userId });
    }
    return { ok: true, domain: parsed.domain };
  } catch (error) {
    console.error("[portal] addClientDomain failed", error);
    return { ok: false, error: "Something went wrong, try again" };
  } finally {
    refresh();
  }
}

export async function removeClientDomainAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireActionUser();
    if (!user.ok) return user;
    if (!isId(id)) return { ok: false, error: GONE };
    return (await removeClientDomain(id)) ? { ok: true } : { ok: false, error: GONE };
  } catch (error) {
    console.error("[portal] removeClientDomain failed", error);
    return { ok: false, error: "Something went wrong, try again" };
  } finally {
    refresh();
  }
}

export async function linkClientDomainAction(id: string, pursuitId: string | null): Promise<ActionResult> {
  try {
    const user = await requireActionUser();
    if (!user.ok) return user;
    if (!isId(id)) return { ok: false, error: GONE };
    if (pursuitId !== null && (!isId(pursuitId) || !(await getPursuit(pursuitId)))) {
      return { ok: false, error: "That pursuit no longer exists" };
    }
    const row = await setClientDomainPursuit(id, pursuitId);
    return row ? { ok: true } : { ok: false, error: GONE };
  } catch (error) {
    console.error("[portal] linkClientDomain failed", error);
    return { ok: false, error: "Something went wrong, try again" };
  } finally {
    refresh();
  }
}
