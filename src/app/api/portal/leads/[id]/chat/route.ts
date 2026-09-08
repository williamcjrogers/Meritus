import { stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";
import { requireDatabaseOr503, requirePortalUser, setupResponse } from "@/lib/portal/auth";
import { addChatMessage, addNote, getLead, getOrCreateThread, latestResearch, listDocuments } from "@/lib/db/queries";
import { isAiConfigured } from "@/lib/env";
import { getLanguageModel } from "@/lib/ai/model";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function textFromMessage(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function toHistoryMessages(messages: UIMessage[]) {
  return messages.flatMap((message) => {
    if (message.role !== "user" && message.role !== "assistant") return [];
    const content = textFromMessage(message);
    if (!content) return [];
    return [{ role: message.role, content }];
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requirePortalUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;
  if (!isAiConfigured()) return setupResponse("Vercel AI Gateway is not configured");

  const { id } = await context.params;
  const lead = await getLead(id);
  if (!lead) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  }

  const body = (await request.json()) as { messages?: UIMessage[] };
  const messages = body.messages ?? [];
  const thread = await getOrCreateThread(id);
  const last = messages[messages.length - 1];
  if (last?.role === "user") {
    const content = textFromMessage(last);
    if (content) {
      await addChatMessage({ threadId: thread.id, role: "user", content });
    }
  }

  const [research, files] = await Promise.all([
    latestResearch(id),
    listDocuments({ scope: "lead", leadId: id }),
  ]);
  const dossier = research?.status === "complete" ? research.dossierJson : null;

  const tools = {
    read_dossier: tool({
      description: "Read the latest company research dossier for this lead",
      inputSchema: z.object({}),
      execute: async () => {
        const latest = await latestResearch(id);
        if (!latest) return { status: "empty" };
        return jsonSafe({
          status: latest.status,
          error: latest.error,
          dossier: latest.dossierJson,
        });
      },
    }),
    list_documents: tool({
      description: "List documents uploaded to this lead",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await listDocuments({ scope: "lead", leadId: id });
        return rows.map((file) => ({
          id: file.id,
          title: file.title,
          fileName: file.fileName,
          hasText: Boolean(file.extractedText),
        }));
      },
    }),
    read_document: tool({
      description: "Read extracted text from a lead document",
      inputSchema: z.object({ documentId: z.string() }),
      execute: async ({ documentId }) => {
        const rows = await listDocuments({ scope: "lead", leadId: id });
        const file = rows.find((item) => item.id === documentId);
        if (!file) return { error: "Document not found" };
        return {
          title: file.title,
          text: file.extractedText ?? "No extracted text available for this file.",
        };
      },
    }),
    save_note: tool({
      description: "Save a note on this lead",
      inputSchema: z.object({ body: z.string().min(1) }),
      execute: async ({ body: noteBody }) => {
        const note = await addNote({
          leadId: id,
          authorId: gate.userId,
          body: noteBody,
          source: "chat",
        });
        return { saved: true, noteId: note.id };
      },
    }),
  };

  const result = streamText({
    model: getLanguageModel(),
    system: [
      "You are a research assistant for Meritus Via partners.",
      `Lead company: ${lead.companyName}`,
      lead.companyNumber ? `Companies House number: ${lead.companyNumber}` : "",
      dossier
        ? `Latest research dossier (JSON):\n${JSON.stringify(dossier).slice(0, 12_000)}`
        : "No completed research dossier is stored yet.",
      files.length
        ? `Uploaded documents: ${files.map((file) => `${file.title} (${file.id})`).join("; ")}`
        : "No documents have been uploaded to this lead.",
      "Use tools if you need the full dossier, uploaded document text, or to save a lasting note.",
      "Always answer the partner in plain text after any tool calls. Be conservative and cite sources.",
    ]
      .filter(Boolean)
      .join("\n"),
    messages: toHistoryMessages(messages),
    tools,
    stopWhen: stepCountIs(6),
    onFinish: async ({ text, steps }) => {
      const content = [text, ...(steps ?? []).map((step) => step.text)]
        .filter((part) => part?.trim())
        .at(-1)
        ?.trim();
      if (content) {
        await addChatMessage({ threadId: thread.id, role: "assistant", content });
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
