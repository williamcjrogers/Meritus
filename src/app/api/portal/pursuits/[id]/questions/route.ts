import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getLanguageModel } from "@/lib/ai/model";
import { requireDb } from "@/lib/db";
import { listActivity } from "@/lib/db/activity";
import { latestCompleteBrief } from "@/lib/db/briefs";
import { listDocuments } from "@/lib/db/documents";
import { getPursuit } from "@/lib/db/pursuits";
import { isAiConfigured } from "@/lib/env";
import { requireDatabaseOr503, requirePortalUser, setupResponse } from "@/lib/portal/auth";
import { listDirectors } from "@/lib/portal/directors";
import { isUrlPermitted } from "@/lib/questions/allowlist";
import { collectSourcesFromSteps, finalText } from "@/lib/questions/sources";
import { fencedBlock } from "@/lib/ai/fence";
import { extractUrls } from "@/lib/research/urls";
import { readRelatedActions } from "@/lib/db/desk-actions";
import { chooseNextAction } from "@/lib/actions/model";
import { buildSystemPrompt } from "@/lib/questions/system-prompt";
import { searchWeb } from "@/lib/research/search-web";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Extracted text beyond this is cut so one file cannot swamp the context. */
const MAX_DOCUMENT_CHARS = 60_000;

function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requirePortalUser();
  if (gate.error) return gate.error;
  const dbError = requireDatabaseOr503();
  if (dbError) return dbError;
  if (!isAiConfigured()) return setupResponse("Vercel AI Gateway is not configured");

  const { id } = await context.params;
  const pursuit = await getPursuit(id);
  if (!pursuit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { messages?: unknown };
  try {
    body = (await request.json()) as { messages?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const messages = Array.isArray(body.messages) ? (body.messages as UIMessage[]) : [];
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
  const question = lastUserMessage ? finalText(lastUserMessage) : "";
  if (!question) return NextResponse.json({ error: "Ask a question" }, { status: 400 });

  const [brief, activity, documentRows, directors] = await Promise.all([
    latestCompleteBrief(id),
    listActivity(id, 20),
    listDocuments({ scope: "pursuit", pursuitId: id }),
    listDirectors(),
  ]);
  const documents = documentRows.map((row) => ({
    id: row.id,
    title: row.title,
    hasText: Boolean(row.extractedText?.trim()),
  }));
  const readable = documents.filter((document) => document.hasText).map(({ id, title }) => ({ id, title }));
  const briefSources = brief?.sources ?? [];
  const subject = pursuit.party ?? pursuit.firm;
  const subjectNumber = pursuit.party ? pursuit.partyCompanyNumber : pursuit.companyNumber;

  const tools = {
    search_web: tool({
      description:
        "Search the live web, or inspect one page when a url is given. Use it for whatever the brief and files do not answer: the company, its people, projects, news, insolvency and dispute history.",
      inputSchema: z.object({
        query: z.string().min(1).describe("What to find out"),
        url: z
          .string()
          .optional()
          .describe("A page to inspect: the pursuit website, a brief source, or a url the director gave"),
      }),
      execute: async ({ query, url }) => {
        const allow = { website: pursuit.website, briefSources, messageText: question };
        // The allowlist covers the whole input: a url smuggled into the query is refused too.
        const smuggled = extractUrls(query).find((candidate) => !isUrlPermitted(candidate, allow));
        if ((url && !isUrlPermitted(url, allow)) || smuggled) {
          return { error: "URL not permitted" };
        }
        const result = await searchWeb(
          [
            "Research this for a UK construction disputes advisory practice assessing a prospective instruction.",
            `Subject: ${subject}`,
            subjectNumber ? `Companies House number: ${subjectNumber}` : "",
            pursuit.website ? `Website: ${pursuit.website}` : "",
            url ? `Inspect this page: ${url}` : "",
            `Query: ${query}`,
            "Return concise bullets with sources. Mark inference as inference.",
          ]
            .filter(Boolean)
            .join("\n")
        );
        return jsonSafe(result);
      },
    }),
    read_brief: tool({
      description: "Read the latest complete research brief for this pursuit",
      inputSchema: z.object({}),
      execute: async () => {
        if (!brief) {
          return { status: "none", message: "No complete brief has been built for this pursuit yet." };
        }
        return jsonSafe({
          status: "complete",
          generatedAt: brief.createdAt.toISOString(),
          facts: brief.facts,
          analysis: brief.analysis,
          summary: brief.summary,
          sources: brief.sources,
        });
      },
    }),
    read_document: tool({
      description: "Read the extracted text of a file on this pursuit, by the file's id",
      inputSchema: z.object({ documentId: z.string().min(1) }),
      execute: async ({ documentId }) => {
        const row = documentRows.find((item) => item.id === documentId);
        if (!row) return { error: "Document not found", readable };
        const text = row.extractedText?.trim();
        if (!text) return { error: "This file has no readable text", readable };
        const clipped =
          text.length > MAX_DOCUMENT_CHARS
            ? `${text.slice(0, MAX_DOCUMENT_CHARS)}\n[Text cut at ${MAX_DOCUMENT_CHARS} characters]`
            : text;
        return { title: row.title, text: fencedBlock("document", clipped, { title: row.title }) };
      },
    }),
  };

  const actions = await readRelatedActions({ kind: "pursuit", id });
  const nextAction = chooseNextAction(actions, actions.find(action => action.isPrimary)?.id ?? null);
  const result = streamText({
    model: getLanguageModel(),
    system: buildSystemPrompt({ pursuit, brief, activity, documents, directors, actions, nextActionId: nextAction?.id ?? null, reviewDue: pursuit.reviewDue }),
    messages: await convertToModelMessages(messages, { tools, ignoreIncompleteToolCalls: true }),
    tools,
    stopWhen: stepCountIs(4),
    timeout: { toolMs: 45_000 },
    // Persist when the generation itself ends, not when the browser's stream does: a closed
    // drawer or a reload then still leaves the answer on the thread for the next visit.
    onEnd: async (event) => {
      if (event.finishReason === "error") return;
      const answer = event.text.trim();
      if (!answer) return;
      try {
        const db = requireDb();
        const askedAt = new Date();
        const messages = [
          {
            id: crypto.randomUUID(),
            pursuitId: id,
            role: "user",
            content: question,
            sources: null,
            createdAt: askedAt,
          },
          {
            id: crypto.randomUUID(),
            pursuitId: id,
            role: "assistant",
            content: answer,
            sources: collectSourcesFromSteps(event.steps),
            createdAt: new Date(askedAt.getTime() + 1),
          },
        ];
        await db.execute(sql`select research_write_pursuit_questions(${id},${JSON.stringify(messages)}::jsonb)`);
      } catch (error) {
        console.error("questions persist failed", id, error);
      }
    },
  });

  // Run the generation to completion even if the drawer is closed early, so onEnd fires.
  void result.consumeStream();

  return result.toUIMessageStreamResponse({ originalMessages: messages });
}
