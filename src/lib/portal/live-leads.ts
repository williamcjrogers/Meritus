import type { Pursuit } from "@/lib/db/schema";
import { readPursuitActions } from "@/lib/db/desk-actions";
import { chooseNextAction } from "@/lib/actions/model";
import type { ActionView } from "@/lib/actions/types";

export type LiveLead = { pursuit: Pursuit; nextAction: ActionView | null; reviewDue: string | null };

export async function readLiveLeads(pursuits: Pursuit[]): Promise<LiveLead[]> {
  const actions = await readPursuitActions(pursuits.map(p => p.id));
  const grouped = new Map<string, ActionView[]>();
  for (const action of actions) {
    if (action.link.kind !== "pursuit") continue;
    const rows = grouped.get(action.link.id) ?? [];
    rows.push(action);
    grouped.set(action.link.id, rows);
  }
  return pursuits.map(pursuit => {
    const rows = grouped.get(pursuit.id) ?? [];
    const selected = chooseNextAction(rows, rows.find(a => a.isPrimary)?.id ?? null);
    return { pursuit, reviewDue: pursuit.reviewDue, nextAction: rows.find(a => a.id === selected?.id) ?? null };
  });
}
