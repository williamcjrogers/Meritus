import { notFound } from "next/navigation";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { LeadNotes } from "@/components/portal/LeadNotes";
import { FileList } from "@/components/portal/LeadFiles";
import { LeadResearch } from "@/components/portal/LeadResearch";
import { LeadChat } from "@/components/portal/LeadChat";
import { LeadStatusForm } from "@/components/portal/LeadStatusForm";
import { isDatabaseConfigured, missingRequiredSetup } from "@/lib/env";
import { getLead, getOrCreateThread, latestResearch, listChatMessages, listDocuments, listNotes } from "@/lib/db/queries";
import type { UIMessage } from "ai";

export const dynamic = "force-dynamic";

function toUiMessages(
  rows: Array<{ id: string; role: string; content: string }>
): UIMessage[] {
  return rows
    .filter((row) => row.role === "user" || row.role === "assistant")
    .map((row) => ({
      id: row.id,
      role: row.role as "user" | "assistant",
      parts: [{ type: "text" as const, text: row.content }],
    }));
}

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  if (missingRequiredSetup() || !isDatabaseConfigured()) {
    return <SetupNotice />;
  }

  const { id } = await params;
  let lead;
  try {
    lead = await getLead(id);
  } catch {
    return <SetupNotice title="Database is configured but not migrated" />;
  }
  if (!lead) notFound();

  const [notes, files, research, thread] = await Promise.all([
    listNotes(id),
    listDocuments({ scope: "lead", leadId: id }),
    latestResearch(id),
    getOrCreateThread(id),
  ]);
  const chatRows = await listChatMessages(thread.id);

  return (
    <div className="max-w-6xl space-y-8">
      <div>
        <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-brass mb-3">Lead</p>
        <h1 className="font-serif text-4xl text-green italic">{lead.companyName}</h1>
        {lead.companyNumber && (
          <p className="mt-2 font-mono text-[12px] text-slate">CH {lead.companyNumber}</p>
        )}
        {lead.website && (
          <p className="mt-2">
            <a
              href={lead.website}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[12px] text-brass hover:text-green"
            >
              {lead.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-3 bg-parchment border border-green/10 p-6 space-y-4">
          <LeadStatusForm lead={lead} />
          <p className="text-[13px] text-slate">
            {lead.contactName || "No contact"}
            {lead.contactEmail ? ` · ${lead.contactEmail}` : ""}
          </p>
          {lead.source && <p className="text-[12px] text-slate">Source: {lead.source}</p>}
        </aside>

        <div className="lg:col-span-5">
          <LeadNotes leadId={lead.id} notes={notes} />
        </div>

        <div className="lg:col-span-4 space-y-6">
          <LeadResearch leadId={lead.id} research={research} />
          <LeadChat leadId={lead.id} initialMessages={toUiMessages(chatRows)} />
        </div>
      </div>

      <section className="bg-parchment border border-green/10 p-6">
        <h2 className="font-serif text-2xl text-green mb-4">Documents</h2>
        <FileList documents={files} uploadUrl={`/api/portal/leads/${lead.id}/documents`} />
      </section>
    </div>
  );
}
