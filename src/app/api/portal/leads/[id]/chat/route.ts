import { convertToModelMessages, streamText, tool, type UIMessage } from "ai";
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

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requirePortalUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;
  if (!isAiConfigured()) return setupResponse("OPENAI_API_KEY or AI_GATEWAY_API_KEY is not configured");

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

  const tools = {
    read_dossier: tool({
      description: "Read the latest company research dossier for this lead",
      inputSchema: z.object({}),
      execute: async () => {
        const research = await latestResearch(id);
        return research ?? { status: "empty" };
      },
    }),
    list_documents: tool({
      description: "List documents uploaded to this lead",
      inputSchema: z.object({}),
      execute: async () => {
        const files = await listDocuments({ scope: "lead", leadId: id });
        return files.map((file) => ({
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
        const files = await listDocuments({ scope: "lead", leadId: id });
        const file = files.find((item) => item.id === documentId);
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
      "Use tools to read the dossier and uploaded documents before answering.",
      "Save lasting conclusions with save_note. Be conservative and cite sources.",
    ]
      .filter(Boolean)
      .join("\n"),
    messages: await convertToModelMessages(messages, { tools }),
    tools,
    onFinish: async ({ text }) => {
      if (text.trim()) {
        await addChatMessage({ threadId: thread.id, role: "assistant", content: text });
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
