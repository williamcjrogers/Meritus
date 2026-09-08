import { generateObject } from "ai";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { requireDb } from "@/lib/db";
import { leads, notes, researchRuns, type ResearchDossier } from "@/lib/db/schema";
import { listLeadChatTexts, listNotes } from "@/lib/db/queries";
import { assertAiConfigured, getLanguageModel } from "@/lib/ai/model";
import { fetchCompaniesHouseSnapshot } from "./companies-house";
import { searchWeb } from "./search-web";
import { extractUrls } from "./urls";

const dossierSchema = z.object({
  company: z.object({
    name: z.string(),
    number: z.string().nullable(),
    status: z.string().nullable(),
    incorporatedOn: z.string().nullable(),
    address: z.string().nullable(),
    sicCodes: z.array(z.string()),
  }),
  officers: z.array(
    z.object({
      name: z.string(),
      role: z.string().nullable(),
      appointedOn: z.string().nullable(),
    })
  ),
  filingsHint: z.string(),
  newsAndRisks: z.array(z.string()),
  sources: z.array(z.string()),
  summary: z.string(),
});

function formatResearchNote(dossier: ResearchDossier): string {
  const officers = dossier.officers
    .slice(0, 8)
    .map((officer) => `- ${officer.name}${officer.role ? ` (${officer.role})` : ""}`)
    .join("\n");
  const risks = dossier.newsAndRisks.map((item) => `- ${item}`).join("\n");
  return [
    `Research dossier — ${dossier.company.name}`,
    dossier.summary,
    officers ? `Officers:\n${officers}` : "",
    dossier.filingsHint ? `Filings: ${dossier.filingsHint}` : "",
    risks ? `News and risks:\n${risks}` : "",
    dossier.sources.length ? `Sources: ${dossier.sources.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function runLeadResearch(input: {
  leadId: string;
  authorId: string;
}): Promise<{ runId: string; dossier: ResearchDossier | null; error: string | null }> {
  assertAiConfigured();
  const db = requireDb();
  const [lead] = await db.select().from(leads).where(eq(leads.id, input.leadId)).limit(1);
  if (!lead) {
    throw new Error("Lead not found");
  }

  await db
    .update(researchRuns)
    .set({ status: "failed", error: "Superseded by a newer research run" })
    .where(
      and(
        eq(researchRuns.leadId, lead.id),
        eq(researchRuns.status, "running"),
        sql`${researchRuns.createdAt} < now() - interval '2 minutes'`
      )
    );

  const runId = crypto.randomUUID();
  await db.insert(researchRuns).values({
    id: runId,
    leadId: lead.id,
    status: "running",
  });

  try {
    const [house, leadNotes, chatTexts] = await Promise.all([
      fetchCompaniesHouseSnapshot({
        companyName: lead.companyName,
        companyNumber: lead.companyNumber,
      }),
      listNotes(lead.id),
      listLeadChatTexts(lead.id),
    ]);
    const websites = extractUrls(
      lead.website,
      lead.source,
      ...leadNotes.map((note) => note.body),
      ...chatTexts
    );

    let webNotes = "";
    let webSources: string[] = [];
    try {
      const web = await searchWeb(
        [
          `Research this company for a UK construction-disputes advisory firm assessing a prospective instruction.`,
          `Company name: ${lead.companyName}`,
          lead.companyNumber ? `Companies House number: ${lead.companyNumber}` : "",
          websites.length ? `Inspect these URLs: ${websites.join(", ")}` : "Find the official website if one exists.",
          `Cover: what the company does, geography, directors/officers, Companies House identity, recent news, insolvency, adjudication/litigation, and intake risk.`,
          `Return concise bullets with sources. Mark inference as inference. Prefer UK sources.`,
        ]
          .filter(Boolean)
          .join("\n")
      );
      webNotes = web.text;
      webSources = web.sources;
    } catch {
      webNotes = "";
    }

    const { object } = await generateObject({
      model: getLanguageModel(),
      schema: dossierSchema,
      prompt: [
        `Build a structured research dossier for a construction-disputes advisory firm evaluating a prospective instruction.`,
        `Company name: ${lead.companyName}`,
        lead.companyNumber ? `Company number: ${lead.companyNumber}` : "",
        websites.length ? `Known websites: ${websites.join(", ")}` : "",
        house ? `Companies House payload:\n${JSON.stringify(house).slice(0, 12_000)}` : "Companies House was not queried.",
        webNotes ? `Web research notes:\n${webNotes.slice(0, 8_000)}` : "",
        webSources.length ? `Web sources: ${webSources.join("; ")}` : "",
        `Be conservative. Mark inference as inference. Prefer UK sources. Do not invent a Companies House number.`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    });

    const dossier = object as ResearchDossier;
    await db
      .update(researchRuns)
      .set({ status: "complete", dossierJson: dossier, error: null })
      .where(eq(researchRuns.id, runId));

    await db.insert(notes).values({
      id: crypto.randomUUID(),
      leadId: lead.id,
      authorId: input.authorId,
      body: formatResearchNote(dossier),
      source: "research",
    });

    await db
      .update(leads)
      .set({
        status: "researching",
        website: lead.website ?? websites[0] ?? null,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, lead.id));

    return { runId, dossier, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Research failed";
    await db
      .update(researchRuns)
      .set({ status: "failed", error: message })
      .where(eq(researchRuns.id, runId));
    return { runId, dossier: null, error: message };
  }
}
