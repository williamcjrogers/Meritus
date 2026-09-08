"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Note } from "@/lib/db/schema";
import { noteSourceLabel } from "@/lib/portal/status";

export function LeadNotes({ leadId, notes }: { leadId: string; notes: Note[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch(`/api/portal/leads/${leadId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const data = (await res.json()) as { error?: string };
    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save note");
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <section className="bg-parchment border border-green/10 p-6">
      <h2 className="font-serif text-2xl text-green mb-4">Notes</h2>
      <form onSubmit={onSubmit} className="mb-6">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          required
          className="w-full bg-transparent border border-green/15 px-3 py-2 text-[14px] text-green focus:outline-none focus:border-brass"
          placeholder="Add a note…"
        />
        {error && <p className="mt-2 text-[12px] text-oxblood">{error}</p>}
        <button type="submit" disabled={pending} className="mt-3 btn-outline text-[12px] disabled:opacity-40">
          {pending ? "Saving…" : "Add note"}
        </button>
      </form>
      <ol className="space-y-4">
        {notes.map((note) => (
          <li key={note.id} className="border-t border-green/10 pt-4">
            <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-brass/70">
              {noteSourceLabel(note.source)} · {new Date(note.createdAt).toLocaleString("en-GB")}
            </p>
            <p className="mt-2 text-[13px] text-green/90 whitespace-pre-wrap leading-relaxed">{note.body}</p>
          </li>
        ))}
        {notes.length === 0 && <li className="text-[13px] text-slate">No notes yet.</li>}
      </ol>
    </section>
  );
}
