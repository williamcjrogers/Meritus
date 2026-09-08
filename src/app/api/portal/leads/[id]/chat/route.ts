import { stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";
import { requireDatabaseOr503, requirePortalUser, setupResponse } from "@/lib/portal/auth";
import { addChatMessage, addNote, getLead, getOrCreateThread, latestResearch, listDocuments, updateLead } from "@/lib/db/queries";
import { isAiConfigured } from "@/lib/env";
import { getLanguageModel } from "@/lib/ai/model";
import { searchWeb } from "@/lib/research/search-web";
import { extractUrls } from "@/lib/research/urls";

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
  const lastText = last?.role === "user" ? textFromMessage(last) : "";
  if (lastText) {
    await addChatMessage({ threadId: thread.id, role: "user", content: lastText });
  }

  const pastedUrls = extractUrls(lastText, lead.website, lead.source);
  if (!lead.website && pastedUrls[0]) {
    await updateLead(id, { website: pastedUrls[0] });
  }

  const [research, files] = await Promise.all([
    latestResearch(id),
    listDocuments({ scope: "lead", leadId: id }),
  ]);
  const dossier = research?.status === "complete" ? research.dossierJson : null;
  const website = lead.website ?? pastedUrls[0] ?? null;

  const tools = {
    search_web: tool({
      description:
        "Search the live web and read company websites, news, and filings. Use this whenever a dossier is missing or the partner pastes a URL.",
      inputSchema: z.object({
        query: z.string().min(1),
        url: z.string().optional(),
      }),
      execute: async ({ query, url }) => {
        const result = await searchWeb(
          [
            `Research this for a UK construction-disputes advisory firm assessing a prospective instruction.`,
            `Lead company: ${lead.companyName}`,
            lead.companyNumber ? `Companies House number: ${lead.companyNumber}` : "",
            website ? `Stored website: ${website}` : "",
            url ? `Inspect this URL: ${url}` : "",
            `Query: ${query}`,
            `Return concise bullets with sources. Cover identity, what they do, geography, directors, news, insolvency, and dispute risk. Mark inference as inference.`,
          ]
            .filter(Boolean)
            .join("\n")
        );
        return jsonSafe(result);
      },
    }),
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
      "You are a research assistant for Meritus Via partners assessing a prospective construction-disputes instruction.",
      `Lead company: ${lead.companyName}`,
      lead.companyNumber ? `Companies House number: ${lead.companyNumber}` : "",
      website ? `Company website: ${website}` : "",
      dossier
        ? `Latest research dossier (JSON):\n${JSON.stringify(dossier).slice(0, 12_000)}`
        : "No completed research dossier is stored yet.",
      files.length
        ? `Uploaded documents: ${files.map((file) => `${file.title} (${file.id})`).join("; ")}`
        : "No documents have been uploaded to this lead.",
      "You can inspect live websites and search the web with search_web. Never say you cannot browse, cannot open a URL, or need the partner to paste page text.",
      "If the partner sends a URL or asks about the company and the dossier is missing or thin, call search_web first, then answer from those results.",
      "Do not offer investment-screening templates or generic frameworks unless a partner explicitly asks for a template.",
      "Use read_dossier, document tools, or save_note when they help. Always answer in plain text after any tool calls. Be conservative and cite sources.",
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
