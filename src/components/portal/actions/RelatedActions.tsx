"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionEditor } from "./ActionEditor";
import { ActionRow } from "./ActionRow";
import { completeDeskAction } from "@/lib/actions/server";
import type { ActionView, WorkLink } from "@/lib/actions/types";
import type { DirectorDirectory } from "@/lib/portal/directors";
export function RelatedActions({ link, rows, directory }: { link: WorkLink; rows: ActionView[]; directory: DirectorDirectory }) {
  const router = useRouter();
  const [editor, setEditor] = useState<{ action: ActionView | null } | null>(null);
  async function complete(action: ActionView, requestId?: string) { const result = await completeDeskAction(action.id, action.version, requestId ?? crypto.randomUUID()); if (result.ok) router.refresh(); return result; }
  return <section className="action-register related-actions" aria-label="Related actions"><header><h2>Actions</h2><button type="button" onClick={() => setEditor({ action: null })}>Add action</button></header><ul className="action-list">{rows.map(action => <ActionRow key={action.id} action={action} onEdit={action => setEditor({ action })} onComplete={complete} />)}</ul>{rows.length === 0 && <p>No actions recorded. Add the next commitment.</p>}{editor && <ActionEditor action={editor.action} link={link} directory={directory} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); router.refresh(); }} />}</section>;
}
