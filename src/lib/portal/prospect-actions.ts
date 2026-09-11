"use server";

import { revalidatePath } from "next/cache";
import { createPursuitWithEnquiry } from "@/lib/db/pursuits";
import { getProspect, updateProspect } from "@/lib/db/prospects";
import type { NewPursuit } from "@/lib/db/schema";
import { isProspectOutreach } from "@/lib/prospects/model";
import { requireActionUser } from "./auth";
import type { ActionResult, CreateResult } from "./types";

type Failure = { ok: false; error: string };

async function guarded<R extends { ok: boolean }>(
  name: string,
  handler: (userId: string) => Promise<R | Failure>
): Promise<R | Failure> {
  try {
    const user = await requireActionUser();
    if (!user.ok) return user;
    return await handler(user.userId);
  } catch (error) {
    console.error(`[portal] ${name} failed`, error);
    return { ok: false, error: "Something went wrong, try again" };
  } finally {
    revalidatePath("/portal", "layout");
  }
}

export async function saveProspectOutreach(
  id: string,
  outreachStatus: string
): Promise<ActionResult> {
  return guarded("saveProspectOutreach", async () => {
    if (!isProspectOutreach(outreachStatus)) {
      return { ok: false, error: "Choose a valid outreach status" };
    }
    const updated = await updateProspect(id, { outreachStatus });
    if (!updated) return { ok: false, error: "This prospect no longer exists" };
    return { ok: true };
  });
}

export async function saveProspectNotes(id: string, partnerNotes: string): Promise<ActionResult> {
  return guarded("saveProspectNotes", async () => {
    const updated = await updateProspect(id, {
      partnerNotes: partnerNotes.trim() || null,
    });
    if (!updated) return { ok: false, error: "This prospect no longer exists" };
    return { ok: true };
  });
}

export async function openProspectAsPursuit(id: string): Promise<CreateResult> {
  return guarded<CreateResult>("openProspectAsPursuit", async (userId) => {
    const prospect = await getProspect(id);
    if (!prospect) return { ok: false, error: "This prospect no longer exists" };
    if (prospect.convertedPursuitId) {
      return { ok: true, id: prospect.convertedPursuitId };
    }

    const pursuitId = crypto.randomUUID();
    const now = new Date();
    const summary = [prospect.whyTheyNeedYou, prospect.routeInNote].filter(Boolean).join("\n\n");
    const values: NewPursuit = {
      id: pursuitId,
      firm: prospect.organisation,
      source: "other",
      sourceDetail: "Prospects · BREE ranking",
      summary: summary || null,
      ownerId: userId,
      stage: "enquiry",
      stageChangedAt: now,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    await createPursuitWithEnquiry(values, {
      kind: "created",
      actorId: userId,
      body: `Opened from prospect ranking: ${prospect.organisation}`,
    });

    await updateProspect(id, {
      outreachStatus: "converted",
      convertedPursuitId: pursuitId,
    });

    return { ok: true, id: pursuitId };
  });
}
