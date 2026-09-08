import { isAiConfigured } from "@/lib/env";

export const LANGUAGE_MODEL_ID = "openai/gpt-5.4";
export const RESEARCH_MODEL_ID = "perplexity/sonar";

export function getLanguageModel() {
  return LANGUAGE_MODEL_ID;
}

export function getResearchModel() {
  return RESEARCH_MODEL_ID;
}

export function assertAiConfigured(): void {
  if (!isAiConfigured()) {
    throw new Error("Vercel AI Gateway is not configured");
  }
}
