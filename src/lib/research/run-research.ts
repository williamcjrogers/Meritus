import { generateObject, generateText } from "ai";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireDb } from "@/lib/db";
import { leads, notes, researchRuns, type ResearchDossier } from "@/lib/db/schema";
import { assertAiConfigured, getLanguageModel, getResearchModel } from "@/lib/ai/model";
import { fetchCompaniesHouseSnapshot } from "./companies-house";

const dossierSchema = z.object({
  company: z.object({
    name: z.string(),
    number: z.string().optional(),
    status: z.string().optional(),
    incorporatedOn: z.string().optional(),
    address: z.string().optional(),
    sicCodes: z.array(z.string()).optional(),
  }),
  officers: z.array(
    z.object({
      name: z.string(),
      role: z.string().optional(),
      appointedOn: z.string().optional(),
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

  const runId = crypto.randomUUID();
  await db.insert(researchRuns).values({
    id: runId,
    leadId: lead.id,
    status: "running",
  });

  try {
    const house = await fetchCompaniesHouseSnapshot({
      companyName: lead.companyName,
      companyNumber: lead.companyNumber,
    });

    let webNotes = "";
    try {
      const web = await generateText({
        model: getResearchModel(),
        prompt: `Research the UK company "${lead.companyName}"${
          lead.companyNumber ? ` (Companies House ${lead.companyNumber})` : ""
        }. Focus on construction, disputes, insolvency, directors, recent news, and litigation risk. Return concise bullets with sources.`,
      });
      webNotes = web.text;
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
        house ? `Companies House payload:\n${JSON.stringify(house).slice(0, 12_000)}` : "Companies House was not queried.",
        webNotes ? `Web research notes:\n${webNotes.slice(0, 8_000)}` : "",
        `Be conservative. Mark inference as inference. Prefer UK sources.`,
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
      .set({ status: "researching", updatedAt: new Date() })
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
