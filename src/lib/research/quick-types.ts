import type { DraftFinding } from "./report-schema";
import type { EvidencePassage } from "./workflow-types";

export const QUICK_RESEARCH_COST_PENCE = 200;
export const QUICK_RESEARCH_TOKENS = 30000;
export const QUICK_RESEARCH_MAX_PASSAGES = 12;
export type QuickAnswer = { findings: DraftFinding[]; limitations: string[] };
export type QuickQuestionInput = { requestId: string; question: string; monitoring: boolean };
export type QuickQuestion = {
  id: string; question: string; monitoring: boolean;
  status: "queued" | "running" | "complete" | "failed";
  createdAt: string; lastCheckedAt: string | null; nextCheckAt: string | null;
  error: string | null; answer: QuickAnswer | null; evidence: EvidencePassage[];
};
export type ResearchOpportunity = {
  documentId: string; versionId: string; passageId: string; title: string;
  source: string; provider: string; excerpt: string; url: string;
  publishedAt: string | null; retrievedAt: string; reason: string;
  saved: boolean;
  evidence?: { passageId: string; label: string }[];
};
export type ResearchDeskData = {
  questions: QuickQuestion[]; opportunities: ResearchOpportunity[];
  collection: { enabledSources: number; lastCollectedAt: string | null; needsAttention: number };
};
export type QuickJob = {
  id: string; leaseToken: number; owner: string; question: string;
  investigationId: string; runId: string; monitoring: boolean;
  lastEvidenceHash: string | null; hasCurrentAnswer: boolean;
};
